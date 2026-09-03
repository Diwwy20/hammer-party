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
  `.pill`, `.chip`, `.input`, `.tab`, `.hero-title`, `.progress`, `.glass*`, `.hud-top`, `.hud-mark`,
  `.icon-btn`, `.dock*`, `.vitals`, `.hp-*`, `.plate*`, `.dmg`, `.stick-pad`, `.dressing*`, `.wardrobe*`,
  `.wtab`, `.item*`, `.dice*`, `.done-btn`, `.ready-btn*`, `.sparkles`, `.host-overlay*`, …). Exotic bits
  (gradients, `-webkit-text-stroke`, the button lip, `::before` bubbles) stay raw inside those recipes.
- `@keyframes bob` / `sparkle` and the shadcn token blocks (`:root`, `.dark`, `@theme inline`, `@layer base`).

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
> The same goes for the old bottom-sheet wardrobe (`.sheet*`, `.customizer`, `.options`, `.opt*`, `.swatch*`):
> the dressing room replaced it.

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
- **Players never see other players' names in the lobby** — the plaza HUD (`HudTop`) shows only the room
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

- every phase → `HudTop` (except the Host in the lobby, whose overlay carries its own header)
- `lobby` player → `LobbyDock`, and the **dressing room** replaces the whole screen (canvas included) when
  it is open; `lobby` host → `HostLobbyOverlay` (QR/code/stage-picker/Start)
- `playing` → `Joystick` + `KeyboardControls` + `MatchHud` + `ZoneWarning`, plus `AttackButton` only
  while you are ALIVE. A dead player keeps the stick (they are a ghost, still flying around) and swaps
  the hammer for `PrankBar`; the Host gets `HostEventBar` + `HostSpectateBar`.
- `ended` → `ResultsOverlay` (standings + awards, closeable — dismiss is local only)
- any phase → `EventBanner` when `activeEvent` is set

Controls: touch (`Joystick`) and desktop (`KeyboardControls`, WASD/arrows + Space) write the SAME screen-space
vector; `runtime/input.ts` `toWorld()` is the one place that converts it to world space.

**The camera is ISOMETRIC and fixed-orientation in every phase** (plaza · match · ghost): it looks down on
the arena from one corner at a constant yaw (`CAMERA.isoYawRad`, 45°) and a constant pitch, and never rotates
with the player's facing. `runtime/input.ts` `toWorld()` turns the stick by that same yaw, ONCE — screen-up is
`(sin, cos)`, screen-right is a quarter turn clockwise from it — so the stick means one thing all game long.

Three things follow, and all three are the reason for it:

- **You can see the fight.** A camera behind a character shows their back; a camera above the corner shows
  the floor, everyone on it, and the hammer arriving from the side you were not looking at.
- **The swing reads.** A blow that sweeps round the body crosses the screen instead of being foreshortened.
- **`height` and `distance` are deliberately NOT equal** (~37°, not a textbook 45°): a true isometric pitch
  looks straight down on the tops of everybody's heads, which is the one part of a character nobody dressed.

It is a PERSPECTIVE camera at an isometric angle, not an orthographic one — the fog, the floating name tags
and the backdrop all want some convergence. Do not put the match back into first or third person.

## Cosmetics (client + server)

- Catalogs in `shared/constants.ts`: `PLAYER_COLORS` and `HAIR_COLORS` (hex[]), `HATS`/`FACES`/`BACKS`
  (`{id,label,icon}[]`, index 0 = none). Ids come from `HatId`/`FaceId`/`BackId` in `shared/enums.ts`. Slots
  on `Player`: `colorIndex, hairIndex, hatIndex, faceIndex, backIndex` (`CosmeticSlot` names them).
- **Hair is a real slot**, not a tone derived from `colorIndex`. That derivation was the right trade when the
  picker was a strip of swatches; it is the wrong one now that the dressing room shows a GRID of hair beside a
  mirror, because the one thing a grid of hair has to do is let you pick the hair.
