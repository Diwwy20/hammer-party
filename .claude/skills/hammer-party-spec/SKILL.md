---
name: hammer-party-spec
description: Condensed game-design spec for Hammer Party (the "what") — core numbers, combat rules, the 3 hammers, the stage system, random events, roles (player/Host/dead), win conditions and awards. Load before designing, implementing, or testing any gameplay feature so you get the design intent and exact tuning values without re-deriving them.
---

# Hammer Party — Gameplay Spec (condensed)

Web PVP battle-royale party game. Scan a QR (Kahoot-style, no app install), up to
**25 players/room** hit each other with hammers until one survives. Runs at company
monthly parties; a big screen shows the arena via the **Host**'s spectator camera.
Match length **15–20 min**; the shrinking zone forces a finish, and `MATCH_MAX_MINUTES`
is a hard failsafe cap (the healthiest survivor wins if it is ever reached).
Style **3D low-poly, cartoon**.

> **Ratios matter more than exact numbers.** HP/damage get co-tuned in playtests.
> Read every value from `packages/shared/src/constants.ts`, and every compared name
> (phase / hammer / pickup / event / prank / stage / award) from
> `packages/shared/src/enums.ts` — never hardcode either.

## Core numbers (source of truth = shared/constants.ts)

| Value            | Number    | Value         | Number  |
| ---------------- | --------- | ------------- | ------- |
| Max players/room | 25        | HP per player | ~600    |
| Hammer types     | 3         | Server tick   | 20 Hz   |
| Match length     | 15–20 min | Interpolation | ~100 ms |

## Combat

- **High HP (~600)** on purpose → long matches. Prevent dragging with the shrinking zone (accelerates late) + wall/trap damage.
- **Hit detection = radius + swing-angle check**, NOT full physics collision. Light and accurate enough for 25 players.
- **Knockback** on every hit; heavier hammer pushes farther.
- **Wall-slam**: knocked into a hazard wall = extra damage + brief stun.
- **Stun**: heavy hammer briefly freezes the target.

## Hammers (everyone starts with Medium; Fast & Heavy are map pickups)

| Hammer | Damage   | Feel                           | Source                |
| ------ | -------- | ------------------------------ | --------------------- |
| Fast   | 2 / hit  | rapid, fast, low knockback     | map pickup            |
| Medium | 5 / hit  | balanced                       | starting weapon (all) |
| Heavy  | 20 / hit | big swing, far knockback, slow | map pickup            |

Why not all 3 up front: forces contested pickups + risk decisions, makes Heavy valuable.

## Stages — a general "stage system" (do NOT hard-code a map name)

Closed arena with hazards + a floor that shrinks to force the game to end. The
first playtest stage is a colosseum-style ring, but the game is designed so **new
stages differ** (rooftop/forest/factory/spaceship). The shared combat core (hammer ·
HP · knockback) is reused across all stages; a new stage only changes **layout,
hazards, theme**. Model a stage as config `{ radius, hazards, spawns, theme }` (Phase 03).
UI copy stays generic — never bake a specific arena name into the interface.

Hazards: hazard walls (wall-slam = extra dmg + stun), shrinking floor (edges become
lava/electric, squeezes to center, accelerates late), meteor strikes.

**Solid cover** (`StageConfig.obstacles`): pillars and crates, each a collision
CIRCLE both sides push players out of (`pushOutOfObstacles` in `shared/stages.ts`).
Cover is gameplay — the server clamps and the client's prediction runs the identical
function, so what you can hide behind is exactly what you see.

**Dressing** (`StageConfig.decor`): counts only — stands, columns, banners, torches,
clouds. Layout data lives with the stage; the COLOURS live on the client
(`config/theme.ts`), so a stage redresses itself by changing numbers.

## Random events (keep few — played monthly; only high-value)

Shipped (`EventKind`, each also fires on a timer — `AUTO_EVENT_AT_MS`):

| Event      | What it does                                                                                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Golden** | one ~one-shot hammer spawns dead centre; the whole room fights over it                                                                                        |
| **Heal**   | a ring of heal orbs appears                                                                                                                                   |
| **Meteor** | a storm of TELEGRAPHED strikes — a marker sits on the floor `METEOR.warnMs` before impact, then AoE damage + knockback with linear falloff to the rim         |
| **Rain**   | the floor goes slick for `RAIN.durationMs`: knockback decay is scaled by `RAIN.slipFactor`, so one hit slides you much further (and possibly out of the zone) |

Meteor + rain run over TIME, so they are advanced tick-by-tick in `server/game/hazards.ts`
rather than being fire-and-forget like the pickup events. Every strike is telegraphed
on purpose: getting hit must always be a decision you made.

Ideas not built: speed buff, low gravity, comeback buff for the lowest-HP player.
Host can trigger any event by hand.

## Roles

- **Player**: cosmetic-only customization (no stat effect) — for photos & finding yourself. Five slots
  (shirt colour, hair, hat, face, back), picked in the dressing room. The hammer grid there is a PREVIEW:
  hammers are picked up in the arena, so choosing one in the wardrobe would be a stat, not a cosmetic.
- **Host (invisible)**: the big screen. Two cameras: a free orbit cam over the whole
  arena, or a chase cam locked to any LIVING player (`spectateId`, local to that screen —
  never sent anywhere). Ghosts are deliberately not offered: the show is the fight.
  Picks the stage, triggers events, presses Start. Not counted as a player.
- **Dead player → a GHOST, still in the world.** They keep their stick and drift around
  the arena (`GHOST.speedFactor`, may wander `GHOST.wanderMarginM` past the wall). The
  LIVING cannot see them at all; only the Host and other ghosts can. They have no hammer,
  take no zone damage and pass through cover. What they can do is lob pranks — at the
  survivor they are floating NEAREST to, which is what makes ghost movement worth doing —
  on a `PRANK.cooldownMs` gate, floored at `PRANK.minHpAfterBomb` so a spectator can
  harass but never take a kill. Nobody sits idle.
- **Results**: final standings (winner-first) + funny awards — Most Kills · First Blood · Longest Survivor ·
  Pacifist · Most Wall-slams. Per-match only, **not persisted** (the Host leaves it up on the big screen;
  there's no monthly leaderboard). The server decides WHO won each award (`AwardKind` + a number); the client
  owns the icon and Thai wording (`client/src/config/copy.ts`).

## Game flow

Scan QR / enter code → **Splash (loading)** → **Lobby = a walkable 3D plaza** (walk + bonk with no HP loss, dress up, ready-up, wait for Host)
→ Host starts → fight, floor shrinks → last one standing → Results.
**Dead players never leave** — they become ghosts (see Roles) and keep playing their own game.

Full status & roadmap: [docs/hammer-party-status.pdf](../../../docs/hammer-party-status.pdf).
