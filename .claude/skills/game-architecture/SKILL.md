---
name: game-architecture
description: Technical architecture, netcode model, module layout, and tech-stack decisions for Hammer Party. Load before writing or reviewing any client/server/shared code, wiring Colyseus rooms, R3F rendering, or netcode — it encodes the authoritative-server model, the 20Hz/100ms interpolation contract, where each responsibility lives, and the hard "do NOT do this" rules (no networked ragdoll, no magic values, don't trust the client).
---

# Hammer Party — Architecture & Netcode

**Heart of the system:** the server holds the single "truth" and prevents cheating.
Each device renders its own 3D view. The big screen is the **Host**'s machine
projecting a spectator camera for everyone.

```
25 mobile clients  ──input(walk/hit/pick)──►  Colyseus Server  ──state ~20×/s──►  all clients
  render own 3D                                (authoritative)                     interpolate + draw
  follow-cam + joystick + hit btn              damage · position · HP · zone
  dead → spectator cam                         rooms · codes · lobby         Host → big screen (spectator cam)
```

## Netcode contract (non-negotiable)

- **Server loop fixed at ~20 Hz** — computes position/damage/HP/zone. Authoritative in one place only.
- **Clients send input only** (move dir + attack). They never decide outcomes.
- **Broadcast via `@colyseus/schema`** — only changed fields (binary delta).
- **Client interpolation**: render _other_ players ~100 ms in the past (`net/movement.ts`); the local
  player is **predicted** and eased back onto the server position (`three/useSelfControl.ts`).

## What is SYNCED, what is BROADCAST, what is LOCAL

Three tiers, and putting something in the wrong one is the classic bug here:

| Tier                              | For                                                                   | Examples                                                                                                                                                             |
| --------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Synced** (`@colyseus/schema`)   | anything clients must AGREE on, and any late joiner must see          | player transforms · hp/alive · pickups · `hazards` (a meteor's warning circle is playable information) · `weather` (rain changes the floor's grip on the SERVER too) |
| **Broadcast** (`ServerMsg`)       | one-shot FX that must fire on the exact frame, and are worthless late | `swing` · `hit` · `died` · `prank` · `boom`                                                                                                                          |
| **Local** (never leaves a client) | a view choice, or something derived per-frame                         | the Host's `spectateId` · walk cycles · hit squash · the ghost float · rain particles                                                                                |

A meteor is the clearest case of the first two working together: the warning circle
is SYNCED (everyone must see the same danger in the same spot for the same length of
time, and someone joining mid-storm has to see it), while the impact is BROADCAST so
the flash and the thud land on the frame the damage was actually resolved.

## Cover collision runs the SAME function on both sides

`pushOutOfObstacles` lives in `shared/stages.ts` and is called by `stepMatch` on the
server AND by the prediction loop on the client. That is the whole trick: if the two
sides disagree about where a pillar is, the player is constantly snapped back and the
game feels broken. Obstacles are CIRCLES — cheap (one hypot per prop) and exact enough
for chunky low-poly cover at 25 players × 20 Hz.

## Camera: third person, fixed orientation, everywhere

Every player camera (plaza · match · ghost) sits behind the player looking toward +z
and **never rotates with their facing**. Two reasons, both load-bearing:

1. `toWorld()` then has exactly ONE mapping for the whole game, so the stick can never
   change meaning under the player's thumb.
2. You can see your own character — the costume, the swing, the hit you just took.
   A first-person match camera hides everything the animation work exists for.

The Host's "watch this player" cam is the one exception: it DOES swing round with the
player it follows, because the big screen wants to be inside the fight.

## ⚠️ Pitfalls — do NOT do these

- ❌ **No full networked physics/ragdoll.** For 25 players it's heavy and crash-prone. Instead:
  character = **capsule** (position/velocity) · attack = **swing-angle check** · knockback = **impulse (decay)** ·
  death ragdoll = **client-only visual, never synced**.
- ❌ **Never trust the client.** Every inbound message is Zod-checked at the edge (`server/src/net/validate.ts`);
  resolution stays on the server.
- ❌ **No physics/ragdoll fields in the synced schema.** Sync only what clients must agree on: positions, HP,
  hammer, phase, zone, cosmetics, code, hostSessionId. Server-only sim state lives in `SimContext`.
- ❌ **No magic values.** See "Where a value lives" below — a bare `"playing"` or a stray `400` in game code
  is a bug waiting to happen.
- ❌ **No UI copy in the server.** The sim states facts; the client owns wording.

## Where a value lives (the rule that keeps the two sides honest)

| Kind of value                                                                                                         | Home                         |
| --------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| number the simulation reads (HP, dmg, speeds, radii, timings)                                                         | `shared/src/constants.ts`    |
| closed set of strings that gets compared (phase, hammer, pickup, event, prank, stage, award, cosmetic id, join error) | `shared/src/enums.ts`        |
| stage layout (radius, spawns, zone curve, wall-slam)                                                                  | `shared/src/stages.ts`       |
| pure math both sides must agree on (lerp, lerpAngle, clamp, approach, TAU)                                            | `shared/src/math.ts`         |
| message names + payload shapes                                                                                        | `shared/src/messages.ts`     |
| presentation tuning (camera, FX length, HUD poll, sizes)                                                              | `client/src/config/view.ts`  |
| palettes (stage themes, pickup styles, HP colours)                                                                    | `client/src/config/theme.ts` |
| Thai copy used by 2+ components                                                                                       | `client/src/config/copy.ts`  |
| network policy (server URL, reconnect backoff, join-link params)                                                      | `client/src/net/config.ts`   |

Enums are `const` objects **plus a same-named union type**, so a comparison always reads
`phase === GamePhase.Playing`. Values are what goes on the wire — renaming a key is safe,
renaming a _value_ is a protocol change.

## Server layout — the room is an adapter, the sim is the game

```
server/src/
├─ index.ts              bootstrap: bare http (health) + Colyseus WS transport + define room
├─ config.ts             env → { port }, health path, HTTP statuses
├─ logger.ts             the ONE place that writes to the console (scoped: "[room ABCD] …")
├─ net/validate.ts       Zod schemas per message + cleanName (control-strip, clamp, profanity mask)
├─ rooms/GameRoom.ts     Colyseus lifecycle ONLY: who connected · is this well-formed & allowed · when to tick
└─ game/                 the authoritative game, with no networking in it
   ├─ simulation.ts      MatchSimulation — the façade the room drives (roster, intents, lifecycle, step)
   ├─ context.ts         SimContext: schema state + server-only state (CombatState, inputs, stage, per-match)
   ├─ combat.ts          swingImpact (pure cone test) · resolveAttack · killPlayer · resolvePrank
   ├─ movement.ts        stepLobby / stepMatch — walk + cover + knockback + wall-slam + zone
   │                     + pickups, plus driftGhost (the dead keep moving, unseen and untouchable)
   ├─ hazards.ts         the TIMED events: the meteor storm's schedule + impacts, the rain window
   ├─ pickups.ts         stage weapons, event drops, collect, respawn timers
   ├─ events.ts          what each event drops + when it auto-fires + banner lifetime
   ├─ spawn.ts           lobby spawn ring + match spawn ring (and the per-match reset)
   ├─ cosmetics.ts       clamp every client-chosen index to its catalog
   └─ results.ts         PURE ranking rules: computeStandings / computeAwards over a stat snapshot
```

**Rule:** `GameRoom` never touches `state.*` directly and `game/` never touches a `Client`.
Adding a rule means a `game/` module + one line in `MatchSimulation` — not more `GameRoom`.

`GameState.phase` drives everything: `lobby` (plaza: walk + bonk, no damage) · `playing` (full sim) ·
`ended` (frozen; results JSON already computed). `MATCH_MAX_MS` is a failsafe — if the shrinking zone
somehow hasn't finished the match, the healthiest survivor wins rather than the room hanging.

## Client layout — one world, many overlays

```
client/src/
├─ App.tsx               routing by connection lifecycle (idle → connecting/splash → open)
├─ store.ts              the zustand mirror + SELECTORS (every selector returns a primitive)
├─ config/               view.ts (tuning) · theme.ts (palettes) · copy.ts (Thai copy)
├─ net/                  config.ts · client.ts · session.ts (the only Colyseus caller) · movement.ts (interp buffer)
├─ runtime/              per-frame state deliberately OUTSIDE React: combatFx · localPlayer · input
├─ three/                World · Arena (floor + cover + dressing) · Pickups · Hazards (meteors)
│                        · Weather (rain) · PlayerAvatar (the animation driver) · Character (the rig)
│                        · cosmetics · useSelfControl (prediction + camera)
├─ components/           GameCover (the SVG cover art) · LobbyBar · CustomizeSheet · Customizer
│                        · HostLobbyOverlay
├─ components/hud/       Joystick · AttackButton · KeyboardControls · MatchHud · EventBanner
│                        · HostEventBar · HostSpectateBar · PrankBar · ZoneWarning · ResultsOverlay
└─ screens/              JoinScreen · GameScreen (composition only — picks which overlays are on screen)
```

**Re-render discipline (this is a 20Hz stream):**

- Positions and combat FX never enter the store — they go to `net/movement.ts` and `runtime/combatFx.ts`
  and are read per-frame in `useFrame`.
- Store selectors return primitives (`selectAliveCount`, `usePlayerField(id, p => p?.hp)`), so a patch that
  changed nothing a component reads does not re-render it.
- Anything that changes every frame but is needed by DOM (out-of-zone warning) is polled on a timer from
  `runtime/localPlayer.ts`, not pushed through React.

## Room / matchmaking (implemented)

- Room name `"game"`, registered with **`.filterBy(['code'])`** so a room code routes players to the right room.
- **Host**: `client.create("game", { asHost:true, code })` — a fresh room; host is NOT a player, not in
  `state.players`, not counted, and the only one allowed to `Start`. Host leaving clears `hostSessionId`.
  Host-only messages go through `GameRoom.onHostMessage`, which gates them in one place.
- **Player**: `client.join("game", { name, code })` — joins the Host's room by code. Player cap = `MAX_PLAYERS`;
  a full room throws `JoinError.RoomFull`, which the client maps to friendly copy (same shared constant).
- **Reconnect**: server `allowReconnection(RECONNECT_SECONDS)` holds the seat (and clears their input so they
  don't slide); the client retries per `RECONNECT` in `net/config.ts`.

## Tech stack & the reasons

- **TypeScript** across client+server+shared → shared state/message types.
- **React 18 + Vite** (NOT Next): 3D renders on client, no SEO, realtime needs a long-lived Colyseus WS server anyway.
- **Three.js + @react-three/fiber + drei** — declarative 3D per device.
- **Zustand** — game/UI state mirror (`client/src/store.ts`).
- **Colyseus + @colyseus/schema** — rooms/codes, authoritative sync, binary delta.
- **nipplejs** (touch stick) · **qrcode.react** (Host QR) · **Zod** (thin server-edge validation).
- **glTF `.glb`** assets later; cosmetics are currently procedural low-poly meshes.
- **Not used:** Redux/tRPC/react-hook-form/TanStack Query — all state arrives via the Colyseus socket → Zustand.
  The server runs a bare `http` server for the WS transport (no express); there is no HTTP data API (the monthly
  leaderboard was removed — results are per-match only, in `GameState.standingsJson`).

## Monorepo layout (pnpm workspaces, scope `@hammer/*`)

`shared/` is the heart — client and server share one set of types & values.

```
packages/
├─ shared/src/   enums.ts · constants.ts · math.ts · messages.ts · stages.ts · schema.ts
│                (schema is the subpath "@hammer/shared/schema"; the index barrel excludes it, so the
│                 CLIENT never bundles @colyseus/schema — it decodes state via reflection)
├─ server/src/   see "Server layout" above
└─ client/src/   see "Client layout" above
```

## Testing — pure rules get unit tests, wiring gets the smoke

```bash
pnpm test        # vitest, one run for the whole monorepo (vitest.config.mts)
pnpm test:e2e    # e2e/smoke.ts, needs `pnpm dev:server` running
```

Unit tests are **colocated** (`src/foo.ts` ← `src/foo.test.ts`) and cover only functions that map plain
inputs to a plain answer:

| Under test                               | Why it's worth a test                                                      |
| ---------------------------------------- | -------------------------------------------------------------------------- |
| `shared/math`                            | both sides round-trip the same formula, or prediction drifts               |
| `shared/stages` `zoneRadiusAt`           | monotonic, accelerates late, hits `minRadius` exactly at `endMs`           |
| `shared/stages` `findStage`              | an unknown/`__proto__` id must not resolve to a "stage"                    |
| `shared/enums` + catalogs                | pickup classification, hammer ratios, cosmetic ids match their catalogs    |
| `server/game/combat` `swingImpact`       | reach, cone edges, behind-you, overlapping bodies, unit direction          |
| `server/game/results`                    | winner-first ranking, and every award's "skip it if nobody qualifies" rule |
| `server/net/validate`                    | the trust boundary: NaN, wrong shapes, unknown kinds, name sanitising      |
| `client/runtime/input` `toWorld`         | the one screen→world mapping both the loop and the sender use              |
| `client/config/theme`, `client/lib/json` | palette fallbacks, HP thresholds, empty/garbage JSON                       |

**Do NOT unit-test through a mock socket, a fake room or a stubbed canvas** — that tests the mock. The
`MatchSimulation`, the room and the renderer are covered by the e2e smoke, which drives a real Host + two
players through a real match and asserts the outcomes that would ruin a party.

**Where tests live, and why the two differ:**

- unit → **colocated** next to the code (`results.ts` / `results.test.ts`). They map 1:1 onto a source file,
  so they move, get renamed and get deleted with it; a parallel `tests/` tree rots into orphans instead.
- e2e → **`e2e/`, a workspace package of its own, outside `packages/`**. It maps onto no single file, needs a
  different runner (`tsx`) and a running server, takes seconds rather than milliseconds, and must never be
  picked up by `vitest` — all four are reasons a separate directory is right here and wrong for unit tests.

When you add a rule, put the decision in a pure function first — that is why `results.ts`, `swingImpact`
and `zoneRadiusAt` are shaped the way they are.

## Colyseus schema gotcha (already handled in schema.ts)

Schema fields use `declare` + constructor assignment (not class-field initializers) so
`defineTypes` change-tracking accessors aren't shadowed. Keep that pattern when adding fields.

Full status & roadmap: [docs/hammer-party-status.pdf](../../../docs/hammer-party-status.pdf).
