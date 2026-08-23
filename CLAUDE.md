# Hammer Party — project guide for Claude

Web PVP battle-royale **party game**. Players scan a QR (Kahoot-style, no app),
up to **25 per room**, hit each other with hammers until one survives. A big
screen shows the arena via the **Host**'s spectator cam. Built for company
monthly parties. **3D low-poly, mobile-first, realtime.**

Full status/roadmap: [docs/hammer-party-status.pdf](docs/hammer-party-status.pdf).

## ⚡ Load skills, don't re-derive (saves tokens)
Distilled project knowledge lives in `.claude/skills/`. Load only what a task needs:
- **`hammer-party-spec`** — the "what": numbers, combat, 3 hammers, stages, events, roles, awards.
- **`game-architecture`** — the "how": authoritative netcode, tech stack, monorepo, the "don't do this" rules.
- **`dev-roadmap`** — phases + **current status** + acceptance criteria + commit style.
- **`ui-conventions`** — the agreed look & wording: cartoon-minimal theme, cosmetics, splash, screen routing.

(Invoke via the Skill tool, or `Read` `.claude/skills/<name>/SKILL.md` directly.)

## ✅ Current status (2026-08)
- **Phase 00** (foundation) — done.
- **Phase 01** (Join · Lobby · Movement) — **done**.
  - join-by-code (QR → name only), Host role + Start, entry Splash, **cosmetics (color/hat/face/back)**, cartoon-minimal theme.
  - **Movement**: nipplejs joystick → authoritative 20Hz server movement → client interpolation
    (others) + prediction (self), name tags. Netcode in `client/src/net/movement.ts`.
  - **Lobby is now a walkable 3D plaza** (see the Post-05 refactor below) — the old 2D lobby card is gone.
- **Phase 02** (Combat) — **done**.
  - **First-person** player camera (host + dead players keep the free spectator orbit-cam).
  - Attack button + cooldown → **server** hit detection (reach + swing-arc cone), damage/HP,
    knockback (impulse + exp decay), heavy-hammer **stun**, death → spectator + **client-only ragdoll**,
    win (`alive==1`) → **Results** overlay, Host **Restart** (→ lobby), **reconnection**
    (`allowReconnection` + client `reconnect`). Combat FX (swing/hit) broadcast, not synced —
    see `client/src/net/combat.ts`.
- **Phase 03** (Arena · Zone · Weapons) — **done**.
  - **Stage-as-config** in `packages/shared/src/stages.ts` (`{radius, spawnRadius, zone, weaponSpawns, wallSlam, theme}`).
  - **Shrinking safe zone** (`zoneRadiusAt`, accelerates late) + out-of-zone HP bleed; **weapon pickups** (Fast/Heavy);
    **wall-slam**; **events** (Golden Hammer + Heal orbs, auto + Host-triggerable) with `eventBanner`.
- **Phase 04** (Juice · Cosmetics · Polish) — **done**.
  - **First-person retune** + **cosmetics on in-game avatars** (shared meshes in `client/src/three/cosmetics.tsx`, used by lobby + arena).
  - **Awards + full Results**: server tracks kills/damage/wall-slams/first-blood/survival → `GameState.awardsJson`;
    Results shows champion + funny award cards (Most Kills · First Blood · Longest Survivor · Pacifist · Most Wall-slams).
  - **Zod validation + name filter** (`packages/server/src/validate.ts`) — thin server-edge schemas + profanity mask.
  - **Dead-player prank throws** (banana slip / small bomb at a random survivor; harass, never kill) — `ClientMsg.Prank`.
  - **Self-hosted fonts** for offline: **Mali** (display) + **Sarabun** (body) in `client/public/fonts/` — the old `"Baloo Thai 2"`
    was a **nonexistent Google font** that silently fell back; picked Mali as the rounded Thai display font.
  - **SFX**: synthesized WebAudio (no assets, offline) — `client/src/audio.ts`. Verified with headless smokes + in-browser run.
  - ⚠️ Still owed (event hardening): a **real ~25-device load test** (fps/latency) and a full dress rehearsal + LAN fallback;
    reconnection is wired but untested on real flaky wifi.
- **Phase 05** (Post-event: multiple stages) — **done**.
  - **3 stages** in `packages/shared/src/stages.ts` (`colosseum`/`pit`/`grand`, each with its own radius/zone/pickups/wall-slam/theme);
    **Host picks the stage** in the lobby (`ClientMsg.SetStage`, host+lobby only) → server applies it in `beginMatch`; client renders per-theme colors (`STAGE_THEMES` in `GameScreen`).
