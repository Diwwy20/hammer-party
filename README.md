# 🔨 Hammer Party

PVP hammer battle-royale **party game** — scan a QR, play on your phone in the browser, last one standing wins. Authoritative **Colyseus** server + per-device **React Three Fiber** 3D clients. Built for the monthly company party (up to 25 players / room).

See the design doc (`hammer-party-gdd`) for the full vision. This repo follows the phased roadmap; we're at **Phase 00**.

## Structure (pnpm monorepo)

```
packages/
  shared/   # @hammer/shared — types + game constants + Colyseus schema (the single source of truth)
  server/   # @hammer/server — Colyseus authoritative game server (Node + TS, tsx)
  client/   # @hammer/client — React + Vite + R3F (renders 3D on each device)
```

`shared/` is the heart: change a damage number or HP once and both sides agree.

## Requirements

- Node **>= 20** (tested on 22)
- pnpm **>= 9** (`corepack enable` gives you the pinned version)

## Getting started

```bash
pnpm install
pnpm dev
```

- Client: http://localhost:5173
- Server: ws://localhost:2567

Open the client in **two browser tabs** — each becomes a box on the arena floor, proving the room state syncs across devices. On the same Wi‑Fi, phones can reach `http://<your-lan-ip>:5173` (the server URL auto-derives from the page host; override with `VITE_SERVER_URL`).

## Scripts

| Command | What |
| --- | --- |
| `pnpm dev` | run server + client together |
| `pnpm dev:server` / `pnpm dev:client` | run one side |
| `pnpm typecheck` | type-check every package |
| `pnpm lint` / `pnpm format` | ESLint / Prettier |

## Phase 00 — done when

- ✅ `pnpm dev` starts both apps
- ✅ client connects to an empty Colyseus room (see the HUD status turn green)
- ✅ an empty 3D arena renders with a floor
- ✅ opening a second tab adds a second box (shared state works)

Next: **Phase 01** — Join · Lobby · synced movement for 25 players (the big risk).