- **The default look is the game's own character**: gold shirt, dark hair, and the black top hat with the RED
  brim (`DEFAULT_COLOR_INDEX` / `DEFAULT_HAIR_INDEX` / `DEFAULT_HAT_INDEX`). Somebody who never opens the
  wardrobe still gets the face that is on the cover art, not a bald bean in the house colour.
- **Picker:** the dressing room (below) — `components/dressing/Wardrobe.tsx` → `sendCosmetic({ [slot]: index })`.
- **Server** clamps each index to its catalog (`server/src/game/cosmetics.ts`). The client renders the echo,
  so there is no local "pending" copy to drift.
- **3D render:** `client/src/three/cosmetics.tsx` — procedural low-poly meshes switched by id, worn by the one
  shared `Character`, so a dress-up edit shows up in-world immediately.
- Each cosmetic is scaled about its OWN anchor (`Worn` in `Character.tsx`). Scaling the group they sit in
  scales their positions too, which is how a top hat ends up hovering a finger's width above the hair.
- **To add a cosmetic option:** add the id to the matching enum in `shared/enums.ts`, append to the catalog in
  `constants.ts`, add a `case <Enum>.<Id>` mesh in `three/cosmetics.tsx`, **and** a painted icon in
  `components/dressing/ItemIcon.tsx`. The server clamp follows automatically (it reads `.length`).

## Character — a dressed chibi rig with a painted face

Chibi and full of life (the Stumble Guys / PEAK register the owner asked for): a **big** round head on a
small bean of a body, long noodle arms with mitten hands, stubby legs in big boots. Five things carry the
look, and none of them is the geometry being clever:

1. **It wears CLOTHES.** A scarf-collar, a placket down the chest, a belt with a buckle and a flared hem —
   bands drawn ACROSS a round body, which is most of the reason a round body has any depth at all. The
   tunic is the player's tint (`PLAYER_COLORS`); the trim (`CHARACTER_COLORS.trim`) is the same on
   everybody, so a colour reads as _their_ colour rather than as a different character.
2. **HAIR** (`RIG.hair`): a cap down to the brow line, a longer shell over the back of the head, a swept
   fringe, a lock either side of the face and a cowlick. Two thin partial spheres carry the hairstyle. The
   tone comes from `hairColor(hairIndex)` — a wardrobe slot of its own (see Cosmetics above).
3. **A SCARF**, which is also the collar. It exists to never be still (see the animation notes below).
4. **TOON SHADING.** Characters are lit through a stepped ramp (`toonRampTexture`, `TOON.steps`) while the
   arena stays ordinarily lit, plus a cool rim light from behind (`LIGHTING.rimDirection`). They read as
   drawn people standing in a place, which is the separation flat-shaded beans never had.
5. **The painted face** — see below.

**Your own character stands on a RING in your colour** (`BLOB_SHADOW.selfRing`), not a glow on the body:
a glow fights the tint it is glowing through and washes out the very colour it is pointing at.

**Level of detail matters here.** A character is ~34 meshes close up and ~20 further off; the trim, buckle,
cuffs, soles and loose hair are simply not built past `LOD.detailInM` (with `detailOutM` as hysteresis).
That is what makes a rig this rich affordable at 25 players — and it is why the Host's far camera, the one
that really does see all 25, gets the cheap tier for everybody.

Split across three files on purpose:

- **`three/Character.tsx`** — the RIG. Parts that move are separate groups pivoted at a real joint (hips,
  shoulders, neck) and handed out as `CharacterHandles`. It knows nothing about the game.
- **`three/PlayerAvatar.tsx`** — the DRIVER. Walk cycle, idle breathing/sway/tilt, the lag on head, hair
  and scarf, the four-beat swing, hit squash + flash, expression, ghost float and the death poof — all read
  off motion and broadcast timestamps.
- **`three/textures.ts`** — the FACE, the toon ramp, the swing smear and the impact star, all painted into
  canvases.

