---
name: dev-roadmap
description: Phase-by-phase build plan for Hammer Party with the CURRENT status, per-phase goals, "done when" acceptance criteria, and commit style. Load this to decide what to build next, scope a phase, or check whether a phase is truly done. The biggest risk (25-player sync) is front-loaded to Phase 01.
---

# Hammer Party — Roadmap & Status

Build one phase at a time as a complete, playable chunk; each finished phase gets one
commit. The biggest risk (syncing 25 players) is pulled forward to Phase 01.

**Status legend:** ✅ done · 🟡 in progress · ⬜ not started

---

## Phase 00 — Init & Foundation ✅

Monorepo (`@hammer/shared|server|client`), `shared/constants.ts`, Colyseus room handshake,
R3F canvas. Done.

## Phase 01 — Join · Lobby · Movement ✅ (proved risk #1)

🎯 25 phones in one room, walking and seeing each other smoothly.

**Lobby slice — ✅ DONE:**

- Join-by-code: Host `create` room (code via `filterBy`), player `join` by code from the QR — **name only** (code comes from `?room=`; a fallback code field shows if opened without a QR).
- Host role (asHost, not a player, presses Start), host reassign on leave.
- Entry **Splash** screen (progress bar + tips → `booted`).
- Lobby (**now a walkable 3D plaza** — see the Post-05 refactor below): joystick-walk + bonk (no HP), Ready toggle, a dress-up sheet, and only the room count `👥 X/25` (no other names).
- **Cosmetics**: color(8)/hat(6)/face(5)/back(5), rendered on the character, server-authoritative + clamped.
- Start match → `phase="playing"` (GameScreen just switches from plaza to combat rules).
- Cartoon-minimal theme applied.

**Movement — ✅ DONE:**

