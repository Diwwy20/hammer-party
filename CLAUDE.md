# Hammer Party — project guide for Claude

Web PVP battle-royale **party game**. Players scan a QR (Kahoot-style, no app),
up to **25 per room**, hit each other with hammers until one survives. A big
screen shows the arena via the **Host**'s spectator cam. Built for company
monthly parties. **3D low-poly, mobile-first, realtime.**

Full status/roadmap: [docs/hammer-party-status.pdf](docs/hammer-party-status.pdf).

## ⚡ Load skills, don't re-derive (saves tokens)

Distilled project knowledge lives in `.claude/skills/`. Load only what a task needs:

- **`hammer-party-spec`** — the "what": numbers, combat, 3 hammers, stages, events, roles, awards.
- **`game-architecture`** — the "how": authoritative netcode, tech stack, module layout, the "don't do this" rules.
- **`dev-roadmap`** — phases + **current status** + acceptance criteria + commit style.
- **`ui-conventions`** — the agreed look & wording: cartoon-minimal theme, cosmetics, splash, screen routing.

(Invoke via the Skill tool, or `Read` `.claude/skills/<name>/SKILL.md` directly.)

## ✅ Current status (2026-08)

- **All phases done (00–05 + the 3D-lobby refactor).** Join · plaza lobby · movement · combat ·
  arena/zone/weapons · juice/cosmetics/awards · 3 stages · per-match results.
