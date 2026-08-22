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

## → NEXT: Phase 02 (Combat)

## Phase 02 — Combat ⬜ — kill + the game can end
Medium hammer + attack input + cooldown · server hit detection (radius/angle) · damage/HP · knockback (impulse+decay) · stun · death → spectator + client-only ragdoll · win `alive==1` → Results · reconnection · Host free-cam + quick Restart.
✅ Done when a full match plays to the end; dropping and reconnecting works.

## Phase 03 — Arena · Zone · Weapons ⬜
Real arena + hazard walls · shrinking zone (out-of-zone damage, accelerates to force finish ~20 min) · Fast/Heavy hammer pickups · 2–3 random events + Host trigger · model a **stage as config** `{radius, hazards, spawns, theme}` for future maps.

## Phase 04 — Juice · Cosmetics · Polish ⬜
Finish cosmetics (glTF?), full Results/awards, Zod input validation + name filter, dead-player prank throws, SFX, **self-host fonts for offline**, full 25-device dress rehearsal + event-day fallback (LAN, quick restart).

## Phase 05 — Post-event (optional, cut if short on time) ⬜
New stages via config; DB stats + monthly leaderboard (TanStack Query enters here).

---

## Guardrails
- **Front-load risk:** Phase 01 Movement must prove "25 phones walking smoothly." That's the gate.
- **Playable at every phase boundary.** No half-phase merges.
- **One commit per phase** (imperative summary). The repo owner runs git — hand over the command, no "Co-Authored-By: Claude".
- Phase 04-late and 05 are cut candidates near a deadline.

Full status: [docs/hammer-party-status.pdf](../../../docs/hammer-party-status.pdf).
