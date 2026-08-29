# 🔨 Hammer Party

PVP hammer battle-royale **party game** — scan a QR, play on your phone in the browser, last one standing wins. Authoritative **Colyseus** server + per-device **React Three Fiber** 3D clients. Built for the monthly company party (up to 25 players / room).

Players gather in a walkable 3D plaza, dress up and bonk each other for fun (no damage) while the **Host** picks a stage on the big screen. On Start, everyone drops into the arena: hammers, knockback, wall-slams, weapon pickups and a shrinking safe zone until one player is left — then a standings + awards screen the Host leaves up for the room.

## Structure (pnpm monorepo)

```
packages/
  shared/   # @hammer/shared — enums, constants, math, wire messages, stage data, Colyseus schema
  server/   # @hammer/server — authoritative game server (thin Colyseus room + a game/ simulation layer)
  client/   # @hammer/client — React + Vite + R3F (one live 3D world for lobby, match and results)
```

`shared/` is the heart: change a damage number or a phase name once and both sides agree.
Project guide for contributors (and for Claude Code): [CLAUDE.md](CLAUDE.md) · deeper notes in `.claude/skills/`.

## Requirements

- Node **>= 20** (tested on 22)
- pnpm **>= 9** (`corepack enable` gives you the pinned version)

## Getting started

```bash
pnpm install
pnpm dev
```

- Big screen / Host: http://localhost:5180/?host → creates a room and shows the join QR + code
- Player: http://localhost:5180/?room=CODE (or just scan the QR)
- Server: ws://localhost:2567 (health check at `/api/health`)

On the same Wi-Fi, phones can reach `http://<your-lan-ip>:5180` — the server URL auto-derives from the page host (override with `VITE_SERVER_URL`). Everything is self-hosted (fonts included) so it runs on an event LAN with no internet.

## Scripts

| Command                               | What                                      |
| ------------------------------------- | ----------------------------------------- |
| `pnpm dev`                            | run server + client together              |
| `pnpm dev:server` / `pnpm dev:client` | run one side                              |
| `pnpm test`                           | run the unit suite (vitest)               |
| `pnpm test:watch`                     | vitest in watch mode                      |
| `pnpm test:e2e`                       | end-to-end smoke against a running server |
| `pnpm typecheck`                      | type-check every package                  |
| `pnpm lint` / `pnpm format`           | ESLint / Prettier                         |
| `pnpm build`                          | build every package                       |

## Testing

Two layers, on purpose:

- **`pnpm test`** — vitest over the **pure** rules: the swing cone, the zone curve, standings and
  awards, name sanitising, the Zod edge schemas, and the shared math. No mocks, no sockets, no canvas:
  every one of these is a function from plain inputs to a plain answer.
- **`pnpm test:e2e`** — one full loop against a **real** server (start it with `pnpm dev:server` first):
  plaza bonks cost no HP → stage picker → match → event → a real death → standings + awards → restart.
  This covers the wiring that unit tests deliberately don't.

Anything that needs a live socket, a Colyseus room or WebGL is covered by the smoke rather than mocked —
mocking it would only test the mocks.

## House rules

- **No magic values.** A number the simulation reads goes in `shared/src/constants.ts`; a string that gets
  compared goes in `shared/src/enums.ts`; look-and-feel tuning goes in `client/src/config/`.
- **The server is authoritative.** Clients send intent only; the server decides every outcome and re-validates
  every message at the edge.
- **The server never sends UI text.** It publishes facts (an event kind, an award kind + value) and the client
  owns the wording.

## Status

All planned phases are complete (join · plaza lobby · movement · combat · arena/zone/weapons · juice & awards · 3 stages · per-match results). What's left is event-day hardening: a real ~25-device load test, a dress rehearsal, a LAN fallback, and reconnection tested on genuinely flaky wifi. See `.claude/skills/dev-roadmap/SKILL.md`.
