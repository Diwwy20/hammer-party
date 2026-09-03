# asset-bench

A throwaway viewer for judging 3D assets **before** any of them touch the game.
It is not part of the product — nothing in `packages/` imports it.

It renders KayKit characters at the game's own isometric framing (`CAMERA.isoYawRad`,
the `plaza`/`match` heights from `client/src/config/view.ts`), lets you dress them,
drops the Dungeon props around them, and clones the whole cast up to 25 while
showing FPS, draw calls and triangles — which is how the "will 25 phones survive?"
question gets answered without a room full of phones.

## Run it

The models are ~344 MB of git repos, so they are **not committed**. Fetch them once:

```bash
mkdir -p tools/asset-bench/vendor
git clone --depth 1 https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0.git tools/asset-bench/vendor/adventurers
git clone --depth 1 https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Skeletons-1.0.git tools/asset-bench/vendor/skeletons
git clone --depth 1 https://github.com/KayKit-Game-Assets/KayKit-Dungeon-Remastered-1.0.git tools/asset-bench/vendor/dungeon
```

Then start the `asset-bench` configuration from `.claude/launch.json` (or
`node tools/asset-bench/serve.mjs` and open <http://localhost:5199>).

Everything is **CC0** — free for commercial use, no attribution required. The licence
text is in each pack's `LICENSE.txt`.

## What it is good for

- **Choosing characters.** Six are wired up; the roster lives in `CHARACTERS`.
- **Proving perf.** The FPS readout is the point. Open it on a real phone
  (`http://<your-lan-ip>:5199`) — a hidden browser pane throttles rAF to ~2 fps and
  will lie to you.
- **Proving the wardrobe.** Skin/hair/eyes/outfit repaint palette cells; hats are
  lifted off one character and re-parented onto another's `head` bone.

## Notes worth keeping

- KayKit textures are a **1024×1024 grid of 8×4 flat swatches**, not paintings. Every
  Adventurers character samples the same cells: `(0,0)` skin · `(1,0)` hair · `(2,0)`
  eyes. That is what makes one wardrobe drive every character.
- Loose pieces hang straight off bones — hats on `head`, capes on `chest`, weapons on
  `handslot.r` — so swapping them between characters is re-parenting, no matrix maths.
- `GLTFLoader` strips dots from node names: `handslot.r` arrives as `handslotr`.
- The Dungeon pack names its binaries `<name>.gltf.glb`, and is modelled to a much
  larger grid than the characters — every prop here is scaled to a target height.