**The face is painted, not modelled.** One curved plate hugs the front of the head wearing a canvas
texture. The EYE is five passes deep — white, iris, the pool of light through the bottom of the iris,
pupil, two catchlights — under a heavy lash line that is the eye's real shape. Expressions
(`FaceExpression`: happy · blink · **fierce** · hurt · **dizzy**) are a **texture swap on one mesh**, which
is the only reason a face this detailed is affordable with 25 players on a phone. All of its coordinates
live in `FACE` (`config/view.ts`) and all of its colours in `FACE_COLORS` (`config/theme.ts`) —
re-proportioning the face never means reading canvas code.

Every measurement — body parts, hats, glasses, backpacks, the held hammer — comes from **`RIG`** in
`config/view.ts`. Never hard-code a height in a mesh. Cosmetics carry absolute sizes from an earlier,
smaller head, so hats and glasses are worn at `RIG.head.radius / RIG.cosmeticBaseRadius`.

The walk cycle is driven by **distance travelled**, not a timer, so the legs match the real speed whether
the player is walking, being interpolated, or sliding across a rain-slicked floor after a hit. Everything
else in the walk exists to stop it reading as a slide: the bounce, the roll foot-to-foot, the toe rolling
off the floor, the shoulder counter-twist, and the squash on each footfall.

**Everything loose LAGS.** The head, the hair and the scarf are not animated with the body — they are
dragged by it (`ANIM.headLag* / hairLag* / scarfLag*`), pulled by speed and by how hard the body just
turned, then eased back. It is the cheapest trick in the file and the one that does most to stop 25 people
reading as 25 objects being slid around a floor.

### The swing — four beats, and it sweeps ROUND

`swingPose` in `PlayerAvatar.tsx`. **Lift and wind back → sweep round and through → HOLD → unwind.**

- It is a **sweep round the body**, not a vertical chop. The camera sits behind the player, so an arc that
  travels straight down travels straight AWAY: foreshortened to nothing, and its smear invisible. Round the
  body it crosses the screen — and it is also the shape of what the server actually tests (a cone
  `arcDeg` wide around your facing). The arm joints use Euler order **`YXZ`** so the lift composes before
  the sweep; the default `XYZ` sweeps an arm that is still hanging straight down, which moves nothing.
- The **HOLD** is hit-stop: a few frozen frames on contact. It is the difference between an arm passing
  through a target and an arm hitting one.
