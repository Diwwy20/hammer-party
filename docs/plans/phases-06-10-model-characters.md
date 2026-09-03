# Phases 06–10 — replacing the procedural 3D with authored models

Written 2026-09-04, after an evaluation session. **Nothing in `packages/` has been
changed yet.** Everything below is decided, evidenced, and ready to build.

Read this together with `.claude/skills/ui-conventions` and `.claude/skills/game-architecture`
— the rules there still hold. This plan changes what the characters are MADE of, not
how the game works.

---

## Why

The owner's verdict on the current look: *"ไม่สวยเลย"* — characters, lighting, map and
animation, all four. That was the third such verdict after two full rebuilds of
`three/`, which is the signal that matters: the problem is not that the procedural
character was built badly, it is that **primitives have a ceiling**. Cylinders and
spheres cannot make hair, cloth, or a face. No amount of rewriting gets past it.

So the decision is to stop hand-building characters and use authored models.

## Decisions already made

| Question | Decision |
|---|---|
| Art direction | **Stylised low-poly (PEAK-ish), NOT Genshin.** Anime characters are 5–10× heavier and 25 of them on a phone is a risk the party cannot absorb. |
| Source | **KayKit** by Kay Lousberg — everything **CC0**, free for commercial use, no attribution required. |
| Roster | 6: **Knight · Barbarian · Rogue_Hooded · Mage · Skeleton_Minion · Vampire** |
| The Vampire | Not a downloaded model — nobody gives one away that fits this rig. It is the **Rogue's mesh with a repainted palette** (see below). |
| The hammer | **Keep `three/Hammer.tsx`.** The pack has no hammer, and a lathe-turned mallet is one of the few things primitives do well. |
| Persistence | None to worry about — there is **no `localStorage` for cosmetics** anywhere in the client. No migration. |

### Still undecided — settle this before writing Phase 06 code

**Where does player colour go?** Today 25 players are told apart by tinting the whole
body. Once players pick a character, tinting fights the character (a green Vampire is
not a Vampire).

- *Recommended:* characters keep their own colours; identity moves to the **floor ring
  (already exists) + nameplate (already exists)**.
- *Alternative:* dye only the outfit swatch, leaving skin/hair/hat alone.

This decides how Phase 06 writes its material code, so answer it first.

---

## What the evaluation established (facts, not guesses)

Measured in `tools/asset-bench` — see its README for how to run it.

### Performance — the packs are LIGHTER than what we have now

| | current procedural character | KayKit Knight |
|---|---|---|
| meshes per character | ~30 (plus cosmetics) | 15 (several hideable) |
| materials / textures | several | **1 material, 1 texture (16 KB)** |
| triangles | ~6 k | 6,952 |
| bones | none (rigid parts) | 41 |
| animations | hand-written per motion | **76 clips** |

25 characters + a dressed arena in the bench: **~230 draw calls, ~130 k triangles.**
The current avatar at 25 players is 700+ draw calls. **This change should make the
game faster, not slower.**

⚠️ FPS still has to be read on a real phone. A hidden browser pane throttles
`requestAnimationFrame` to ~2 fps and will report nonsense.

### The texture is a palette, which is what makes cosmetics cheap

Each character's 16 KB atlas is a **1024×1024 grid of 8×4 flat swatches**, not a
painting. Walking every head mesh's UVs showed the same cells used by every
Adventurers character:

| cell | what | Knight | Barbarian | Mage | Rogue |
|---|---|---|---|---|---|
| `(0,0)` | **skin** | 319 verts | 354 | 247 | 260 |
| `(1,0)` | **hair** | 328 | 312 | 374 | 465 |
| `(2,0)` | **eyes** | 80 | 80 | 98 | 98 |

So skin/hair/eye colour is **one piece of code that works on every character**:
redraw those cells onto a canvas, hand the canvas to `CanvasTexture`. Zero extra
download, and it is the same runtime-painting trick `three/textures.ts` already uses.

Outfit colour is the same mechanism on a per-character cell:
Knight `3,0` · Barbarian `6,0` · Rogue/Rogue_Hooded `0,1` · Mage `0,1`.

### Accessories hang off bones, so they swap between characters

The pack parents every loose piece straight to a bone — **hats on `head`, capes on
`chest`, weapons on `handslot.r`/`handslot.l`** — and all characters (both packs)
share the same **41-bone rig**. Wearing the Barbarian's fur hat on the Vampire is
therefore just re-parenting the mesh to the wearer's `head` bone, copying its local
transform. No matrix maths. Verified working in the bench.

The same hook takes our own hammer: `handslot.r`.

### What the packs CANNOT do

- **No hairstyles.** Hair is part of the head mesh. Colour only — unless we add hair
  meshes and hang them off `head` like hats (mechanism is ready; models are not).
- **No mouths.** KayKit faces have eyes and nothing else.
- **No eye shapes.** Colour only.

### Gotchas that cost time once already

