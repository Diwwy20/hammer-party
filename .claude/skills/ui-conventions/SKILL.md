---
name: ui-conventions
description: The agreed UI look, wording, and front-end structure for Hammer Party — cartoon-minimal theme tokens, where presentation tuning/palettes/Thai copy live, the cosmetic system, the splash/loading flow, and the phase-based screen routing. Load before touching any client screen, styles.css, copy, or the character/cosmetics so you match decisions already made with the owner (and don't reintroduce the old dark theme, "เจ้าภาพ", a fixed map name, or hardcoded colours and copy).
---

# Hammer Party — UI Conventions (decided with the owner)

## Visual style — cartoon minimal (locked)

Bright, friendly, uncluttered. **NOT** the old dark/fantasy gold theme (removed).

- **Background:** light sky gradient + soft white bubbles.
- **Cards:** white, big rounded corners (22px), soft shadow, 2px light border.
- **Buttons:** chunky "candy" style with a **bottom lip** (`box-shadow: 0 5px 0 <darker>`), press = `translateY(4px)`.
- **Fonts:** display/headings/buttons = **Mali** (rounded, bold; Thai+Latin); body = **Sarabun**. **Self-hosted**
  for offline in `client/public/fonts/` (+ `public/fonts.css`, linked from `index.html`). NB: the earlier
  `"Baloo Thai 2"` was never a real Google font (silent fallback) — Mali replaced it. `--font-display`/`--font-body`
  tokens live in `styles.css` `@theme`.
- **Swatches:** glossy colored balls. **Tabs:** rounded pills.

## Styling stack — Tailwind v4 + shadcn (Base UI)

The whole client is **Tailwind CSS**. `styles.css` holds only:

- `@theme { … }` — design tokens as Tailwind theme → utilities `bg-blue`/`text-ink`/`border-line`/`bg-surface`/
  `rounded-card`/`rounded-btn`/`font-display`/`shadow-soft`/`animate-bob` (colors `--color-*`, radii `--radius-*`).
- `@layer components { … }` — `@apply` recipes for the repeated atoms (`.screen`, `.panel`, `.btn`+variants,
  `.pill`, `.chip`, `.input`, `.opt`, `.tab`, `.hero-title`, `.customizer`, `.hud`, `.progress`,
  `.lobby-*`, `.sheet*`, `.host-overlay*`, …). Exotic bits (gradients, `-webkit-text-stroke`, the button lip,
  `::before` bubbles) stay raw inside those recipes.
- `@keyframes bob` and the shadcn token blocks (`:root`, `.dark`, `@theme inline`, `@layer base`).

**How to style going forward:**

- New UI → **Tailwind utility classes in JSX** (prefer this). Repeated atoms → an `@apply` recipe.
- **No inline `style={}`** except genuinely dynamic values (a per-item colour from `PLAYER_COLORS`, a progress
  width %, the swatch gradient). Even then the colour itself comes from `config/theme.ts`, never a literal hex.
- Prettier + `prettier-plugin-tailwindcss` auto-sorts classes on format (`tailwindStylesheet` → `styles.css`).
- shadcn (Base UI, **not Radix**) is set up: add components with `pnpm dlx shadcn@latest add <name>`; base button
  at `components/ui/button.tsx`, `cn()` at `lib/utils.ts`, config in `components.json`. Alias `@/*` → `src/`.

> ⚠️ Class names are legacy tokens — `btn--gold` is now **blue** (primary), `btn--jade` = green (ready),
> `btn--danger` = coral. **Don't rename them.** shadcn writes its radius scale off `--radius: 22px` — keep it.
> Recipes belonging to the deleted 2D lobby/host screens (`.roster-strip*`, `.stage*`, `.card*`, `.grid-cards`,
> `.actionbar`, `.divider`, `.status-line`, `.screen__scroll`, `.spin`) have been removed — don't reintroduce them.

## Where a front-end value lives (no magic values)

| Kind                                                                           | Home                                           |
| ------------------------------------------------------------------------------ | ---------------------------------------------- |
| camera framing, animation lengths, HUD poll rates, sizes                       | `client/src/config/view.ts`                    |
| stage palettes, pickup styles, weapon/world colours, HP-bar colours            | `client/src/config/theme.ts`                   |
| Thai copy used by 2+ components (events, pranks, awards, tips, connect errors) | `client/src/config/copy.ts`                    |
| server URL, reconnect policy, `?room=`/`?host` param names, join-link builder  | `client/src/net/config.ts`                     |
| anything the SIMULATION reads                                                  | `@hammer/shared` (`constants.ts` / `enums.ts`) |

One-off copy stays inline in the component that renders it. **The server never sends UI text** — it publishes
an `EventKind` / `AwardKind` and the client looks up the wording.

## Wording (locked)

- Say **"Host"** in copy — never "เจ้าภาพ".
- **Never hard-code a map name** ("โคลอสเซียม" etc.) — the game is a general stage system; use generic copy
  (e.g. the tagline "ทุบให้เหลือคนสุดท้าย!").
- UI copy is Thai; technical terms stay English.
- **Players never see other players' names in the lobby** — the plaza HUD (`LobbyBar`) shows only the room
  count `👥 X/25`. (They meet everyone in-match.)

## Screen routing (`client/src/App.tsx`)

Driven by the store (`conn`, `booted`) — the GAME phase is handled inside `GameScreen`:

- `Conn.Idle` → **JoinScreen** — the **cover art** (`components/GameCover.tsx`) first, then ONE thing to do:
  type a name (with a 🎲 suggestion button) and play. A code scanned from the QR shows as a chip, not a field,
  because the player never had to type it. `?host` → Host mode.
- `Conn.Error` → **ErrorScreen**
- `Conn.Connecting || !booted` → **SplashScreen** — the same cover art, bobbing, over a progress bar that
  eases up; `booted` after `SPLASH.handoffMs`
- open + booted → **GameScreen** — the single 3D world for **every** phase (host + player).

`GameScreen` is composition only. It mounts overlays by phase; each overlay owns its own state:

- `lobby` player → `LobbyBar` + `CustomizeSheet`; `lobby` host → `HostLobbyOverlay` (QR/code/stage-picker/Start)
- `playing` → `Joystick` + `KeyboardControls` + `MatchHud` + `ZoneWarning`, plus `AttackButton` only
  while you are ALIVE. A dead player keeps the stick (they are a ghost, still flying around) and swaps
  the hammer for `PrankBar`; the Host gets `HostEventBar` + `HostSpectateBar`.
- `ended` → `ResultsOverlay` (standings + awards, closeable — dismiss is local only)
- any phase → `EventBanner` when `activeEvent` is set

Controls: touch (`Joystick`) and desktop (`KeyboardControls`, WASD/arrows + Space) write the SAME screen-space
vector; `runtime/input.ts` `toWorld()` is the one place that converts it to world space.

**The camera is third-person and fixed-orientation in every phase** (plaza · match · ghost): behind the
player, looking toward +z, never rotating with their facing. So `toWorld()` has exactly one mapping and the
stick never changes meaning — and, just as importantly, players can actually SEE their own character, outfit,
swing and the hits they take. Do not put the match back into first person.

## Cosmetics (client + server)

- Catalogs in `shared/constants.ts`: `PLAYER_COLORS` (hex[]), `HATS`/`FACES`/`BACKS` (`{id,label,icon}[]`,
  index 0 = none). Ids come from `HatId`/`FaceId`/`BackId` in `shared/enums.ts`. Slots on `Player`:
  `colorIndex, hatIndex, faceIndex, backIndex` (`CosmeticSlot` names them).
- **Picker:** `client/src/components/Customizer.tsx` — a tab per slot → `sendCosmetic({ [slot]: index })`.
- **Server** clamps each index to its catalog (`server/src/game/cosmetics.ts`). The client renders the echo,
  so there is no local "pending" copy to drift.
- **3D render:** `client/src/three/cosmetics.tsx` — `AvatarBody` + procedural low-poly meshes switched by id.
  The **same** `AvatarBody` draws plaza and arena avatars, so a dress-up edit shows up in-world immediately.
- **To add a cosmetic option:** add the id to the matching enum in `shared/enums.ts`, append to the catalog in
  `constants.ts`, **and** add a `case <Enum>.<Id>` mesh in `three/cosmetics.tsx`. The server clamp follows
  automatically (it reads `.length`).

## Character — a cute rig, not a blob

Modern-minimal and chunky (the Stumble Guys / Peak register the owner asked for): a big round head, a
rounded "bean" torso tinted by `colorIndex`, stubby capsule limbs with ball hands and feet, and two beady
eyes with a highlight. Split across two files on purpose:

- **`three/Character.tsx`** — the RIG. Parts that move are separate groups pivoted at a real joint (hips,
  shoulders, neck) and handed out as `CharacterHandles`. It knows nothing about the game.
- **`three/PlayerAvatar.tsx`** — the DRIVER. Walk cycle, idle breathing, swing, hit squash, ghost float and
  the death poof, all read off motion and broadcast timestamps.

Every measurement — body parts, hats, glasses, backpacks, the held hammer — comes from **`RIG`** in
`config/view.ts`. Never hard-code a height in a mesh: re-proportioning the character must take its hat with it.

The walk cycle is driven by **distance travelled**, not a timer, so the legs match the real speed whether the
player is walking, being interpolated, or sliding across a rain-slicked floor after a hit.

**Ghosts** (dead players) reuse the same rig with `ghost` set: pale, see-through, no legs (a wisp instead),
no hammer, floating and swaying. They are rendered ONLY for the Host and for other ghosts — to someone still
in the fight, a defeated player simply is not there.

Full status: [docs/hammer-party-status.pdf](../../../docs/hammer-party-status.pdf).
