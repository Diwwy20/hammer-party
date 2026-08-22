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
- **Phase 01** (Join · Lobby · Movement) — **Lobby slice done**, **Movement is the next piece**.
  - Done: join-by-code (QR → name only), Host role + Start, entry Splash, Lobby with a
    3D character, ready-toggle, roster, **cosmetics (color/hat/face/back)**, cartoon-minimal theme.
  - Not yet: virtual joystick + movement + 25-player synced walking (the #1 risk → load-test it).
- **Phase 02–05** — not started.

## 🔑 Non-negotiable rules
- **`packages/shared/src/constants.ts` is the single source of truth** for every game value (HP, damage, tick, radius, cosmetic catalogs). Never hardcode a number elsewhere.
- **Server is authoritative** (20Hz). Clients send input only and never decide outcomes. Never trust the client.
- **No full networked physics/ragdoll.** Capsule movement + swing-angle hit checks + impulse knockback; death ragdoll is **client-only**, never synced.
- **Stack is locked:** TS · Vite+React 18 (not Next) · Three.js/@react-three/fiber/drei · Zustand · Colyseus/@colyseus/schema · nipplejs (planned) · qrcode.react · Zod (thin, server-side). No TanStack/Redux/tRPC until a Phase 05 DB leaderboard.

## 🎨 Design & wording conventions (agreed with the owner)
- **Cartoon-minimal** visual style (bright sky, white rounded cards, chunky candy buttons, rounded Baloo Thai 2 font). NOT dark/fantasy. See `ui-conventions`.
- Say **"Host"** in UI copy — not "เจ้าภาพ".
- **Do not hard-code a map name** (e.g. "โคลอสเซียม") in UI — the game is a general "stage" system; future maps differ. Use generic copy.
- UI copy is Thai; technical terms stay English.

## Structure
```
packages/shared    # constants.ts (SOURCE OF TRUTH) · schema.ts · messages.ts   [@hammer/shared]
packages/server    # index.ts (define room + filterBy code) · rooms/GameRoom.ts  [@hammer/server]
packages/client    # screens/{Join,Lobby,Host,Game} · components/Customizer      [@hammer/client]
                   # · three/CharacterPreview · net/session · store.ts · App.tsx · styles.css
docs/              # hammer-party-status.pdf · plans/
.claude/skills     # hammer-party-spec · game-architecture · dev-roadmap · ui-conventions
```

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
