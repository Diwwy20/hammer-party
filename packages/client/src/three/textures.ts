import {
  CanvasTexture,
  LinearFilter,
  NearestFilter,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
} from "three";
import {
  BLOB_SHADOW,
  BURST,
  COMBAT_FX,
  FACE,
  FLOOR,
  GRASS,
  SKY,
  SLASH,
  TARGETING,
  TOON,
} from "../config/view";
import { FACE_COLORS } from "../config/theme";

/**
 * The textures the world is painted with, drawn into a canvas at runtime.
 *
 * Nothing here is loaded over the network: the game has to open instantly on a
 * phone at a party, on whatever wifi the venue has, so every surface that isn't
 * flat colour is generated from the palette instead of shipped as an image.
 *
 * Each one is CACHED by the colours it was asked for. A texture is GPU memory, and
 * the arena re-renders whenever the zone shrinks — building a new canvas each time
 * would leak one per frame.
 */

const cache = new Map<string, Texture>();

function cached(key: string, build: () => Texture): Texture {
  const existing = cache.get(key);
  if (existing) return existing;
  const texture = build();
  cache.set(key, texture);
  return texture;
}

/** A canvas sized in device pixels, ready to draw into. */
function surface(width: number, height: number): CanvasRenderingContext2D {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("2D canvas is unavailable — cannot paint world textures");
  return context;
}

/**
 * A tiny deterministic PRNG, so a painted surface looks random but is the SAME
 * random every time it is built.
 *
 * A texture that redrew itself differently on each mount would make the floor
 * flicker whenever the palette changed — and a bug in one would be unreproducible.
 */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Lighten or darken a hex colour by `amount` (-1…1). */
function shift(hex: string, amount: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const to = amount >= 0 ? 255 : 0;
  const t = Math.abs(amount);
  const channel = (bits: number) => {
    const v = (n >> bits) & 255;
    return Math.round(v + (to - v) * t);
  };
  return `#${((channel(16) << 16) | (channel(8) << 8) | channel(0)).toString(16).padStart(6, "0")}`;
}

/** The colours one stone floor is painted with. */
export interface StoneColors {
  flagA: string;
  flagB: string;
  mortar: string;
  bevelLight: string;
  bevelDark: string;
  wear: string;
}

/**
 * A wavering line from one end of the canvas to the other, used as the edge between
 * two flags.
 *
 * The jitter for the lines lying ON the canvas border is deliberately generated from
 * the same seed as its opposite number, so the left edge and the right edge wobble
 * identically and the texture still TILES. That one detail is the whole difference
 * between hand-cut stone and a wallpaper with a visible seam every four flags.
 */
function edgeLine(size: number, at: number, vertical: boolean, seed: number): Path2D {
  const random = seeded(seed);
  const steps = 12;
  const jitter = size * FLOOR.mortarJitter;
  const path = new Path2D();

  for (let i = 0; i <= steps; i++) {
    const along = (i / steps) * size;
    // pinned at both ends, so neighbouring edges meet exactly at the corners
    const wobble = i === 0 || i === steps ? 0 : (random() - 0.5) * 2 * jitter;
    const x = vertical ? at + wobble : along;
    const y = vertical ? along : at + wobble;
    if (i === 0) path.moveTo(x, y);
    else path.lineTo(x, y);
  }
  return path;
}

/**
 * The floor: WEATHERED STONE FLAGS.
 *
 * A 2×2 block of flags is painted and repeated, so the pattern only obviously
 * repeats every four flags rather than every one. Four things make it stone rather
 * than a checkerboard, and all four are nearly free:
 *
 *   - every flag gets its own slightly different tone;
 *   - the mortar between them WAVERS instead of being ruled (and the wobble is
 *     mirrored across the canvas edge, so it still tiles);
 *   - each flag has a lit top edge and a shaded bottom one, which is the only reason
 *     a painted tile has any thickness at all;
 *   - the whole thing is speckled with wear and worn through with hairline cracks.
 *
 * Painted at runtime rather than shipped, like everything else here: the game has to
 * open instantly on whatever wifi the party has.
 */
