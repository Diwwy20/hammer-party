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
- ⚠️ **Still owed (event-day hardening):** a real ~25-device load test (fps/latency), a full dress
  rehearsal + LAN fallback, and reconnection tested on genuinely flaky wifi.
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
                        · stages.ts · messages.ts (wire contract) · schema.ts (subpath export)
packages/server/src     index.ts (bootstrap) · config.ts · logger.ts
                        · rooms/GameRoom.ts   — Colyseus adapter: connections + validated routing ONLY
                        · net/validate.ts     — Zod edge schemas + name filter
                        · game/               — the authoritative game, no networking in it:
                            simulation.ts (MatchSimulation) · context.ts (SimContext, server-only state)
                            combat.ts · movement.ts · pickups.ts · events.ts · spawn.ts
                            cosmetics.ts · results.ts (pure ranking rules)
packages/client/src     App.tsx (routing) · store.ts (mirror + selectors) · audio.ts · styles.css
                        · config/{view,theme,copy}.ts   — presentation tuning · palettes · Thai copy
                        · net/{config,client,session,movement}.ts
                        · runtime/{combatFx,localPlayer,input}.ts — per-frame state outside React
                        · three/{World,Arena,Pickups,PlayerAvatar,useSelfControl,cosmetics,types}
                        · components/{LobbyBar,CustomizeSheet,Customizer,HostLobbyOverlay}
                        · components/hud/{Joystick,AttackButton,KeyboardControls,MatchHud,
                                          EventBanner,HostEventBar,PrankBar,ZoneWarning,ResultsOverlay}
                        · screens/{JoinScreen,GameScreen}
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
- **pnpm 11 quirk:** native builds are approved via `onlyBuiltDependencies` (esbuild, msgpackr-extract) in
  `pnpm-workspace.yaml` — needed for vite/tsx to run.

## Testing

```bash
pnpm test        # vitest — the PURE rules (swing cone, zone curve, standings/awards, cleanName, schemas, math)
pnpm test:e2e    # full loop against a RUNNING server (`pnpm dev:server` first)
```

- Unit tests are colocated: `src/foo.ts` ← `src/foo.test.ts`. Config: `vitest.config.mts` (one run for the
  whole monorepo).
- **Only pure functions get unit tests.** Anything needing a live socket, a Colyseus room or WebGL is covered
  by `packages/server/scripts/smoke-e2e.ts` instead — mocking it would only test the mocks.
- New rule → put the decision in a pure function, then test it. That's why `results.ts`, `swingImpact` and
  `zoneRadiusAt` are shaped the way they are.

## Conventions

- Package manager: **pnpm** workspaces. Package scope: **`@hammer/*`**.
- **The repo owner runs git commits/pushes themselves** — hand over the command, don't commit unless asked.
- **Do not add a "Co-Authored-By: Claude" trailer** to commits.
