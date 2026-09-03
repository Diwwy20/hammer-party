#!/usr/bin/env node
/**
 * Strip a KayKit character .glb down to the clips the game actually plays.
 *
 * A pack character is ~3.6 MB and ~90% of that is 76 animation clips we do not use.
 * This keeps KEEP_CLIPS, drops every accessor/bufferView that nothing references any
 * more, and rewrites the binary chunk. No dependencies: the GLB container is 12 bytes
 * of header plus length-prefixed chunks, and glTF itself is JSON.
 *
 * Usage: node strip-clips.mjs <in.glb> <out.glb>
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';

/** The only clips the game plays. Everything else in the pack is dead weight. */
const KEEP_CLIPS = [
  'Idle',
  'Walking_A',
  'Running_A',
  '2H_Melee_Attack_Chop',
  'Hit_A',
  'Death_A',
  'Death_A_Pose',
  'Cheer',
  'Jump_Idle',
];

const GLB_MAGIC = 0x46546c67;
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;

function readGlb(path) {
  const buf = readFileSync(path);
  if (buf.readUInt32LE(0) !== GLB_MAGIC) throw new Error(`${path} is not a .glb`);
  let json = null;
  let bin = null;
  for (let off = 12; off + 8 <= buf.length; ) {
    const len = buf.readUInt32LE(off);
    const type = buf.readUInt32LE(off + 4);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === CHUNK_JSON) json = JSON.parse(data.toString('utf8'));
    else if (type === CHUNK_BIN) bin = data;
    off += 8 + len + ((4 - (len % 4)) % 4);
  }
  if (!json) throw new Error(`${path} has no JSON chunk`);
  return { json, bin: bin ?? Buffer.alloc(0) };
}

const pad4 = (n) => (n + 3) & ~3;

function writeGlb(path, json, bin) {
  let jsonChunk = Buffer.from(JSON.stringify(json), 'utf8');
  jsonChunk = Buffer.concat([jsonChunk, Buffer.alloc(pad4(jsonChunk.length) - jsonChunk.length, 0x20)]);
  const binChunk = Buffer.concat([bin, Buffer.alloc(pad4(bin.length) - bin.length, 0)]);

  const header = Buffer.alloc(12);
  header.writeUInt32LE(GLB_MAGIC, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonChunk.length + (binChunk.length ? 8 + binChunk.length : 0), 8);

  const parts = [header, chunkHeader(jsonChunk.length, CHUNK_JSON), jsonChunk];
  if (binChunk.length) parts.push(chunkHeader(binChunk.length, CHUNK_BIN), binChunk);
  writeFileSync(path, Buffer.concat(parts));
}

function chunkHeader(length, type) {
  const head = Buffer.alloc(8);
  head.writeUInt32LE(length, 0);
  head.writeUInt32LE(type, 4);
  return head;
}