- Virtual joystick (nipplejs, `GameScreen`) → `sendInput` at 20Hz → server moves players in the 20Hz loop (`GameRoom.update`, clamps to arena, spawns on a ring at Start) → client **interpolates** others ~100ms back + **predicts** self, third-person follow-cam, floating name tags (drei `Html`).
- Netcode buffer in `client/src/net/movement.ts`; input in `net/session.ts` `sendInput`.
- Verified: headless 2-client integration test (spawn→move→clamp→halt) + in-browser client run with no errors.
- ⚠️ **Still owed for a true tick-off:** a **real ~25-device/tab load test** measuring fps/latency (don't assume from 2 tabs). Do this before/at Phase 04 event hardening.
- 📦 `feat: virtual joystick + authoritative 25-player movement (interp + prediction)`

## Phase 02 — Combat ✅ — kill + the game can end

Medium hammer + attack input + cooldown · server hit detection (reach + swing-arc cone) · damage/HP · knockback (impulse+decay) · heavy-hammer stun · death → spectator + client-only ragdoll · win `alive==1` → Results · reconnection · Host spectator free-cam + Restart.

- **First-person** player cam (host + dead keep the orbit spectator cam); attack button holds-to-swing.
- Combat resolves server-side in `server/rooms/GameRoom.ts` (`handleAttack`); swing/hit are **broadcasts**, not schema — client FX in `client/src/net/combat.ts`. New synced fields: `Player.stunned/connected`, `GameState.winnerId`.
- Reconnection: server `allowReconnection` (RECONNECT_SECONDS) + client `colyseus.reconnect(token)` in `net/session.ts`.
- Verified: headless host+2-player smoke (walk together → damage → death → `phase="ended"` + winner). ⚠️ reconnection wired but not yet tested on real flaky wifi.
  ✅ Done when a full match plays to the end; dropping and reconnecting works.

## Phase 03 — Arena · Zone · Weapons ✅

Shrinking zone (out-of-zone HP bleed, eases-in to force a finish ~12min, well under the 20min cap) · Fast/Heavy hammer pickups (respawn) · wall-slam (knockback into wall = extra dmg + stun) · Golden Hammer + Heal-orb events (auto + Host trigger) · **stage as config** for future maps.

- **Stage is data** in `shared/stages.ts` (`COLOSSEUM`): `{radius, spawnRadius, zone, weaponSpawns, wallSlam, theme}`; server reads it, so a new map only swaps config. `zoneRadiusAt()` is a pure, testable shrink curve.
- New synced state: `Pickup` map + `GameState.zoneRadius/stageId/stageTheme/eventBanner`. Host events via `ClientMsg.Event`; client renders lava floor + shrinking safe disc + out-of-zone warning + event banner in `GameScreen.tsx`.
- Verified: headless smoke (weapon swap, Golden/Heal events spawn + banner) + zone-curve check + in-browser run (host event → banner reaches player, no console errors).
- Trimmed per "keep events few": meteor/low-gravity/speed-buff/comeback + hazard-wall props deferred (speed buff needs synced move-speed for client prediction). Dead-player event voting is Phase 04.
  ✅ Done when a match plays end-to-end with the zone forcing a finish; pickups + events work.

## Phase 04 — Juice · Cosmetics · Polish ✅

Cosmetics on in-game avatars, full Results/awards, Zod input validation + name filter, dead-player prank throws, SFX, self-host fonts for offline.

- **Cosmetics finished**: shared procedural meshes in `client/src/three/cosmetics.tsx` (`Hat/Face/Back/AvatarBody`), used by both the plaza-lobby avatars and the arena avatars (first-person eye height retuned to the full-size body).
- **Awards**: server tracks kills (`Player.kills`) + damage/wall-slams/first-blood/survival (server-only), computes 5 awards at end → `GameState.awardsJson`; Results overlay renders champion + award cards.
- **Zod + name filter**: `packages/server/src/validate.ts` — thin `safeParse` on input/ready/cosmetic/event/prank + `cleanName` (control-strip, clamp, profanity mask). `zod` added to `@hammer/server`.
- **Pranks**: dead players lob banana (slip)/bomb (small dmg, floored so never lethal) at a random survivor — `ClientMsg.Prank`, `ServerMsg.Prank` FX. Buttons show for dead players.
- **Fonts self-hosted** in `client/public/fonts/` (+ `public/fonts.css`, linked from `index.html`): **Mali** (display) + **Sarabun** (body). ⚠️ `"Baloo Thai 2"` was never a real Google font — it silently fell back; Mali chosen as the rounded Thai display face (owner deferred the pick).
- **SFX**: synthesized WebAudio in `client/src/audio.ts` (no asset files → offline).
- Verified: headless smokes (pranks: only-dead-can-throw + harass-not-kill; awards populate with correct winners) + in-browser run (fonts load, name masked, no console errors).
- ⚠️ **Still owed (do at the event):** a real ~25-device load test (fps/latency) + full dress rehearsal + LAN fallback; reconnection untested on flaky wifi. glTF models skipped (procedural is fine).
  ✅ Done when a match plays to Results with awards; cosmetics show in-arena; the build runs offline.

## Phase 05 — Post-event ✅

New stages via config.

- **3 stages** (`colosseum`/`pit`/`grand`) in `shared/src/stages.ts` — each with its own radius/zone/weaponSpawns/wallSlam/`label`/theme; `STAGE_ORDER` drives picker order.
- **Host stage picker** in the lobby: `ClientMsg.SetStage` (host + lobby only, Zod-checked) → server sets `selectedStageId`, applied in `beginMatch`; lobby shows it via synced `GameState.stageId`. Client theme colors in `GameScreen`'s `STAGE_THEMES` (visual only).
- Verified: headless smoke (host picks `grand` → radius 30 applies → match plays to end) + in-browser (picker click-to-pick round-trips).
  ✅ Done when the Host can pick a stage that applies to the next match.

## Post-05 refactor — Walkable 3D lobby + per-match results ✅

Owner-requested (2026-08): the lobby became a live 3D plaza and the **monthly leaderboard was removed** (results are per-match only, shown on a screen the Host leaves up).

- **One world, all phases**: `App` routes every phase to `GameScreen`; it renders phase overlays (`HudTop`/`LobbyDock`/`HostLobbyOverlay`/`ResultsOverlay`), and swaps the whole canvas for the dressing room when the wardrobe is open. No more `LobbyScreen`/`HostScreen`/`CharacterPreview`/`CustomizeSheet`.
- **Plaza lobby**: `LOBBY_RADIUS` in constants; server `updateLobby()` (walk + knockback, no zone/pickups/damage), `handleAttack` gated so damage/kills only in `playing` (lobby bonks = knockback + swing FX, **no HP loss**), `spawnLobbyPlayer()` on join/reset. Client: third-person follow cam in lobby, name tags/HP hidden, **only the room count `X/25` — no other names**.
- **Results**: `GameState.standingsJson` (winner-first ranking) + `awardsJson`; `ResultsOverlay` shows standings + funny awards, closeable (dismiss is local; nothing persisted).
- **Removed**: `server/src/leaderboard.ts`, express + `/api/leaderboard`, `client/src/{components/Leaderboard.tsx,net/leaderboard.ts}`, TanStack Query (+ `QueryClientProvider`), `HTTP_URL`.
- Verified in-browser: plaza HUD (no names) · dress-up sheet · Host QR/stage-picker/Start · plaza→combat→Results(standings+awards)→restart loop; no console errors.
  ✅ Done when players gather/bonk in a 3D plaza and a match ends on a standings+awards screen (no persistence).

## Post-05 architecture pass — separation of concerns + no magic values ✅

Owner-requested (2026-08): a senior-level cleanup, no gameplay redesign. Behaviour is unchanged except where noted.

- **Closed value sets → `shared/src/enums.ts`**: `GamePhase`, `HammerKind`, `PickupKind`, `EventKind`, `PrankKind`,
  `StageId`, `StageTheme`, `CosmeticSlot`, `HatId`/`FaceId`/`BackId`, `AwardKind`, `JoinError`. Every comparison
  now reads `phase === GamePhase.Playing` — **no bare string literals**. `shared/src/math.ts` holds the pure
  helpers both sides must agree on (`lerpAngle` was duplicated in two client files).
- **Every magic number named**: `KNOCKBACK_STOP_SPEED`, `WALL_SLAM_COOLDOWN_MS`, `HIT_MIN_DISTANCE`,
  `AUTO_EVENT_AT_MS`, `HEAL_ORB_*`, `MAX_NAME_LENGTH`, `MIN_PLAYERS_FOR_WIN`, `DEFAULT_SERVER_PORT`, … in
  `shared/constants.ts`; presentation tuning moved to `client/src/config/{view,theme}.ts`; network policy to
  `client/src/net/config.ts`.
- **Server split**: `GameRoom.ts` went 771 → ~175 lines and is now purely a Colyseus adapter (connect · validate ·
  route · tick). The game lives in `server/src/game/` behind `MatchSimulation` (`combat`, `movement`, `pickups`,
  `events`, `spawn`, `cosmetics`, `results`, `context`), plus `logger.ts` and `config.ts`. `validate.ts` → `net/`.
  `results.ts` ranking rules are pure functions over a stat snapshot.
- **Client split**: `GameScreen.tsx` went 897 → ~105 lines of composition. The world moved to `three/`
  (`World`, `Arena`, `Pickups`, `PlayerAvatar`, `useSelfControl`), the HUD to `components/hud/` (9 components),
  per-frame non-React state to `runtime/` (`combatFx`, `localPlayer`, `input`), SFX to `hooks/useMatchSfx`.
  `store.ts` gained primitive selectors + `usePlayerField`.
- **Server states facts, client owns copy** (2 wire changes): `GameState.eventBanner` (a Thai sentence) →
  `GameState.activeEvent` (an `EventKind`); awards are now `MatchAward {kind, name, value}` instead of
  pre-rendered `{icon,label,name,detail}`. Wording lives in `client/src/config/copy.ts`. The `Award`/`Standing`
  interfaces were duplicated in server + client — they're now `MatchAward`/`MatchStanding` in `shared/messages.ts`.
- **Behaviour changes (deliberate, small):** `MATCH_MAX_MS` is now enforced as a failsafe (at the documented
  20-min hard cap the healthiest survivor wins instead of the room hanging); the Host-view HUD says
  "มุมมอง Host" instead of the banned "เจ้าภาพ".
- **Dead code removed**: unused `ClientMsg.Pickup`, the leftover `packages/server/data/leaderboard.json` +
  its `.gitignore` entry, and 9 orphaned CSS recipes from the deleted 2D lobby/host screens.
- Verified: `pnpm -r typecheck` + `pnpm lint` clean · headless smoke (plaza bonk costs no HP → stage pick →
  start → golden-hammer event → fight → standings + structured awards → restart) · in-browser host+2 players
  (QR link → plaza → dress-up → stage picker → start → combat HUD → event banner → Results → restart), zero
  console errors.
- **Tests (vitest)**: `pnpm test` runs 109 colocated unit tests over the pure rules — shared math,
  `zoneRadiusAt`/`findStage`, enum + catalog consistency, `swingImpact`, `computeStandings`/`computeAwards`,
  `cleanName` + every Zod edge schema, `toWorld`, `parseJson`, the theme lookups. `pnpm test:e2e`
  (the `e2e/` workspace package) drives a real Host + 2 players through a full match loop.
  Two bugs fell out of writing them: `findStage("__proto__")` returned `Object.prototype`, and `cleanName`
  stripped tabs/newlines **before** collapsing whitespace, gluing "Ann<TAB>Lee" into "AnnLee".
- 📦 `refactor: split server sim + client HUD by responsibility, kill magic values`

## Post-05 presentation + spectator pass ✅

Owner-requested (2026-08): make it look and feel like the party game it is — a cover
screen, characters worth dressing up, a map worth fighting on, weather events, and
something real to do after you die.

- **Join flow**: `components/GameCover.tsx` — the mascot with a hammer, drawn as inline
  SVG (instant, crisp at any size, and it works on a room LAN with no network) and
  painted from the same swatches as the 3D characters. Shown on the join screen and,
  bobbing, on the loading splash. Name entry gained a 🎲 suggestion button
  (`NAME_SUGGESTIONS` in `config/copy.ts`).
- **Characters**: split into a RIG (`three/Character.tsx`) and a DRIVER
  (`three/PlayerAvatar.tsx`). Rounded modern-minimal proportions; joints pivot where a
  joint should be. Animations: distance-driven walk cycle, idle breathing, swing arc +
  a fading trail, hit squash + impact burst, death poof, ghost float. Every measurement
  comes from `RIG` in `config/view.ts` so cosmetics follow the body.
- **Camera → third person in every phase.** The match was first-person, which hid the
  entire character. Every player cam is now fixed-orientation behind the player, so
  `toWorld()` collapsed to ONE mapping (its test shrank with it).
- **Stage**: `StageConfig` gained `obstacles` (solid pillars/crates — collision circles
  pushed out by `pushOutOfObstacles`, called by BOTH the server step and the client
  prediction) and `decor` (counts for stands, columns, banners, torches, clouds; the
  colours stay on the client). The default stage is now a dressed arena.
- **Events**: `EventKind.Meteor` (a storm of telegraphed strikes — a floor marker for
  `METEOR.warnMs`, then AoE damage with linear falloff) and `EventKind.Rain` (the floor
  goes slick: knockback decay scaled by `RAIN.slipFactor`). Both run over time, so they
  get their own module, `server/game/hazards.ts`, plus a synced `hazards` map, a
  `weather` field and a `boom` broadcast.
- **Ghosts**: the dead stay in the world and keep driving (`driftGhost`). The living
  cannot see them at all; only the Host and other ghosts can. Their prank now targets
  the survivor they are floating NEAREST to, which is what makes ghost movement worth
  doing, and the buttons show the cooldown.
- **Host spectating**: `HostSpectateBar` — a free orbit cam, or a chase cam locked to any
  living player. The choice is local to that screen and never sent anywhere.
- **Tests**: `blastFalloff` and `pushOutOfObstacles` are pure, so they got unit tests
  (118 total); everything socket-shaped went into the e2e smoke, which now runs THREE
  players (a death has to leave two alive for a ghost to be observable at all) and
  asserts: cover is solid · rain flips the weather · meteors telegraph then land · a
  ghost still drifts · a ghost prank lands, respects its cooldown, and takes no kill ·
  restart clears the storm and the weather.
- Verified: `pnpm typecheck` + `pnpm lint` + `pnpm test` clean, `pnpm test:e2e` passes,
  and a live host+player browser run through plaza → match → meteor + rain with no
  console errors.
- ⚠️ The richer rig and dressed stage raise the draw-call count — the outstanding
  25-device load test matters more than it did.
- 📦 `feat(presentation): cover art, animated characters, dressed arena, weather events, ghosts`

## 🎉 All phases (00–05 + 3D-lobby refactor + architecture pass) complete — remaining work is event-day hardening (real 25-device load test, dress rehearsal, LAN fallback, reconnection on flaky wifi).

---

## 🚧 Phases 06–10 — replacing the procedural 3D with authored models (PLANNED, not started)

The owner rejected the hand-built character a third time. The conclusion is that primitives have a
ceiling — no hair, no cloth, no face — so characters, weapons, cosmetics and the map move to
**KayKit CC0 low-poly models**.

**The plan is written in full. Read it before scoping any of this:**
[docs/plans/phases-06-10-model-characters.md](../../../docs/plans/phases-06-10-model-characters.md)

- **06** — one KayKit character walking in-game, idle + walk only. The phase that finally answers
  "do 25 phones survive?". Nothing else changes and the server is not touched. **Start here.**
- **07** — combat animation, with the swing clip time-scaled to that hammer's `cooldownMs` so the
  visual contact frame lands on the server's hit.
- **08** — the wardrobe: add `characterIndex`, `hairIndex` becomes a colour, drop `faceIndex` and
  `backIndex`. First phase that changes the schema, so server clamping ships with a unit test.
- **09** — the arena, keeping `StageConfig.obstacles` in step with the new props (invisible-wall risk).
- **10** — delete the dead procedural code, tune draw calls, run the 25-device rehearsal.

⚠️ One decision is open and blocks Phase 06: where player colour lives once players pick a character
(recommended: characters keep their own colours, identity moves to the floor ring + nameplate).

---

## Guardrails

- **Front-load risk:** Phase 01 Movement must prove "25 phones walking smoothly." That's the gate.
- **Playable at every phase boundary.** No half-phase merges.
- **One commit per phase** (imperative summary). The repo owner runs git — hand over the command, no "Co-Authored-By: Claude".
- **No magic values in new code.** A compared string → `shared/enums.ts`; a simulation number → `shared/constants.ts`;
  a look-and-feel number → `client/config/view.ts`. See `game-architecture` for the full table.
- **A new rule ships with a test.** Put the decision in a pure function and unit-test it; leave sockets,
  rooms and canvases to `pnpm test:e2e` rather than mocking them.
- Phase 04-late and 05 are cut candidates near a deadline.

Full status: [docs/hammer-party-status.pdf](../../../docs/hammer-party-status.pdf).