- `GLTFLoader` **strips dots from node names**: `handslot.r` arrives as `handslotr`.
- Hats and weapons are plain `Mesh` children of bones, **not** `SkinnedMesh` — do not
  try to rebind them through `boneInverses`.
- The Dungeon pack names its files **`<name>.gltf.glb`** and is modelled to a much
  larger grid than the characters; scale every prop to a target height.
- Character `.glb` files are 3.6 MB each and **~90 % of that is the 76 animations.**
  We need about 8. Strip before shipping.

---

## The phases

Each is one branch, one commit, merged to `main` (the owner runs git; no
`Co-Authored-By` trailer). Playable at every boundary.

### Phase 06 — one new character standing in the real game 🔥 START HERE

**Goal:** a KayKit character replaces the procedural one, walking and standing.
Nothing else changes.

- Strip the chosen `.glb`s to ~8 clips (`Idle`, `Walking_A`, `Running_A`,
  `2H_Melee_Attack_Chop`, `Hit_A`, `Death_A`, `Cheer`, one float for ghosts) and put
  them in `packages/client/public/models/`.
- New `three/ModelCharacter.tsx` replacing `three/Character.tsx`: load once, clone per
  player with `SkeletonUtils.clone`, share one material.
- `PlayerAvatar` drives an `AnimationMixer` for idle/walk only. Its nameplate, HP bar,
  damage numbers and `Impact.tsx` calls stay exactly as they are.
- Preload before the plaza appears (the loading splash already exists).

**Do not touch:** swing/hit/death animation · cosmetics schema · the dressing room ·
the arena · anything on the server.

**Done when:** 25 players walk in the plaza **on a real phone at ≥30 fps**, and
`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:e2e` are all green.

**Why first:** it settles the 25-device question that has been outstanding since
Phase 01. If it fails, every later phase changes.

### Phase 07 — combat animation

- Swing / hit / death / ghost clips with cross-fades.
- **The landmine:** a canned swing clip has a fixed length; the game derives swing
  length from that hammer's `cooldownMs`. Time-scale the clip so the visual contact
  frame lands on the server's hit moment, or players will feel hits that "don't count".
- Fire the existing `Impact.tsx` effects (squash, flash, star, ring, dust, sparks,
  floor fracture) at the clip's contact frame.

**Done when:** the swing reads as landing exactly when the server says it landed, and
the e2e smoke still passes.

### Phase 08 — the new wardrobe (first phase that touches the server)

- `shared/enums.ts` + `constants.ts` + `schema.ts`: add **`characterIndex`**;
  `hairIndex` becomes a **hair COLOUR**; drop `faceIndex` and `backIndex` (no faces,
  and capes come with the character).
- Server clamps the new indices; `net/validate.ts` Zod schema updated; unit-test the
  clamping (it is a pure rule, so it gets a test — house rule).
- Client: palette repainting + bone-attached hats, with the repainted texture **cached
  by look** so 25 players wearing the same thing share one texture.
- `components/dressing/`: a character tab plus colour-swatch slots. The dressing room
  itself (`three/DressingRoom.tsx`) survives.

**Done when:** a player picks character + colours + hat and every other screen shows
the same thing.

### Phase 09 — the arena

- Dungeon props (pillars, barrels, crates, banners, rubble) replace the procedural
  decor in `three/Arena.tsx` / `Plaza.tsx`.
- **Keep `StageConfig.obstacles` in step with the art.** Server and client share those
  numbers for collision; art that does not match them means invisible walls or walking
  through pillars.

**Done when:** what you bump into is what you see, on every stage.

### Phase 10 — delete and tune

- Delete `three/Character.tsx`, `three/cosmetics.tsx`, `faceTexture` /
  `FaceExpression` from `textures.ts`, and the now-dead `RIG` entries in
  `config/view.ts`.
- Draw-call and LOD tuning, then the full 25-device dress rehearsal that is still owed.

---

## Scope, honestly

Roughly **1,600 of the 8,400 lines in `three/`** get rewritten — not all of it:

| dies | lines |
|---|---|
| `three/Character.tsx` | 724 |
| `three/cosmetics.tsx` | 320 |
| about half of `PlayerAvatar.tsx` | ~450 |
| face textures in `textures.ts` | ~150 |

| survives untouched | |
|---|---|
| `Impact.tsx` — sparks, rings, damage numbers, floor fractures | 542 |
| `Arena` · `Sky` · `Grass` · `Backdrop` (until Phase 09) | ~1,200 |
| `Hammer.tsx` | 107 |
| the whole server, netcode, movement, zone and combat rules | — |

The first two phases do not touch `packages/server` at all.

## Where things are

- **Evaluation bench:** `tools/asset-bench/` (README explains how to fetch the packs
  and run it). Not part of the product.
- **Asset packs:** `tools/asset-bench/vendor/`, gitignored — 344 MB of git repos.
  Re-clone with the commands in that README.
- **Product models** will live in `packages/client/public/models/` — only the ~6
  stripped `.glb`s, which is small enough to commit.