function strip(json, bin) {
  const before = json.animations?.length ?? 0;
  const wanted = new Set(KEEP_CLIPS);
  const kept = (json.animations ?? []).filter((clip) => wanted.has(clip.name));
  const missing = KEEP_CLIPS.filter((name) => !kept.some((clip) => clip.name === name));
  json.animations = kept;

  // Everything still reachable. Meshes and skins survive whole; only animation
  // samplers lost references, so walking these four sources is enough.
  const liveAccessors = new Set();
  for (const mesh of json.meshes ?? []) {
    for (const prim of mesh.primitives ?? []) {
      for (const accessor of Object.values(prim.attributes ?? {})) liveAccessors.add(accessor);
      if (prim.indices !== undefined) liveAccessors.add(prim.indices);
      for (const target of prim.targets ?? []) {
        for (const accessor of Object.values(target)) liveAccessors.add(accessor);
      }
    }
  }
  for (const skin of json.skins ?? []) {
    if (skin.inverseBindMatrices !== undefined) liveAccessors.add(skin.inverseBindMatrices);
  }
  for (const clip of kept) {
    for (const sampler of clip.samplers ?? []) {
      liveAccessors.add(sampler.input);
      liveAccessors.add(sampler.output);
    }
  }

  // bufferViews are kept for live accessors and for anything that addresses them
  // directly — embedded images, and (defensively) sparse accessor storage.
  const liveViews = new Set();
  for (const index of liveAccessors) {
    const accessor = json.accessors[index];
    if (accessor.bufferView !== undefined) liveViews.add(accessor.bufferView);
    if (accessor.sparse) {
      liveViews.add(accessor.sparse.indices.bufferView);
      liveViews.add(accessor.sparse.values.bufferView);
    }
  }
  for (const image of json.images ?? []) {
    if (image.bufferView !== undefined) liveViews.add(image.bufferView);
  }

  // Repack the binary chunk in the order the surviving views are renumbered.
  const viewOrder = [...liveViews].sort((a, b) => a - b);
  const viewRemap = new Map(viewOrder.map((old, next) => [old, next]));
  const slices = [];
  const newViews = [];
  let offset = 0;
  for (const old of viewOrder) {
    const view = json.bufferViews[old];
    const start = view.byteOffset ?? 0;
    const slice = bin.subarray(start, start + view.byteLength);
    const padding = pad4(offset) - offset;
    if (padding) slices.push(Buffer.alloc(padding, 0));
    offset += padding;
    slices.push(slice);
    newViews.push({ ...view, buffer: 0, byteOffset: offset });
    offset += view.byteLength;
  }
  const newBin = Buffer.concat(slices);

  const accessorOrder = [...liveAccessors].sort((a, b) => a - b);
  const accessorRemap = new Map(accessorOrder.map((old, next) => [old, next]));
  const newAccessors = accessorOrder.map((old) => {
    const accessor = { ...json.accessors[old] };
    if (accessor.bufferView !== undefined) accessor.bufferView = viewRemap.get(accessor.bufferView);
    if (accessor.sparse) {
      accessor.sparse = {
        ...accessor.sparse,
        indices: { ...accessor.sparse.indices, bufferView: viewRemap.get(accessor.sparse.indices.bufferView) },
        values: { ...accessor.sparse.values, bufferView: viewRemap.get(accessor.sparse.values.bufferView) },
      };
    }
    return accessor;
  });

  for (const mesh of json.meshes ?? []) {
    for (const prim of mesh.primitives ?? []) {
      for (const [name, accessor] of Object.entries(prim.attributes ?? {})) {
        prim.attributes[name] = accessorRemap.get(accessor);
      }
      if (prim.indices !== undefined) prim.indices = accessorRemap.get(prim.indices);
      for (const target of prim.targets ?? []) {
        for (const [name, accessor] of Object.entries(target)) target[name] = accessorRemap.get(accessor);
      }
    }
  }
  for (const skin of json.skins ?? []) {
    if (skin.inverseBindMatrices !== undefined) {
      skin.inverseBindMatrices = accessorRemap.get(skin.inverseBindMatrices);
    }
  }
  for (const clip of kept) {
    for (const sampler of clip.samplers ?? []) {
      sampler.input = accessorRemap.get(sampler.input);
      sampler.output = accessorRemap.get(sampler.output);
    }
  }
  for (const image of json.images ?? []) {
    if (image.bufferView !== undefined) image.bufferView = viewRemap.get(image.bufferView);
  }

  json.accessors = newAccessors;
  json.bufferViews = newViews;
  json.buffers = [{ byteLength: newBin.length }];

  return { bin: newBin, before, after: kept.length, missing };
}

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error('usage: node strip-clips.mjs <in.glb> <out.glb>');
  process.exit(1);
}
const source = readGlb(input);
const result = strip(source.json, source.bin);
writeGlb(output, source.json, result.bin);

const sizeOf = (path) => readFileSync(path).length;
const kb = (bytes) => `${(bytes / 1024).toFixed(0)} KB`;
console.log(
  `${basename(input)} -> ${basename(output)}  ` +
    `clips ${result.before}->${result.after}  ${kb(sizeOf(input))} -> ${kb(sizeOf(output))}` +
    (result.missing.length ? `  MISSING: ${result.missing.join(', ')}` : '')
);