- The hammer **whips**: it lags the arm as the arm accelerates and comes over the top of it as the arm
  stops (`AVATAR.swingWhipRad`, applied to the hammer's sweep only).
- The whole body commits — crouch, lunge, hop, torso twist, head turn, free arm thrown back, feet planted.
- Its LENGTH comes from that hammer's own cooldown (`AVATAR.swingOfCooldown`, clamped): the fast hammer
  flicks, the heavy one is a haymaker you can see coming, and the animation can never outlast the swing it
  is animating. For the same reason a HELD attack repeats at `swingRepeatMs(hammer)` (`runtime/input.ts`)
  rather than a fixed rate — a fixed one restarted the animation three times per swing and the character
  just twitched.

### Impact — what a blow leaves behind (`three/Impact.tsx`)

**Most FX are painted quads, not particle systems** (`slashTexture`, `burstTexture`, `crackTexture`): the
swing smear, the impact star and the ground fractures are single planes. A smear pinned into the arc in 3D
vanishes the moment you look along that arc; and 25 characters each carrying seven little spark meshes is 300
objects walked per frame to draw nothing.

The one exception is **SPARKS** — one `Points` buffer per character, thrown out on a cone and pulled down by
gravity. They are the only FX with real motion behind them, which is exactly why they sell a hit: everything
else is a picture of an impact, these are debris from one.

⚠️ **Bright FX on this game's floors must be SATURATED and alpha-blended, never additive.** The arenas are
pale cream stone; adding a warm highlight to something already near-white produces white, and the effect
simply disappears against the thing it was flying off. That is why `HammerStyle.trail` is saturated, and it
is why the sparks were moved off `AdditiveBlending` (`IMPACT_COLORS.spark` is orange, not a hot white).

Other pieces, all tuned in `COMBAT_FX` / `TARGETING` / `DAMAGE_FX` / `NAMEPLATE`:

- **Ground fractures** are a POOL of decals in world space, recycled oldest-first. They belong to the world,
  not the player who made them — the player walks away, the broken floor does not. One per swing, latched so
  a held attack cannot spray them.
- **The target ring + reticle** run THE SAME TEST THE SERVER WILL (`server/game/combat.ts`): alive, inside
  the hammer's reach, inside its arc, nearest first. It grants nothing and is not a mechanic; it draws a
  decision the player is already making. Being a frame behind costs a ring in the wrong place, nothing more.
- **Damage numbers** are a fixed POOL of overlay tags animated imperatively — never React state. Blows land
  several times a second per player. Size and colour carry the magnitude, so a fast-hammer tap and a
  golden-hammer haymaker read differently without anybody reading the digits.
- **Ambient dust** is one `Points` cloud parked on the camera. It is the difference between characters
  composited onto a floor and characters standing somewhere with air in it.

**The hammer** (`three/Hammer.tsx`) hangs off the ARM's own length rather than a hand anchor of its own —
an anchor beside the arm drifts away from it the moment the arm splays or swings. Its head is a **lathe**
turned from a profile (`HAMMER.head.profile`) and lies **across** the swing — a mallet, not an axe, because
a head pointing along the arc is seen end-on (a grey disc) from the one camera that matters. Each kind gets
its own metal, timber, bulk and smear colour (`hammerStyle`), so you can tell what somebody is carrying
from across the arena. The same component draws the hammer in a fist and the one bobbing on the floor, so
they can never disagree.

**Ghosts** (dead players) reuse the same rig with `ghost` set: pale, see-through, no legs (a wisp instead),
no hammer, floating and swaying. They are rendered ONLY for the Host and for other ghosts — to someone
still in the fight, a defeated player simply is not there.

## The world — a place, not a disc

- **Sky** (`three/Sky.tsx`): a gradient dome painted from the stage palette (`skyTop`/`skyMid`/`sky`) plus
  an instanced cloud bank. Distance fog matches the horizon.
- **Lighting** (`LIGHTING` in `config/view.ts`): one warm sun whose **shadow camera is sized to the whole
  arena** (three.js defaults it to a few metres — that is why the old scene had no shadows away from the
  middle), a sky/ground hemisphere fill, and a little ambient.
- **The island** (`PLATFORM`): the arena is a thick raised platform — flagged floor, coloured rim band, a
  low wall with posts where players are clamped, a tapered underside. It grows to carry the stands when a
  stage has them.
- **The floor is WEATHERED STONE FLAGS** (`stoneFloorTexture`, `FLOOR`): every flag a slightly different
  tone, mortar that WAVERS instead of being ruled, a lit top bevel and a shaded bottom one, and the whole
  thing speckled and cracked. A 2×2 block is painted and repeated, and the wobble on the canvas-edge lines is
  MIRRORED so it still tiles. The bevels are drawn INSIDE the mortar, not under it — draw them first and the
  mortar (which is just as wide) eats them and the floor goes flat again.
- **Grass grows through it** (`three/Grass.tsx`, `GRASS`): painted patch decals carry the colour, crossed
  alpha quads carry the silhouette, and the tufts grow INSIDE the patches. Scattered evenly they are green
  specks on stone — litter; clustered where the paint is, they are grass. Both are culled against the safe
  zone, so the closing wall visibly burns the grass away.
- **The countryside** (`three/Backdrop.tsx`, `BACKDROP`): a grass plain `groundDropM` below the arena floor,
  a treeline, a village and hills, each ring washed further toward the sky colour. That haze IS the brief's
  "depth of field" — a real defocus is a post-processing dependency we do not have, and a cartoon wants
  aerial perspective anyway. The drop is what makes the island read as a raised plateau instead of a slab.
  A stage whose palette has `ground: null` (the sky stage) gets neither: its cloud slabs do that job.
- **Textures are painted at runtime** (`three/textures.ts`) — stone flags, grass, sky gradient, blob shadow,
  zone fade, fracture stars, the spark/dust dot, the targeting reticle, faces. Nothing is fetched: the game
  has to open instantly on venue wifi.
- **The safe zone is a curtain of light** at `zoneRadius`, not a line on the floor. The safe disc is a unit
  circle scaled every frame; its texture repeat is rewound by the same factor so the flags stay put on the ground.
- **The plaza** (`three/Plaza.tsx`) is dressed as a party: planters, trees, bunting on a rope, balloons,
  confetti, a floor medallion. Everything repeated is INSTANCED — one draw call per kind, because this
  scene also has to hold 25 players.

## HUD layout — three bands

Nothing ever lands in two of them at once:

1. **The top strip** (`components/hud/HudTop.tsx`) — the mark on the left; on the right the room code and
   headcount in the lobby, or the survivor count in a match, plus the way out. One component, every phase.
2. **The middle band, above the thumbs** — the one thing to DO right now: `LobbyDock` (dress up · ready) in
   the lobby, `MatchHud` (HP + hammer) in a match. It drops between the thumbs on a wide screen and moves
   to the top on a short one (media queries on `.dock` / `.vitals`).
3. **The bottom corners** — the stick (left) and the hammer button (right). Never anything else.

**No status paragraphs and no control hints in the lobby.** The ready count rides inside the ready button;
players work the stick out by touching it.

**One HP bar design, everywhere.** The floating nameplate (`.plate`) and your own vitals (`.hp-track`) are
built from the same three layers, and each layer answers a different question: the dark TRACK is the maximum,
the pale DRAIN segment is what was just lost (it holds `NAMEPLATE.drainDelayMs` and then slides, so a blow
reads as a blow rather than as a bar that is quietly a bit shorter), the bright FILL is what is left, and the
NUMBER is on it — "half a bar" of six hundred is not the same thing to know as "300". The nameplate floats at
`NAMEPLATE.y`, which clears the tallest HAT rather than the head.

## The dressing room (`three/DressingRoom.tsx` + `components/dressing/`)

A place you step into, not a bottom sheet. A plank floor, panelled walls, a rug, shelves with books, pots and
rolled maps, a plant, an afternoon window — and an ornate full-length mirror with your character standing in
it on a turntable you can drag.

- **It renders in the SAME canvas as the world, and the arena is UNMOUNTED while it is open** (`GameScreen`
  swaps `<World>` for `<DressingRoom>`). A second `<Canvas>` would mean a second WebGL context, a second copy
  of every texture and two render loops on a phone, for a screen where nothing else is happening. Swapping
  instead makes the wardrobe the cheapest screen in the game rather than the most expensive.
- **The camera is its own** (`DRESSING_CAMERA`), far enough back to hold the whole mirror crest-to-feet, and
  it puts the lens back on the way out. On a wide screen it slides sideways so the mirror sits LEFT and the
  grids sit right; the shift and the CSS breakpoint are the same number, named once.
- **The grids use painted SVG icons** (`components/dressing/ItemIcon.tsx`) drawn from the SAME palette as the
  3D meshes — not emoji, which are somebody else's drawings in somebody else's style on every phone in the room.
- **The hammer tab is a PREVIEW and says so** (`DRESSING_COPY.hammerNote`). Hammers are picked up in the
  arena; letting the wardrobe choose one would be handing out a stat, and this screen does not do that.
- The mirror half of the overlay is `pointer-events-none` so a drag there reaches the turntable behind it.

Full status: [docs/hammer-party-status.pdf](../../../docs/hammer-party-status.pdf).