export function stoneFloorTexture(colors: StoneColors): Texture {
  const key = `stone|${Object.values(colors).join("|")}`;
  return cached(key, () => {
    const size = FLOOR.texturePx;
    const half = size / 2;
    const context = surface(size, size);
    const random = seeded(0x5747a1);

    context.fillStyle = colors.mortar;
    context.fillRect(0, 0, size, size);

    // the four boundary lines. The two on the canvas border share a seed with the
    // wrap-around edge they meet, which is what keeps the tiling invisible.
    const left = edgeLine(size, 0, true, 11);
    const right = edgeLine(size, size, true, 11);
    const middleX = edgeLine(size, half, true, 23);
    const top = edgeLine(size, 0, false, 37);
    const bottom = edgeLine(size, size, false, 37);
    const middleY = edgeLine(size, half, false, 53);

    const columns = [
      { start: left, end: middleX },
      { start: middleX, end: right },
    ];
    const rows = [
      { start: top, end: middleY },
      { start: middleY, end: bottom },
    ];

    const mortarWidth = size * FLOOR.mortarWidth;
    const bevelWidth = size * FLOOR.bevelWidth;
    context.lineJoin = "round";
    context.lineCap = "round";

    // 1. the flags themselves, each one a slightly different tone of the same stone
    columns.forEach((_column, cx) => {
      rows.forEach((_row, cy) => {
        const base = (cx + cy) % 2 === 0 ? colors.flagA : colors.flagB;
        context.fillStyle = shift(base, (random() - 0.5) * 2 * FLOOR.toneVariance);
        context.fillRect(cx * half, cy * half, half, half);
      });
    });

    // 2. the mortar, cut back out of them along the wavering edges
    context.lineWidth = mortarWidth;
    context.strokeStyle = colors.mortar;
    for (const path of [left, right, middleX, top, bottom, middleY]) context.stroke(path);

    // 3. the bevels, INSIDE the mortar rather than under it. Drawing them first and
    //    letting the mortar cover them is the obvious order and the wrong one: the
    //    mortar is as wide as the bevel, so it eats the whole thing and the floor
    //    goes flat. Clipping each flag back by half the mortar leaves the lit and
    //    shaded edges sitting just inside the gap, which is where a chamfer is.
    columns.forEach((column, cx) => {
      rows.forEach((row, cy) => {
        context.save();
        context.beginPath();
        context.rect(
          cx * half + mortarWidth / 2,
          cy * half + mortarWidth / 2,
          half - mortarWidth,
          half - mortarWidth,
        );
        context.clip();

        context.lineWidth = bevelWidth * 2;
        context.strokeStyle = colors.bevelLight;
        context.stroke(row.start);
        context.stroke(column.start);
        context.strokeStyle = colors.bevelDark;
        context.stroke(row.end);
        context.stroke(column.end);
        context.restore();
      });
    });

    // wear: speckle, then a few hairline cracks worn right through the stone
    context.fillStyle = colors.wear;
    context.globalAlpha = 0.35;
    for (let i = 0; i < FLOOR.speckleCount * 4; i++) {
      const r = random() * size * FLOOR.speckleMaxSize;
      context.beginPath();
      context.arc(random() * size, random() * size, r, 0, Math.PI * 2);
      context.fill();
    }

    context.globalAlpha = 0.28;
    context.strokeStyle = colors.mortar;
    context.lineWidth = Math.max(1, size * 0.004);
    for (let i = 0; i < FLOOR.crackCount; i++) {
      let x = random() * size;
      let y = random() * size;
      let angle = random() * Math.PI * 2;
      context.beginPath();
      context.moveTo(x, y);
      for (let step = 0; step < FLOOR.crackSteps; step++) {
        angle += (random() - 0.5) * 1.2;
        x += (Math.cos(angle) * size * FLOOR.crackLength) / FLOOR.crackSteps;
        y += (Math.sin(angle) * size * FLOOR.crackLength) / FLOOR.crackSteps;
        context.lineTo(x, y);
      }
      context.stroke();
    }
    context.globalAlpha = 1;

    const texture = new CanvasTexture(context.canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.repeat.set(FLOOR.repeats, FLOOR.repeats);
    texture.anisotropy = 8;
    return texture;
  });
}

/**
 * A patch of cartoon grass, painted as a transparent decal that is laid flat on the
 * flags where they have worn out.
 *
 * Tufts of tapered blades, dark at the root and bright at the tip, feathered to
 * nothing at the edge of the patch so it sits INTO the stone rather than on top of
 * it as a visible disc.
 */
export function grassPatchTexture(blade: string, shade: string): Texture {
  return cached(`grass|${blade}|${shade}`, () => {
    const size = GRASS.texturePx;
    const half = size / 2;
    const context = surface(size, size);
    const random = seeded(0x6a5f11);

    for (let i = 0; i < GRASS.tuftsPerPatch; i++) {
      // a golden-angle spiral scatters the tufts without ever clumping or lining up
      const angle = i * 2.399963;
      const spread = Math.sqrt(i / GRASS.tuftsPerPatch) * half * 0.92;
      const cx = half + Math.cos(angle) * spread;
      const cy = half + Math.sin(angle) * spread;
      const scale = size * GRASS.bladeSpread * (0.16 + random() * 0.14);

      for (let b = 0; b < 4; b++) {
        const lean = (random() - 0.5) * 1.5;
        const length = scale * (0.6 + random() * 0.7);
        const width = scale * 0.22;
        const gradient = context.createLinearGradient(cx, cy, cx + lean * length, cy - length);
        gradient.addColorStop(0, shade);
        gradient.addColorStop(1, blade);
        context.fillStyle = gradient;
        context.beginPath();
        context.moveTo(cx - width, cy);
        context.quadraticCurveTo(
          cx + lean * length * 0.4,
          cy - length * 0.6,
          cx + lean * length,
          cy - length,
        );
        context.quadraticCurveTo(cx + lean * length * 0.5, cy - length * 0.5, cx + width, cy);
        context.closePath();
        context.fill();
      }
    }

    // feather the edge: everything already drawn is multiplied by a radial alpha
    context.globalCompositeOperation = "destination-in";
    const mask = context.createRadialGradient(half, half, half * 0.35, half, half, half);
    mask.addColorStop(0, "rgba(0,0,0,1)");
    mask.addColorStop(1, "rgba(0,0,0,0)");
    context.fillStyle = mask;
    context.fillRect(0, 0, size, size);

    const texture = new CanvasTexture(context.canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    return texture;
  });
}

/**
 * ONE standing tuft, for the crossed quads that grow out of a grass patch: a handful
 * of tapered blades on transparent, splaying from a common root at the bottom.
 *
 * Drawn rather than modelled because a tuft of grass has no useful geometry — it is
 * a silhouette. Two crossed quads wearing this read as grass from every angle the
 * camera can reach, where a little cone reads as a fir tree from all of them.
 */
export function tuftTexture(blade: string, shade: string): Texture {
  return cached(`tuft|${blade}|${shade}`, () => {
    const size = GRASS.tuftTexturePx;
    const context = surface(size, size);
    const random = seeded(0x71b3c5);
    const root = size / 2;

    for (let i = 0; i < GRASS.bladesPerTuft; i++) {
      const spread = ((i / (GRASS.bladesPerTuft - 1)) * 2 - 1) * GRASS.tuftSplay;
      const base = root + spread * size * 0.16;
      const tipX = root + spread * size * 0.46;
      const tipY = size * (0.06 + random() * 0.22);
      const width = size * 0.05 * (0.7 + random() * 0.6);

      const gradient = context.createLinearGradient(base, size, tipX, tipY);
      gradient.addColorStop(0, shade);
      gradient.addColorStop(1, blade);
      context.fillStyle = gradient;
      context.beginPath();
      context.moveTo(base - width, size);
      // the curve is what makes a blade a blade rather than a spike
      context.quadraticCurveTo(base + spread * size * 0.1, size * 0.5, tipX, tipY);
      context.quadraticCurveTo(base + spread * size * 0.16, size * 0.55, base + width, size);
      context.closePath();
      context.fill();
    }

    const texture = new CanvasTexture(context.canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    return texture;
  });
}

/**
 * The FRACTURES a ground smash leaves in the flags: a radial star of cracks running
 * out from the point of contact, each one splitting as it goes.
 *
 * Painted white on transparent so one texture serves every stage — the darkness
 * comes from the material it is tinted with. It is the only impact effect that
 * outlives its impact, which is the point: a floor that has been fought on should
 * look like it.
 */
export function crackTexture(): Texture {
  return cached("cracks", () => {
    const size = COMBAT_FX.crackTexturePx;
    const half = size / 2;
    const context = surface(size, size);
    const random = seeded(0x2c9d31);

    context.strokeStyle = "#ffffff";
    context.lineCap = "round";

    /** one fracture, running outward and getting thinner as it goes */
    const fracture = (
      x: number,
      y: number,
      angle: number,
      reach: number,
      width: number,
      depth: number,
    ) => {
      let px = x;
      let py = y;
      let a = angle;
      const steps = COMBAT_FX.crackSteps;
      for (let i = 0; i < steps; i++) {
        a += (random() - 0.5) * COMBAT_FX.crackWander;
        const nx = px + (Math.cos(a) * reach) / steps;
        const ny = py + (Math.sin(a) * reach) / steps;
        context.lineWidth = Math.max(0.6, width * (1 - i / steps));
        context.beginPath();
        context.moveTo(px, py);
        context.lineTo(nx, ny);
        context.stroke();
        px = nx;
        py = ny;
        // a fracture that never branches reads as a scratch, not a break
        if (depth > 0 && i > 1 && random() < COMBAT_FX.crackBranchChance) {
          const side = random() < 0.5 ? -1 : 1;
          fracture(px, py, a + side * 0.7, reach * 0.45, width * 0.6, depth - 1);
        }
      }
    };

    for (let i = 0; i < COMBAT_FX.crackArms; i++) {
      const angle = (i / COMBAT_FX.crackArms) * Math.PI * 2 + random() * 0.4;
      fracture(half, half, angle, half * (0.55 + random() * 0.42), size * 0.03, 1);
    }

    // the crushed hollow right under the hammer head
    const core = context.createRadialGradient(half, half, 0, half, half, half * 0.2);
    core.addColorStop(0, "rgba(255,255,255,0.95)");
    core.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = core;
    context.beginPath();
    context.arc(half, half, half * 0.2, 0, Math.PI * 2);
    context.fill();

    const texture = new CanvasTexture(context.canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    return texture;
  });
}

/**
 * One spark, and one dust mote: a soft round dot, hot in the middle.
 *
 * `Points` sprites are the one place a particle system is cheap — one buffer, one
 * draw call, and the whole spray of debris off a hammer blow costs less than a
 * single extra mesh per player would.
 */
export function dotTexture(): Texture {
  return cached("dot", () => {
    const size = COMBAT_FX.dotTexturePx;
    const half = size / 2;
    const context = surface(size, size);

    const glow = context.createRadialGradient(half, half, 0, half, half, half);
    glow.addColorStop(0, "rgba(255,255,255,1)");
    glow.addColorStop(0.35, "rgba(255,255,255,0.9)");
    glow.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = glow;
    context.fillRect(0, 0, size, size);

    const texture = new CanvasTexture(context.canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    return texture;
  });
}

/**
 * The targeting RETICLE that floats over whoever your next swing would land on: four
 * corner brackets round a thin ring.
 *
 * Brackets rather than a full box because a bracket says "this one" while leaving
 * the character inside it visible — which is the entire job, given the thing being
 * pointed at is a character you are about to hit.
 */
export function reticleTexture(): Texture {
  return cached("reticle", () => {
    const size = TARGETING.texturePx;
    const half = size / 2;
    const context = surface(size, size);

    context.strokeStyle = "#ffffff";
    context.lineCap = "round";

    context.lineWidth = size * TARGETING.bracketWidth;
    for (let i = 0; i < 4; i++) {
      const centre = Math.PI / 4 + (i / 4) * Math.PI * 2;
      context.beginPath();
      context.arc(
        half,
        half,
        half * TARGETING.bracketRadius,
        centre - TARGETING.bracketSweepRad / 2,
        centre + TARGETING.bracketSweepRad / 2,
      );
      context.stroke();
    }

    context.lineWidth = size * TARGETING.ringWidth;
    context.beginPath();
    context.arc(half, half, half * TARGETING.ringRadius, 0, Math.PI * 2);
    context.stroke();

    const texture = new CanvasTexture(context.canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    return texture;
  });
}

/**
 * The sky dome's gradient: zenith at the top of the strip down to the horizon
 * colour at the bottom, mapped onto a sphere seen from the inside.
 *
 * A strip 1px wide is enough — the sphere's UVs stretch it round the whole dome.
 */
export function skyTexture(top: string, mid: string, horizon: string): Texture {
  return cached(`sky|${top}|${mid}|${horizon}`, () => {
    const height = SKY.texturePx;
    const context = surface(1, height);

    // canvas y grows downward while the texture's V grows upward, so the zenith is
    // painted at y = 0 and comes out at the top of the dome
    const gradient = context.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, top);
    gradient.addColorStop(1 - SKY.midStop, mid);
    gradient.addColorStop(1 - SKY.horizonStop, horizon);
    gradient.addColorStop(1, horizon);
    context.fillStyle = gradient;
    context.fillRect(0, 0, 1, height);

    const texture = new CanvasTexture(context.canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    return texture;
  });
}

/**
 * The soft blob every character stands on: opaque in the middle, feathered to
 * nothing at the edge. Used as an ALPHA MAP, so one texture serves every player
 * whatever colour they are.
 *
 * An alpha map is read off the texture's colour channels, not its alpha — so the
 * fade is painted as white-to-black rather than as transparency.
 */
export function blobShadowTexture(): Texture {
  return cached("blob-shadow", () => {
    const size = BLOB_SHADOW.texturePx;
    const half = size / 2;
    const context = surface(size, size);

    const gradient = context.createRadialGradient(half, half, 0, half, half, half);
    gradient.addColorStop(0, "#ffffff");
    gradient.addColorStop(0.5, "#b8b8b8");
    gradient.addColorStop(1, "#000000");
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);

    const texture = new CanvasTexture(context.canvas);
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    return texture;
  });
}

/**
 * A top-to-bottom fade, used as the ALPHA MAP of the safe-zone wall: solid where it
 * meets the floor and gone by the time it reaches the top, so the zone reads as a
 * curtain of light rather than a fence. Painted in greys for the same reason the
 * blob shadow is — an alpha map samples colour, not transparency.
 *
 * Canvas y runs down while the cylinder's V runs up, so the top of the strip is the
 * top of the wall.
 */
export function fadeUpTexture(): Texture {
  return cached("fade-up", () => {
    const height = SKY.texturePx;
    const context = surface(1, height);

    const gradient = context.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "#000000");
    gradient.addColorStop(0.55, "#5a5a5a");
    gradient.addColorStop(1, "#ffffff");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 1, height);

    const texture = new CanvasTexture(context.canvas);
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    return texture;
  });
}

/**
 * The toon RAMP the characters are lit through.
 *
 * `meshToonMaterial` looks the light up in a 1D texture instead of falling off
 * smoothly, so this handful of grey steps IS the shading model: light hits a
 * character and lands on one of four flat tones. It is the whole reason the people
 * read as drawn while the arena they stand in stays ordinarily lit.
 *
 * Nearest filtering and no mipmaps on purpose — an interpolated ramp is just a soft
 * falloff again, which is the thing being replaced.
 */
export function toonRampTexture(): Texture {
  return cached("toon-ramp", () => {
    const steps = TOON.steps;
    const context = surface(steps.length, 1);

    steps.forEach((step, i) => {
      const level = Math.round(step * 255);
      context.fillStyle = `rgb(${level},${level},${level})`;
      context.fillRect(i, 0, 1, 1);
    });

    const texture = new CanvasTexture(context.canvas);
    // the raw greys ARE the shading, so no colour-space conversion may touch them
    texture.minFilter = NearestFilter;
    texture.magFilter = NearestFilter;
    texture.generateMipmaps = false;
    return texture;
  });
}

/**
 * The SMEAR a hammer leaves through the air: a crescent, fat where the head has
 * just been and tapering to nothing where the swing started.
 *
 * Painted rather than built, because the shape is the whole point. A ring of
 * geometry gives an even band with two hard ends, which reads as a piece of scenery
 * swinging past; a band that tapers and fades along its own length reads as speed.
 *
 * Drawn as a run of overlapping soft dots down an arc, since a canvas stroke cannot
 * change width along a path. Painted white so that ONE texture serves every hammer
 * — the colour comes from the material it is tinted with.
 */
export function slashTexture(): Texture {
  return cached("slash", () => {
    const size = SLASH.texturePx;
    const half = size / 2;
    const context = surface(size, size);

    for (let i = 0; i <= SLASH.steps; i++) {
      const t = i / SLASH.steps;
      const angle = -SLASH.sweepRad / 2 + t * SLASH.sweepRad;
      const x = half + Math.cos(angle) * half * SLASH.radius;
      const y = half + Math.sin(angle) * half * SLASH.radius;
      // fattest and brightest at the leading edge, gone by the tail
      const width = half * SLASH.widthRatio * (SLASH.tailWidth + t * (1 - SLASH.tailWidth));
      const glow = context.createRadialGradient(x, y, 0, x, y, width);
      glow.addColorStop(0, "#ffffff");
      glow.addColorStop(SLASH.coreStop, "rgba(255,255,255,0.7)");
      glow.addColorStop(1, "rgba(255,255,255,0)");
      context.globalAlpha = Math.min(1, t * SLASH.leadFade);
      context.fillStyle = glow;
      context.beginPath();
      context.arc(x, y, width, 0, Math.PI * 2);
      context.fill();
    }

    const texture = new CanvasTexture(context.canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    return texture;
  });
}

/**
 * The star that pops at the point of impact: a blown-out core with rays off it.
 *
 * One painted quad instead of a handful of little spark meshes per player. Twenty
 * five characters each carrying seven cones that are invisible 99% of the time is
 * three hundred objects the renderer walks every frame to draw nothing — where a
 * texture costs one.
 */
export function burstTexture(): Texture {
  return cached("burst", () => {
    const size = BURST.texturePx;
    const half = size / 2;
    const context = surface(size, size);

    context.translate(half, half);
    context.fillStyle = "#ffffff";
    for (let i = 0; i < BURST.rays; i++) {
      // alternating long and short rays — what stops a star reading as a cog
      const reach = half * (i % 2 === 0 ? BURST.longRay : BURST.shortRay);
      const spread = (Math.PI / BURST.rays) * BURST.rayWidth;
      context.save();
      context.rotate((i / BURST.rays) * Math.PI * 2);
      context.beginPath();
      context.moveTo(0, 0);
      context.lineTo(Math.cos(-spread) * reach * 0.4, Math.sin(-spread) * reach * 0.4);
      context.lineTo(reach, 0);
      context.lineTo(Math.cos(spread) * reach * 0.4, Math.sin(spread) * reach * 0.4);
      context.closePath();
      context.fill();
      context.restore();
    }

    // the core, blown out in the middle and feathered into the rays
    const coreR = half * BURST.coreRadius;
    const core = context.createRadialGradient(0, 0, 0, 0, 0, coreR);
    core.addColorStop(0, "#ffffff");
    core.addColorStop(BURST.coreStop, "rgba(255,255,255,0.85)");
    core.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = core;
    context.beginPath();
    context.arc(0, 0, coreR, 0, Math.PI * 2);
    context.fill();

    const texture = new CanvasTexture(context.canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    return texture;
  });
}

// ── The face ──────────────────────────────────────────────────────────────────

/**
 * What the character's face is doing. Presentation only — nothing here is ever
 * compared by the simulation, so it lives with the drawing rather than in the
 * shared enums (the same call `ViewMode` makes).
 */
export const FaceExpression = {
  /** the default: wide awake and pleased about it */
  Happy: "happy",
  /** eyes shut — a blink, or a wince held a beat too long */
  Blink: "blink",
  /** mid-swing: narrowed eyes, a shout, and brows that mean it */
  Fierce: "fierce",
  /** just took a hammer to the head */
  Hurt: "hurt",
  /** out of the fight, and seeing stars about it */
  Dizzy: "dizzy",
} as const;
export type FaceExpression = (typeof FaceExpression)[keyof typeof FaceExpression];

/** How wide open the eyes are drawn — expressions missing from here have theirs shut. */
const EYE_OPENNESS: Record<string, number> = {
  [FaceExpression.Happy]: 1,
  [FaceExpression.Fierce]: 0.72,
};

/** How hard each expression drives the brows down toward the nose. */
const BROW_TILT: Record<string, number> = {
  [FaceExpression.Hurt]: -2.2,
  [FaceExpression.Fierce]: -1.8,
  [FaceExpression.Dizzy]: 1.6,
};

/**
 * The face, painted into a canvas and worn as a transparent plate over the front of
 * the head.
 *
 * One mesh carries the whole face, which is what makes expressions affordable: a
 * blink, a wince or a battle cry is a texture swap, not a dozen little meshes per
 * player animated twenty-five times over. It is also simply the best place to be
 * generous — the eyes alone are five passes deep, and they are the only part of a
 * character anybody actually looks at.
 */
export function faceTexture(expression: FaceExpression): Texture {
  return cached(`face|${expression}`, () => {
    const size = FACE.texturePx;
    const context = surface(size, size);
    const scale = size / FACE.designPx;
    context.scale(scale, scale);

    drawBlush(context);
    drawEyes(context, expression);
    drawBrows(context, expression);
    drawMouth(context, expression);

    const texture = new CanvasTexture(context.canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    return texture;
  });
}

/** An ellipse, filled — the shape almost every part of a cartoon face is made of. */
function blob(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  color: string,
): void {
  context.beginPath();
  context.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  context.fillStyle = color;
  context.fill();
}

/** Whichever pair of eyes this expression wears. */
function drawEyes(context: CanvasRenderingContext2D, expression: FaceExpression): void {
  const openness = EYE_OPENNESS[expression];
  if (openness) drawOpenEyes(context, openness);
  else if (expression === FaceExpression.Blink) drawClosedEyes(context);
  else if (expression === FaceExpression.Dizzy) drawSpiralEyes(context);
  else drawWincingEyes(context);
}

/**
 * An open eye, in five passes: the white, the iris, the pool of light coming
 * through the bottom of it, the pupil, and two catchlights on top.
 *
 * Everything after the white is CLIPPED to it, so the iris can be drawn far bigger
 * than the eye it sits in — which is what tucks it under the lid, and what
 * separates a character with eyes from a character with two dots.
 */
function drawOpenEyes(context: CanvasRenderingContext2D, openness: number): void {
  const ry = FACE.eyeRy * openness;
  const irisY = FACE.eyeY + FACE.irisDrop;

  for (const side of [-1, 1]) {
    const x = FACE.centreX + side * FACE.eyeSpreadX;

    blob(context, x, FACE.eyeY, FACE.eyeRx, ry, FACE_COLORS.white);
    context.save();
    context.beginPath();
    context.ellipse(x, FACE.eyeY, FACE.eyeRx, ry, 0, 0, Math.PI * 2);
    context.clip();
    blob(context, x, irisY, FACE.irisR, FACE.irisR, FACE_COLORS.iris);
    blob(context, x, irisY + FACE.glowDrop, FACE.glowR, FACE.glowR * 0.8, FACE_COLORS.irisLow);
    blob(context, x, irisY, FACE.pupilR, FACE.pupilR, FACE_COLORS.pupil);
    blob(
      context,
      x - FACE.shineOffset,
      irisY - FACE.shineOffset,
      FACE.shineR,
      FACE.shineR,
      FACE_COLORS.shine,
    );
    blob(
      context,
      x + FACE.sparkOffset,
      irisY + FACE.sparkOffset,
      FACE.sparkR,
      FACE.sparkR,
      FACE_COLORS.shine,
    );
    context.restore();

    // The lash line: a heavy stroke over the top of the eye, flicking out past the
    // outer corner. It is the eye's actual SHAPE — the white is only the space
    // inside it.
    context.strokeStyle = FACE_COLORS.lash;
    context.lineWidth = FACE.lashWidth;
    context.lineCap = "round";
    context.beginPath();
    context.ellipse(x, FACE.eyeY, FACE.eyeRx, ry, 0, Math.PI, Math.PI * 2);
    context.stroke();
    const corner = x + side * FACE.eyeRx;
    context.beginPath();
    context.moveTo(corner, FACE.eyeY);
    context.lineTo(corner + side * FACE.lashFlick, FACE.eyeY - FACE.lashFlick * 0.7);
    context.stroke();
  }
}

/** Both eyes shut, curving upward — a happy blink, never a blank one. */
function drawClosedEyes(context: CanvasRenderingContext2D): void {
  context.strokeStyle = FACE_COLORS.lash;
  context.lineWidth = FACE.lidWidth;
  context.lineCap = "round";
  for (const side of [-1, 1]) {
    const x = FACE.centreX + side * FACE.eyeSpreadX;
    context.beginPath();
    context.moveTo(x - FACE.eyeRx, FACE.eyeY + FACE.lidLift);
    context.quadraticCurveTo(
      x,
      FACE.eyeY - FACE.lidLift * 2,
      x + FACE.eyeRx,
      FACE.eyeY + FACE.lidLift,
    );
    context.stroke();
  }
}

/** Both eyes screwed shut in an X — the "that hurt" face. */
function drawWincingEyes(context: CanvasRenderingContext2D): void {
  context.strokeStyle = FACE_COLORS.lash;
  context.lineWidth = FACE.lidWidth;
  context.lineCap = "round";
  for (const side of [-1, 1]) {
    const x = FACE.centreX + side * FACE.eyeSpreadX;
    const r = FACE.eyeRx * 0.7;
    context.beginPath();
    context.moveTo(x - r, FACE.eyeY - r);
    context.lineTo(x + r, FACE.eyeY + r);
    context.moveTo(x + r, FACE.eyeY - r);
    context.lineTo(x - r, FACE.eyeY + r);
    context.stroke();
  }
}

/** Spirals, for somebody who has been knocked clean out of the match. */
function drawSpiralEyes(context: CanvasRenderingContext2D): void {
  context.strokeStyle = FACE_COLORS.lash;
  context.lineWidth = FACE.lidWidth * 0.7;
  context.lineCap = "round";
  for (const side of [-1, 1]) {
    const x = FACE.centreX + side * FACE.eyeSpreadX;
    context.beginPath();
    for (let i = 0; i <= FACE.spiralSteps; i++) {
      const t = i / FACE.spiralSteps;
      const angle = t * Math.PI * 2 * FACE.spiralTurns;
      const r = FACE.eyeRx * FACE.spiralSpread * t;
      const px = x + Math.cos(angle) * r;
      const py = FACE.eyeY + Math.sin(angle) * r;
      if (i === 0) context.moveTo(px, py);
      else context.lineTo(px, py);
    }
    context.stroke();
  }
}

/** A brow over each eye. Their tilt is the entire expression above the eyes. */
function drawBrows(context: CanvasRenderingContext2D, expression: FaceExpression): void {
  // driven down toward the middle when it hurts or when it means it, raised otherwise
  const tilt = BROW_TILT[expression] ?? 1;
  const drop = expression === FaceExpression.Fierce ? FACE.browFierceDrop : 0;
  context.fillStyle = FACE_COLORS.brow;

  for (const side of [-1, 1]) {
    const x = FACE.centreX + side * FACE.eyeSpreadX;
    context.save();
    context.translate(x, FACE.browY + drop);
    context.rotate(FACE.browTiltRad * tilt * side);
    context.beginPath();
    context.roundRect(-FACE.browW / 2, -FACE.browH / 2, FACE.browW, FACE.browH, FACE.browH / 2);
    context.fill();
    context.restore();
  }
}

/** The mouth: a smile, a shout, an "ow", or a wobble. */
function drawMouth(context: CanvasRenderingContext2D, expression: FaceExpression): void {
  if (expression === FaceExpression.Hurt || expression === FaceExpression.Fierce) {
    // an open mouth — wide and round for a battle cry, small and pinched for a wince
    const wide = expression === FaceExpression.Fierce ? FACE.shoutScale : FACE.owScale;
    blob(
      context,
      FACE.centreX,
      FACE.mouthY + FACE.mouthDrop / 2,
      FACE.mouthW * 0.42 * wide,
      FACE.mouthDrop * 0.8 * wide,
      FACE_COLORS.mouth,
    );
    return;
  }

  if (expression === FaceExpression.Dizzy) {
    context.strokeStyle = FACE_COLORS.mouth;
    context.lineWidth = FACE.lidWidth * 0.8;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(FACE.centreX - FACE.mouthW / 2, FACE.mouthY + FACE.mouthDrop / 2);
    context.quadraticCurveTo(
      FACE.centreX,
      FACE.mouthY + FACE.mouthDrop,
      FACE.centreX + FACE.mouthW / 2,
      FACE.mouthY + FACE.mouthDrop / 2,
    );
    context.stroke();
    return;
  }

  context.save();
  context.beginPath();
  context.moveTo(FACE.centreX - FACE.mouthW / 2, FACE.mouthY);
  context.lineTo(FACE.centreX + FACE.mouthW / 2, FACE.mouthY);
  context.quadraticCurveTo(
    FACE.centreX,
    FACE.mouthY + FACE.mouthDrop,
    FACE.centreX - FACE.mouthW / 2,
    FACE.mouthY,
  );
  context.fillStyle = FACE_COLORS.mouth;
  context.fill();
  // the tongue is clipped to the mouth, so it can never sit outside the smile
  context.clip();
  blob(
    context,
    FACE.centreX,
    FACE.mouthY + FACE.mouthDrop,
    FACE.mouthW * 0.3,
    FACE.mouthDrop * 0.6,
    FACE_COLORS.tongue,
  );
  context.restore();
}

/** A little colour high on each cheek. Cheap, and it warms the whole character. */
function drawBlush(context: CanvasRenderingContext2D): void {
  context.save();
  context.globalAlpha = FACE.blushAlpha;
  for (const side of [-1, 1]) {
    blob(
      context,
      FACE.centreX + side * FACE.blushSpreadX,
      FACE.blushY,
      FACE.blushRx,
      FACE.blushRy,
      FACE_COLORS.blush,
    );
  }
  context.restore();
}
