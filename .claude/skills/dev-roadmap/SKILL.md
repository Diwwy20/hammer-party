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
- Lobby: 3D character (drag-rotate), Ready toggle, roster (shows `👥 ในห้อง X/25`, not your own chip).
- **Cosmetics**: color(8)/hat(6)/face(5)/back(5), rendered on the character, server-authoritative + clamped.
- Start match → `phase="playing"` → everyone routes to GameScreen.
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
- **Cosmetics finished**: shared procedural meshes in `client/src/three/cosmetics.tsx` (`Hat/Face/Back/AvatarBody`), used by both the lobby `CharacterPreview` and the arena avatars (first-person eye height retuned to the full-size body).
- **Awards**: server tracks kills (`Player.kills`) + damage/wall-slams/first-blood/survival (server-only), computes 5 awards at end → `GameState.awardsJson`; Results overlay renders champion + award cards.
- **Zod + name filter**: `packages/server/src/validate.ts` — thin `safeParse` on input/ready/cosmetic/event/prank + `cleanName` (control-strip, clamp, profanity mask). `zod` added to `@hammer/server`.
- **Pranks**: dead players lob banana (slip)/bomb (small dmg, floored so never lethal) at a random survivor — `ClientMsg.Prank`, `ServerMsg.Prank` FX. Buttons show for dead players.
- **Fonts self-hosted** in `client/public/fonts/` (+ `public/fonts.css`, linked from `index.html`): **Mali** (display) + **Sarabun** (body). ⚠️ `"Baloo Thai 2"` was never a real Google font — it silently fell back; Mali chosen as the rounded Thai display face (owner deferred the pick).
- **SFX**: synthesized WebAudio in `client/src/audio.ts` (no asset files → offline).
- Verified: headless smokes (pranks: only-dead-can-throw + harass-not-kill; awards populate with correct winners) + in-browser run (fonts load, name masked, no console errors).
- ⚠️ **Still owed (do at the event):** a real ~25-device load test (fps/latency) + full dress rehearsal + LAN fallback; reconnection untested on flaky wifi. glTF models skipped (procedural is fine).
✅ Done when a match plays to Results with awards; cosmetics show in-arena; the build runs offline.

## Phase 05 — Post-event ✅
New stages via config; DB stats + monthly leaderboard (TanStack Query enters here).
- **3 stages** (`colosseum`/`pit`/`grand`) in `shared/src/stages.ts` — each with its own radius/zone/weaponSpawns/wallSlam/`label`/theme; `STAGE_ORDER` drives picker order.
- **Host stage picker** in the lobby: `ClientMsg.SetStage` (host + lobby only, Zod-checked) → server sets `selectedStageId`, applied in `beginMatch`; lobby shows it via synced `GameState.stageId`. Client theme colors in `GameScreen`'s `STAGE_THEMES` (visual only).
- **Leaderboard**: match results appended to `packages/server/data/leaderboard.json` (git-ignored) by `server/src/leaderboard.ts` (flat file, aggregate-by-name — no native DB, works offline); served by **express** at `GET /api/leaderboard` (+ `/api/health`) on the Colyseus port (`server/src/index.ts`). Client fetches with **TanStack Query** (`components/Leaderboard.tsx`, shown on the Host lobby) via `HTTP_URL` in `net/client.ts`. `QueryClientProvider` wraps App in `main.tsx`.
- Verified: headless smoke (host picks `grand` → radius 30 applies → match plays to end → row written; `/api/leaderboard` aggregates) + in-browser (picker + standings render, click-to-pick round-trips).
- ⚠️ TanStack is allowed ONLY here (leaderboard) — game state still flows Colyseus → Zustand. Leaderboard aggregates by display name (no accounts).
✅ Done when the Host can pick a stage and the monthly leaderboard updates after matches.

## 🎉 All phases (00–05) complete — remaining work is event-day hardening (real 25-device load test, dress rehearsal, LAN fallback, reconnection on flaky wifi).

---

## Guardrails
- **Front-load risk:** Phase 01 Movement must prove "25 phones walking smoothly." That's the gate.
- **Playable at every phase boundary.** No half-phase merges.
- **One commit per phase** (imperative summary). The repo owner runs git — hand over the command, no "Co-Authored-By: Claude".
- Phase 04-late and 05 are cut candidates near a deadline.

Full status: [docs/hammer-party-status.pdf](../../../docs/hammer-party-status.pdf).