- **Post-05 refactor** (Walkable 3D lobby + per-match results; **monthly leaderboard removed**) — **done**.
  - **Lobby = a live 3D plaza.** One unified world screen (`GameScreen`) drives every phase. In `lobby`: players spawn into a
    friendly plaza (`LOBBY_RADIUS`), walk (joystick, third-person cam) and **bonk each other — knockback + swing FX but ZERO HP loss**;
    a **"แต่งตัว"** bottom-sheet (`CustomizeSheet`) opens dress-up; a Ready toggle. **Players never see other players' names in the lobby** —
    just the room count (`X/25`). Host gets a spectator cam over the plaza + a QR/code/stage-picker/Start overlay (`HostLobbyOverlay`).
    Server: `updateLobby()` (movement + knockback, no zone/pickups/damage), `handleAttack` gated so damage/kills only fire in `playing`,
    `spawnLobbyPlayer()` on join/reset.
  - **Per-match Results only** (no persistence): server computes `GameState.standingsJson` (winner-first ranking) + keeps `awardsJson`;
    the redesigned `ResultsOverlay` shows standings + funny awards, closeable (dismiss is local — Host just leaves it up on the big screen).
  - **Deleted**: the monthly leaderboard end-to-end — `server/src/leaderboard.ts`, the `express` `/api/leaderboard` API,
    `client/src/components/Leaderboard.tsx`, `client/src/net/leaderboard.ts`, and **TanStack Query**. Also removed the old
    `LobbyScreen`/`HostScreen`/`CharacterPreview` (folded into the 3D world).
  - Verified in-browser: plaza HUD (no names, count) · customize sheet · Host QR/stage-picker/Start · plaza→combat→Results→restart loop.
- **All phases done** (00–05 + the 3D-lobby refactor). Remaining work is event-day hardening (25-device load test, dress rehearsal, LAN fallback).
- Styling is **Tailwind v4 + shadcn (Base UI)** — see `ui-conventions`.

## 🔑 Non-negotiable rules
- **`packages/shared/src/constants.ts` is the single source of truth** for every game value (HP, damage, tick, radius, cosmetic catalogs). Never hardcode a number elsewhere.
- **Server is authoritative** (20Hz). Clients send input only and never decide outcomes. Never trust the client.
- **No full networked physics/ragdoll.** Capsule movement + swing-angle hit checks + impulse knockback; death ragdoll is **client-only**, never synced.
- **Stack is locked:** TS · Vite+React 18 (not Next) · Three.js/@react-three/fiber/drei · Zustand · Colyseus/@colyseus/schema · nipplejs · qrcode.react · Zod (thin, server-side). Game + UI state all arrive via the Colyseus socket → Zustand. **No data-fetching lib** (TanStack Query was removed with the leaderboard) · no express (server runs a bare `http` server for the WS transport) · No Redux/tRPC.

## 🎨 Design & wording conventions (agreed with the owner)
- **Cartoon-minimal** visual style (bright sky, white rounded cards, chunky candy buttons, rounded Baloo Thai 2 font). NOT dark/fantasy. See `ui-conventions`.
- Say **"Host"** in UI copy — not "เจ้าภาพ".
- **Do not hard-code a map name** (e.g. "โคลอสเซียม") in UI — the game is a general "stage" system; future maps differ. Use generic copy.
- UI copy is Thai; technical terms stay English.

## Structure
```
packages/shared    # constants.ts (SOURCE OF TRUTH) · schema.ts · messages.ts · stages.ts   [@hammer/shared]
packages/server    # index.ts (bare http + define room) · rooms/GameRoom.ts · validate.ts   [@hammer/server]
packages/client    # screens/{Join,Game} · components/{Customizer,LobbyBar,CustomizeSheet,HostLobbyOverlay}  [@hammer/client]
                   # · three/cosmetics · net/{session,movement,combat} · store.ts · App.tsx · styles.css
docs/              # hammer-party-status.pdf · hammer-party-phases.pdf · plans/
.claude/skills     # hammer-party-spec · game-architecture · dev-roadmap · ui-conventions
```
Note: `GameScreen` is the single 3D world for **all** phases (lobby plaza · match · results); there is no separate Lobby/Host screen.

## Run it
```bash
pnpm install   # first time
pnpm dev        # server :2567 + client :5180 (parallel)
```
- Host screen: `http://localhost:5180/?host` · Player: `http://localhost:5180/?room=<CODE>` (or scan the QR).
- **pnpm 11 quirk:** native builds are approved via `onlyBuiltDependencies` (esbuild, msgpackr-extract) in `pnpm-workspace.yaml` — needed for vite/tsx to run.

## Conventions
- Package manager: **pnpm** workspaces. Package scope: **`@hammer/*`**.
- **The repo owner runs git commits/pushes themselves** — hand over the command, don't commit unless asked.
- **Do not add a "Co-Authored-By: Claude" trailer** to commits.