- **Post-05 architecture pass** (this repo's current shape) — see `game-architecture`:
  - `GameRoom` is a thin Colyseus adapter; all game rules live in `server/src/game/` behind `MatchSimulation`.
  - `GameScreen` is composition only; the world lives in `client/src/three/`, overlays in `client/src/components/hud/`.
  - Closed value sets (phase, hammer, pickup, event, prank, stage, award, cosmetic ids) are `const`
    objects in `shared/src/enums.ts` — **no bare string literals in comparisons**.
  - The server publishes FACTS, the client owns COPY: `GameState.activeEvent` is an `EventKind`, and
    awards are `{kind, name, value}` — no Thai UI strings in the simulation.
- **Look-and-feel overhaul (latest — the whole game was redesigned to be worth looking at):**
  - **The world is a PLACE.** A gradient sky dome with a drifting cloud bank (`three/Sky.tsx`), one warm
    sun whose shadow camera actually covers the arena, and a thick floating ISLAND under the arena —
    tiled floor, coloured rim, low wall with posts, tapered underside (`PLATFORM`/`FLOOR` in `config/view.ts`).
  - **Procedural textures** (`three/textures.ts`): the floor tiles, the sky gradient, the contact-shadow
    blob, the zone wall's fade and the character's FACE are all painted into a canvas at runtime — nothing
    is fetched, so the game still opens instantly on party wifi.
  - **The plaza is a party** (`three/Plaza.tsx`): planters and trees, bunting on a rope, balloons, confetti
    and a floor medallion — all instanced, one draw call per kind.
  - **The safe zone is a wall of light**, not a line on the floor; the safe disc keeps its tile size as it
    shrinks (the texture's repeat is rewound each frame).
  - **The character was rebuilt to be cute** (`three/Character.tsx`): chibi proportions (big head, small
    body, noodle arms with mitten hands, big shoes) and a **painted face** — one curved plate wearing a
    canvas texture, so blinking and wincing cost a texture swap rather than a dozen meshes per player.
    Animation gained head-lag on turns, a footfall squash, idle sway/tilt and a soft contact shadow.
  - **The HUD is three bands** and nothing ever lands in two at once: `HudTop` (where you are) · the middle
    band above the thumbs (`LobbyDock` in the lobby, `MatchHud` vitals in a match) · the thumbs themselves.
    The old lobby status paragraph and control hints are gone; the ready count rides inside the ready button.
  - **Opening the wardrobe used to swing the camera round in front of you** — superseded by the dressing
    room below.
- **Presentation + spectator pass:**
  - **Join flow:** cover art (`components/GameCover.tsx`, inline SVG so it is instant and offline-safe)
    on both the join screen and the loading splash; name entry with a 🎲 suggestion button.
  - **Characters:** a proper animation RIG (`three/Character.tsx`) driven by `three/PlayerAvatar.tsx` —
    cute rounded proportions, distance-driven walk cycle, idle breathing, swing arc + trail, hit squash,
    impact burst, death poof. All measurements come from `RIG` in `config/view.ts`.
  - **Camera was third-person everywhere** (was first-person in a match) — superseded by the isometric
    pass below; see `ui-conventions`.
  - **Stage:** the default stage is now a dressed arena — solid pillars/crates you collide with
    (`StageConfig.obstacles`, `pushOutOfObstacles` shared by server AND client prediction) plus stands,
    columns, banners and braziers laid out from `StageConfig.decor`.
  - **Events:** added **Meteor** (telegraphed strikes, AoE with falloff) and **Rain** (slick floor —
    knockback carries much further). Both are TIMED, so they live in `server/game/hazards.ts`.
  - **Ghosts:** dead players stay in the world and keep flying; the living cannot see them; they prank
    the survivor they are floating nearest to, on a cooldown.
  - **Host spectating:** a free orbit cam, or a chase cam locked to any living player (`HostSpectateBar`).
- **Character + weapon + combat-animation overhaul (latest — the owner asked for the lot to be torn out
  and redone; see `ui-conventions` for the full conventions):**
  - **The character is DRESSED and has HAIR.** A scarf that doubles as the collar, a placket, a belt and
    buckle, a flared hem, boots with cuffs and soles; a hairstyle in two thin shells plus a fringe, side
    locks and a cowlick. The bean underneath is unchanged — the clothes are what give a round body depth.
  - **Toon-shaded, with a rim light.** Characters are lit through a stepped ramp (`TOON`,
    `toonRampTexture`) while the arena stays ordinarily lit, plus a cool no-shadow back light
    (`LIGHTING.rimDirection`) that peels them off the floor behind them.
  - **The face got eyes**: iris, an under-glow, a pupil, two catchlights and a lash line, plus two new
    expressions — `Fierce` mid-swing and `Dizzy` for the dead.
  - **Everything loose lags** — head, hair and scarf are dragged by the body, not animated with it — and
    feet roll onto their toes.
  - **The swing is a four-beat blow that sweeps ROUND the body** (lift+wind → sweep through → hit-stop
    HOLD → unwind), with the hammer whipping behind the arm and past it, the body lunging into it, and a
    painted billboarded smear. Its length is derived from that hammer's own cooldown.
  - **The hammer is a lathe-turned mallet lying ACROSS the swing**, and each of the four kinds has its own
    metal, timber, bulk and smear colour (`hammerStyle`) — you can read someone's weapon from across the
    arena.
  - **A hit lands as four things at once**: squash, a white flash, a billboarded star and a ground ring.
  - **LOD**: the trim/buckle/cuffs/soles/loose hair are only built inside `LOD.detailInM`, which is what
    pays for the richer rig at 25 players.
  - Your own character is marked by a **ring on the floor** in your colour, not a glow on the body.
- **Isometric + dressing-room redesign (LATEST — the owner asked for the presentation to be torn out and
  rebuilt around an isometric arena and a proper dressing room; `ui-conventions` has the full conventions):**
  - **The camera is ISOMETRIC in every phase** (`CAMERA.isoYawRad`, 45° round, ~37° down, never rotating).
    `runtime/input.ts` `toWorld()` turns the stick by that same yaw, once — it is the only place the camera
    angle touches movement. The Host's chase cam uses the same framing and no longer swings round its subject.
  - **The floor is WEATHERED STONE FLAGS** (`stoneFloorTexture`): per-flag tone variance, wavering mortar
    that still tiles (the canvas-edge wobble is mirrored), a lit top bevel and a shaded bottom one, speckled
    wear and hairline cracks. The bevels are drawn INSIDE the mortar — under it, the mortar eats them.
  - **Grass grows through it** (`three/Grass.tsx`): painted patches for colour, crossed alpha quads for
    silhouette, tufts clustered INSIDE the patches, and both culled against the safe zone — so the closing
    wall visibly burns the grass away.
  - **The arena stands in a COUNTRYSIDE** (`three/Backdrop.tsx`): a grass plain below the island, a
    treeline, a village and hills, each ring washed further toward the sky. That haze is the "depth of
    field" — real DOF is a post-processing dependency we do not have, and a cartoon wants aerial
    perspective anyway.
  - **A hit now lands as seven things**: squash, white flash, billboarded star, ground ring, dust, a spray
    of physical **SPARKS** (`Points`, thrown on a cone and pulled down by gravity), and a **FRACTURE** left
    in the flagstones that outlives the blow. Sparks are alpha-blended and saturated, never additive — over
    pale stone, additive light is invisible.
  - **Combat UI:** a nameplate with a three-layer HP bar (dark max track · pale drain segment · bright fill)
    and the number on it, floating **damage numbers** from a pooled overlay (size and colour carry the
    magnitude), and a **target ring + reticle** on whoever your next swing would land on — running the same
    reach/arc test the server will.
  - **THE DRESSING ROOM** (`three/DressingRoom.tsx` + `components/dressing/`): a real room — plank floor,
    panelling, rug, shelves with books and pots and rolled maps, a plant, an afternoon window — with an
    ornate full-length mirror you stand in, on a turntable you can drag. It renders in the SAME canvas with
    the arena UNMOUNTED, so it is the cheapest screen in the game rather than the most expensive.
  - **Wardrobe grids with painted SVG icons** (`ItemIcon.tsx`) drawn from the same palette as the meshes —
    not emoji. **HAIR is now a real cosmetic slot** (`hairIndex`, 12 tones, clamped server-side like the
    rest), and the hammer tab is a clearly-labelled PREVIEW, because hammers are found in the arena.
  - **The default look is the game's own character**: gold shirt, dark hair, black top hat with a RED brim.
- ✅ **Phase 06 — model characters (DONE).** The procedural rig is gone from the arena; a character is now
  an authored **KayKit CC0** model. Primitives had a ceiling — no hair, no cloth, no face — which is why the
  hand-built look was rejected three times. Planned in
  **[docs/plans/phases-06-10-model-characters.md](docs/plans/phases-06-10-model-characters.md)** — read it
  before touching `client/src/three/`. What shipped:
  - **The asset pipeline**: `tools/model-pipeline/strip-clips.mjs`, a dependency-free GLB rewriter that keeps
    the nine clips the game plays and prunes every accessor and bufferView nothing references any more. Each
    character drops 3.5 MB → ~0.7 MB, because ~90% of a pack character is 76 animations we never use. The
    stripped `.glb`s live in `client/public/models/` (Knight · Barbarian · Rogue_Hooded · Mage ·
    Skeleton_Minion); everyone wears the Knight until Phase 08 offers a choice.
  - **The rig**: `three/ModelCharacter.tsx` loads once and clones per player with `SkeletonUtils.clone`, which
    duplicates the bone hierarchy and SHARES geometry and materials — a crowd of 25 resolves to at most three
    materials. Pack materials are converted to `MeshToonMaterial` through the existing ramp, built-in
    swords/shields are hidden (the hammer is this game's only weapon), and **only the torso casts a real
    shadow** — everything with `castShadow` is drawn twice, and that one change took a character from 19 draw
    calls to 11.
  - **The driver**: `PlayerAvatar` runs an `AnimationMixer` for idle/walk/run/float. The walk is still
    **distance-driven** — it survives as the clip's `timeScale` — so feet keep up with a player being
    interpolated or slid across a wet floor. The two pure decisions (which clip, how fast) are in
    `three/locomotion.ts` with unit tests.
  - The hammer hangs off the model's `handslot.r` bone, undoing the bone's world scale so a mallet stays a mallet.
  - **Player colour is decided**: characters keep their own colours and identity lives on the **floor ring +
    nameplate**. Once players pick a character a body tint fights the character it is painted over.
  - Measured in the browser: **11 draw calls and ~6.1k triangles per player**, against 700+ draw calls at 25
    players for the old avatar — roughly 320 draw calls extrapolated to a full room.
  - `tools/asset-bench/` is the throwaway viewer that decided the pack — not part of the product.
- 🚧 **NEXT UP — Phase 07: combat animation.** Swing · hit · death · ghost clips, cross-faded. The landmine:
  a canned swing clip has a FIXED length while the game derives swing length from that hammer's
  `cooldownMs`, so the clip has to be time-scaled for its contact frame to land on the server's hit moment —
  otherwise players feel hits that "don't count". Every `Impact.tsx` effect then fires at that frame.
  Phases 08 (wardrobe + the first schema change) · 09 (arena props) · 10 (delete the dead procedural code)
  follow.
- ⚠️ **Still owed (event-day hardening):** a real ~25-device load test (fps/latency), a full dress
  rehearsal + LAN fallback, and reconnection tested on genuinely flaky wifi. **The owner has waived the
  25-device test as a phase gate** — it is event-day work, not a blocker on Phases 07–10.
- Styling is **Tailwind v4 + shadcn (Base UI)** — see `ui-conventions`.

## 🔑 Non-negotiable rules

- **No magic values.** Anything compared, switched on, or measured gets a name:
  - a **number** the simulation reads → `packages/shared/src/constants.ts`
  - a **closed set of strings** (phase / kind / id / error code) → `packages/shared/src/enums.ts`
  - **stage layout** → `packages/shared/src/stages.ts`
  - **presentation-only** tuning (camera, FX length, palettes, poll rates) → `packages/client/src/config/`
  - **network policy** (server URL, reconnect backoff, join-link params) → `packages/client/src/net/config.ts`
- **`packages/shared/` is the single source of truth** for every game value. Never duplicate a number.
- **Server is authoritative** (20Hz). Clients send input only and never decide outcomes. Never trust the client.
- **No full networked physics/ragdoll.** Capsule movement + swing-angle hit checks + impulse knockback;
  death ragdoll is **client-only**, never synced.
- **No UI copy in the server.** The simulation states facts (event kind, award kind + value); Thai wording
  lives in `client/src/config/copy.ts` or the component that shows it.
- **Stack is locked:** TS · Vite+React 18 (not Next) · Three.js/@react-three/fiber/drei · Zustand ·
  Colyseus/@colyseus/schema · nipplejs · qrcode.react · Zod (thin, server-edge). Game + UI state all arrive
  via the Colyseus socket → Zustand. **No data-fetching lib** · no express (a bare `http` server carries the
  WS transport) · no Redux/tRPC.

## 🎨 Design & wording conventions (agreed with the owner)

- **Cartoon-minimal** visual style (bright sky, white rounded cards, chunky candy buttons, rounded Mali font).
  NOT dark/fantasy. See `ui-conventions`.
- Say **"Host"** in UI copy — not "เจ้าภาพ".
- **Do not hard-code a map name** (e.g. "โคลอสเซียม") in UI — the game is a general "stage" system; future
  maps differ. Use generic copy.
- UI copy is Thai; technical terms stay English.

## Structure

```
packages/shared/src     enums.ts (closed value sets) · constants.ts (TUNABLE NUMBERS) · math.ts
                        · stages.ts (layout + obstacles + decor + pushOutOfObstacles)
                        · messages.ts (wire contract) · schema.ts (subpath export)
packages/server/src     index.ts (bootstrap) · config.ts · logger.ts
                        · rooms/GameRoom.ts   — Colyseus adapter: connections + validated routing ONLY
                        · net/validate.ts     — Zod edge schemas + name filter
                        · game/               — the authoritative game, no networking in it:
                            simulation.ts (MatchSimulation) · context.ts (SimContext, server-only state)
                            combat.ts · movement.ts (+ ghost drift) · pickups.ts · events.ts
                            hazards.ts (meteor storm + rain, the TIMED events) · spawn.ts
                            cosmetics.ts · results.ts (pure ranking rules)
packages/client/src     App.tsx (routing) · store.ts (mirror + selectors) · audio.ts · styles.css
                        · config/{view,theme,copy}.ts   — presentation tuning · palettes · Thai copy
                        · net/{config,client,session,movement}.ts
                        · runtime/{combatFx,localPlayer,input}.ts — per-frame state outside React
                        · three/{World,Sky,Arena,Grass,Backdrop,Plaza,Pickups,Hazards,Weather,Impact,
                                 PlayerAvatar,Character,Hammer,DressingRoom,textures,useSelfControl,
                                 cosmetics,types}
                        · components/{GameCover,HostLobbyOverlay}
                        · components/dressing/{DressingScreen,Wardrobe,ItemIcon}
                        · components/hud/{HudTop,LobbyDock,Joystick,AttackButton,KeyboardControls,MatchHud,
                                          HostSpectateBar,EventBanner,HostEventBar,PrankBar,ZoneWarning,
                                          ResultsOverlay}
                        · screens/{JoinScreen,GameScreen}
e2e/                    @hammer/e2e — smoke.ts: the end-to-end smoke (outside packages/ on purpose)
docs/                   hammer-party-status.pdf · hammer-party-phases.pdf · plans/
.claude/skills          hammer-party-spec · game-architecture · dev-roadmap · ui-conventions
```

`GameScreen` is the single 3D world for **all** phases (lobby plaza · match · results); there is no
separate Lobby/Host screen.

## Run it

```bash
pnpm install   # first time
pnpm dev        # server :2567 + client :5180 (parallel)
```

- Host screen: `http://localhost:5180/?host` · Player: `http://localhost:5180/?room=<CODE>` (or scan the QR).
- `.claude/launch.json` starts **only the client** for the in-app browser preview. It must not run
  `pnpm dev`: the preview harness exports `PORT`, which the Colyseus server would then bind instead of 2567. Run the server yourself with `pnpm dev:server`.
- **pnpm 11 quirk:** native builds are approved via `onlyBuiltDependencies` (esbuild, msgpackr-extract) in
  `pnpm-workspace.yaml` — needed for vite/tsx to run.

## Testing

```bash
pnpm test        # vitest — the PURE rules (swing cone, zone curve, standings/awards, cleanName, schemas, math)
pnpm test:e2e    # full loop against a RUNNING server (`pnpm dev:server` first)
```

- **Unit tests are colocated** (`src/foo.ts` ← `src/foo.test.ts`) so they move and die with their code;
  config is `vitest.config.mts`, one run for the whole monorepo.
- **The e2e smoke lives in `e2e/`**, its own workspace package OUTSIDE `packages/` — it isn't part of the
  product, it drives the product from the outside, and it must stay out of the millisecond unit runner.
- **Only pure functions get unit tests.** Anything needing a live socket, a Colyseus room or WebGL is covered
  by the `e2e/` package instead — mocking it would only test the mocks.
- New rule → put the decision in a pure function, then test it. That's why `results.ts`, `swingImpact` and
  `zoneRadiusAt` are shaped the way they are.

## Conventions

- Package manager: **pnpm** workspaces. Package scope: **`@hammer/*`**.
- **The repo owner runs git commits/pushes themselves** — hand over the command, don't commit unless asked.
- **Do not add a "Co-Authored-By: Claude" trailer** to commits.
