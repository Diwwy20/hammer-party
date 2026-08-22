---
name: game-architecture
description: Technical architecture, netcode model, tech-stack decisions, and monorepo layout for Hammer Party. Load before writing or reviewing any client/server/shared code, wiring Colyseus rooms, R3F rendering, or netcode — it encodes the authoritative-server model, the 20Hz/100ms interpolation contract, and the hard "do NOT do this" rules (no networked ragdoll, don't trust the client).
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
- **Client interpolation**: render *other* players ~100 ms in the past; light prediction on your own avatar.

## ⚠️ Pitfalls — do NOT do these
- ❌ **No full networked physics/ragdoll.** For 25 players it's heavy and crash-prone. Instead:
  character = **capsule** (position/velocity) · attack = **swing-angle check** · knockback = **impulse (decay)** ·
  death ragdoll = **client-only visual, never synced**.
- ❌ **Never trust the client.** Validate incoming input server-side (Zod, thin). Resolution stays on the server.
- ❌ **No physics/ragdoll fields in the synced schema.** Only sync what clients must agree on: positions, HP, hammer, phase, zone, cosmetics, code, hostSessionId.

## Room / matchmaking (implemented)
- Room name `"game"`, registered with **`.filterBy(['code'])`** so a room code routes players to the right room.
- **Host**: `client.create("game", { asHost:true, code })` — a fresh room; host is NOT a player, not in `state.players`, not counted, and the only one allowed to `Start`. Host leaving clears `hostSessionId`.
- **Player**: `client.join("game", { name, code })` — joins the Host's room by code (errors if none). Player cap = `MAX_PLAYERS`; host occupies an extra connection slot.

## Tech stack & the reasons
- **TypeScript** across client+server+shared → shared state/message types.
- **React 18 + Vite** (NOT Next): 3D renders on client, no SEO, realtime needs a long-lived Colyseus WS server anyway.
- **Three.js + @react-three/fiber + drei** — declarative 3D per device.
- **Zustand** — game/UI state (see `client/src/store.ts`).
- **Colyseus + @colyseus/schema** — rooms/codes, authoritative sync, binary delta.
- **colyseus.js + interpolation** — receive state → delay ~100ms → draw (`client/src/net/session.ts`).
- **nipplejs** (planned, movement) · **qrcode.react** (Host QR) · **Zod** (thin server input validation, planned).
- **glTF `.glb`** assets later; cosmetics are currently procedural low-poly meshes.
- **Not used:** TanStack/Redux/tRPC/react-hook-form (state arrives via socket). Add TanStack Query only for a Phase 05 DB leaderboard.

## Monorepo layout (pnpm workspaces, scope `@hammer/*`)
`shared/` is the heart — client and server share one set of types & values.
```
packages/
├─ shared/src/   constants.ts (HP/dmg/tick/radius + cosmetic catalogs) · schema.ts · messages.ts
│                (schema is a subpath "@hammer/shared/schema"; index exports constants + messages only,
│                 so the CLIENT doesn't bundle @colyseus/schema — it decodes state via reflection)
├─ server/src/   index.ts (define room + filterBy code) · rooms/GameRoom.ts (join/host/ready/cosmetic/start)
└─ client/src/   screens/{Join,Lobby,Host,Game} · components/Customizer · three/CharacterPreview
                 · net/{client,session} · store.ts · App.tsx (phase router) · styles.css
```
**Rule:** all tunable game values live in `shared/constants.ts`. Never duplicate a number.

## Colyseus schema gotcha (already handled in schema.ts)
Schema fields use `declare` + constructor assignment (not class-field initializers) so
`defineTypes` change-tracking accessors aren't shadowed. Keep that pattern when adding fields.

Full status & roadmap: [docs/hammer-party-status.pdf](../../../docs/hammer-party-status.pdf).
