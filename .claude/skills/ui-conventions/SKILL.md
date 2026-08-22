---
name: ui-conventions
description: The agreed UI look, wording, and front-end structure for Hammer Party — cartoon-minimal theme tokens, the cosmetic system, the splash/loading flow, and the phase-based screen routing. Load before touching any client screen, styles.css, copy, or the character/cosmetics so you match decisions already made with the owner (and don't reintroduce the old dark theme, "เจ้าภาพ", or a fixed map name).
---

# Hammer Party — UI Conventions (decided with the owner)

## Visual style — cartoon minimal (locked)
Bright, friendly, uncluttered. **NOT** the old dark/fantasy gold theme (removed).
- **Background:** light sky gradient + soft white bubbles.
- **Cards:** white, big rounded corners, soft shadow, 2px light border.
- **Buttons:** chunky "candy" style with a **bottom lip** (`box-shadow: 0 5px 0 <darker>`), press = `translateY(4px)`.
- **Fonts:** display/headings/buttons = **Baloo Thai 2** (rounded, bold); body = **Sarabun**. Loaded from Google Fonts in `index.html` (self-host in Phase 04 for offline).
- **Swatches:** glossy colored balls. **Tabs:** rounded pills.
- Everything lives in `client/src/styles.css` `:root` tokens (`--sky-*`, `--blue`, `--green`, `--coral`, `--ink`, `--radius`, …).

> ⚠️ CSS class names are legacy tokens — `btn--gold` is now **blue** (primary), `btn--jade` = green (ready/confirm), `btn--danger` = coral. **Don't rename them**, just restyle. Reuse existing classes (`panel`, `pill`, `stage`, `opt`, `tab`, `chip`, `roster-strip`, `actionbar`, `hud`, …).

## Wording (locked)
- Say **"Host"** in copy — never "เจ้าภาพ".
- **Never hard-code a map name** ("โคลอสเซียม" etc.) — the game is a general stage system; use generic copy (e.g. tagline "ทุบให้เหลือคนสุดท้าย!").
- UI copy is Thai; technical terms stay English.
- Roster shows the count `👥 ในห้อง X/25` and **omits the player's own chip** (name is already on the character plate).

## Screen routing (`client/src/App.tsx`)
Driven by `store` (`conn`, `booted`, `phase`, `isHost`):
- `conn==="idle"` → **JoinScreen** (name only if `?room=`, else + code field; `?host` → Host mode)
- `conn==="error"` → **ErrorScreen**
- `conn==="connecting" || !booted` → **SplashScreen** (progress bar eases up; `booted:true` ~650ms after open)
- `open` + `phase` playing/ended → **GameScreen**
- `open` + lobby → **HostScreen** (if `isHost`) else **LobbyScreen**

## Cosmetics (client + server)
- Catalogs in `shared/constants.ts`: `PLAYER_COLORS` (hex[]), `HATS`/`FACES`/`BACKS` (`{id,label,icon}[]`, index 0 = none). Slots on `Player`: `colorIndex, hatIndex, faceIndex, backIndex`.
- **Picker:** `client/src/components/Customizer.tsx` — tabs (สีตัว/หมวก/แว่นตา/หลัง) → `sendCosmetic({ [slot]: index })`.
- **Server** clamps each index (`GameRoom` `SetCosmetic` handler). Client renders live via `store` echo.
- **3D render:** `client/src/three/CharacterPreview.tsx` — procedural low-poly meshes switched by `id` (Hat/Face/Back components). Transparent canvas over a light stage; light podium + soft rim; `OrbitControls` autoRotate + drag (no zoom/pan).
- **To add a cosmetic option:** append to the catalog array in `constants.ts` **and** add a `case "<id>"` mesh in the matching component in `CharacterPreview.tsx`. Server clamp updates automatically (uses `.length`).

## Character
Blocky low-poly avatar (legs/body/head + shoulder hammer) tinted by `colorIndex`, with
Hat/Face/Back layered on. Keep it low-poly and cartoonish; swap for glTF later if desired.

Full status: [docs/hammer-party-status.pdf](../../../docs/hammer-party-status.pdf).
