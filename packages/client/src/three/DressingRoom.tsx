import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Instance, Instances } from "@react-three/drei";
import { BackSide, DoubleSide, PerspectiveCamera, type Group } from "three";
import { TAU, approach } from "@hammer/shared";
import type { Cosmetic } from "../store";
import { ANIM, DRESSING_CAMERA, DRESSING_ROOM, HAMMER, RIG } from "../config/view";
import { ROOM_COLORS } from "../config/theme";
import { Character, type CharacterHandles } from "./Character";
import { HammerModel } from "./Hammer";

/**
 * THE DRESSING ROOM — a place, not a camera angle.
 *
 * The wardrobe used to be a bottom sheet with the plaza camera swung round behind
 * it: functional, and completely characterless. This is a room you step into. It has
 * a plank floor, panelled walls, a rug, shelves with books and pots and rolled maps
 * on them, a plant, and an afternoon window throwing warm light across all of it —
 * and in the middle of it, an ornate full-length mirror with you standing in it.
 *
 * Two decisions carry it:
 *
 *   - **It renders in the SAME canvas as the world**, with the plaza unmounted while
 *     it is open. A second `<Canvas>` would mean a second WebGL context, a second
 *     copy of every texture and two render loops on a phone — for a screen where
 *     nothing else is happening. Unmounting the arena instead makes the wardrobe the
 *     CHEAPEST screen in the game rather than the most expensive.
 *   - **The character in the mirror is a plain preview**, not the networked avatar.
 *     Cosmetic picks still go to the server and come back (the server owns what
 *     everyone sees), but nothing in here waits for a round trip to look right.
 */
export function DressingRoom({ cosmetic, hammer }: { cosmetic: Cosmetic; hammer: string }) {
  return (
    <>
      <RoomCamera />
      <RoomLights />
      <Shell />
      <Furnishings />
      <Mirror />
      <Model cosmetic={cosmetic} hammer={hammer} />
    </>
  );
}

/**
 * Park the canvas camera in front of the mirror, and put its lens back the way it
 * was on the way out — the arena's camera is much wider than this one, and a
 * wardrobe that quietly changed the game's field of view would be a real bug.
 *
 * On a wide screen the camera also slides sideways, which pushes the mirror over to
 * the LEFT of the frame — out from under the item grids, and where the brief wants
 * it. On a phone the grids are a bottom sheet instead, so it stays centred. The
 * breakpoint is `DRESSING_CAMERA.wideBreakpointPx`, the same number the stylesheet
 * switches layout at, named once so the two cannot drift.
 */
function RoomCamera() {
  const { camera, size } = useThree();
  const wide = size.width >= DRESSING_CAMERA.wideBreakpointPx;

  useEffect(() => {
    const lens = camera as PerspectiveCamera;
    const previousFov = lens.fov;
    const framing = wide ? DRESSING_CAMERA.wide : DRESSING_CAMERA.portrait;

    const [x, y, z] = framing.position;
    const [tx, ty, tz] = framing.target;
    camera.position.set(x, y, z);
    camera.lookAt(tx, ty, tz);
    lens.fov = DRESSING_CAMERA.fov;
    lens.updateProjectionMatrix();
    return () => {
      lens.fov = previousFov;
      lens.updateProjectionMatrix();
    };
  }, [camera, wide]);

  return null;
}

/**
 * Indoors, in the afternoon: one warm key coming through the window, a cool fill off
 * the opposite wall, and enough ambient that nothing goes black.
 *
 * The room is deliberately warmer and darker than the arena. That contrast is what
 * makes stepping in here feel like stepping somewhere rather than opening a menu.
 */
function RoomLights() {
  return (
    <>
      <ambientLight intensity={DRESSING_ROOM.ambientIntensity} />
      <directionalLight
        position={[-4, 4.5, 3.5]}
        color={ROOM_COLORS.daylight}
        intensity={DRESSING_ROOM.keyIntensity}
        castShadow
      />
      <directionalLight position={[4, 2.5, 2]} intensity={DRESSING_ROOM.fillIntensity} />
    </>
  );
}

// ── The room itself ──────────────────────────────────────────────────────────

/**
 * Floor, walls, panelling.
 *
 * The walls are ONE inverted box rather than three planes: seen from inside, a box
 * rendered back-face-only is a room, and it can never leave a gap in a corner.
 */
function Shell() {
  const { widthM, depthM, heightM, wainscotM, railM } = DRESSING_ROOM;
  const planks = useMemo(
    () =>
      Array.from({ length: 11 }, (_, i) => ({
        key: i,
        z: (i / 10 - 0.5) * depthM,
      })),
    [depthM],
  );

  return (
    <group>
      <mesh position={[0, heightM / 2 - 0.01, 0]}>
        <boxGeometry args={[widthM, heightM, depthM]} />
        <meshStandardMaterial color={ROOM_COLORS.wall} roughness={1} side={BackSide} />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[widthM, depthM]} />
        <meshStandardMaterial color={ROOM_COLORS.floor} roughness={0.85} />
      </mesh>
      {/* the gaps between the boards — the cheapest way to say "this floor is timber" */}
      <Instances limit={planks.length} range={planks.length}>
        <boxGeometry args={[widthM, 0.004, 0.02]} />
        <meshStandardMaterial color={ROOM_COLORS.floorPlank} roughness={1} />
        {planks.map((plank) => (
          <Instance key={plank.key} position={[0, 0.003, plank.z]} />
        ))}
      </Instances>

      {/* wainscot panelling along the back wall, with a cap rail on top of it */}
      <mesh position={[0, wainscotM / 2, -depthM / 2 + 0.02]}>
        <planeGeometry args={[widthM, wainscotM]} />
        <meshStandardMaterial color={ROOM_COLORS.wainscot} roughness={1} />
      </mesh>
      <mesh position={[0, wainscotM, -depthM / 2 + 0.04]}>
        <boxGeometry args={[widthM, railM, 0.08]} />
        <meshStandardMaterial color={ROOM_COLORS.rail} roughness={0.9} />
      </mesh>

      <Window />
    </group>
  );
}

/** The window on the side wall, and the warm slab of afternoon leaning through it. */
function Window() {
  const { widthM, depthM } = DRESSING_ROOM;
  const { window: pane } = DRESSING_ROOM;

  return (
    <group
      position={[-widthM / 2 + 0.06, pane.sillY, -depthM * 0.12]}
      rotation={[0, Math.PI / 2, 0]}
    >
      <mesh>
        <planeGeometry args={[pane.widthM, pane.heightM]} />
        <meshBasicMaterial color={ROOM_COLORS.daylight} />
      </mesh>
      <mesh position={[0, 0, -0.02]}>
        <planeGeometry args={[pane.widthM + pane.barM * 3, pane.heightM + pane.barM * 3]} />
        <meshStandardMaterial color={ROOM_COLORS.windowFrame} roughness={1} />
      </mesh>
      {/* the glazing bars, which are what stop a lit rectangle reading as a hole */}
      <mesh position={[0, 0, 0.01]}>
        <boxGeometry args={[pane.barM, pane.heightM, 0.02]} />
        <meshStandardMaterial color={ROOM_COLORS.windowFrame} roughness={1} />
      </mesh>
      <mesh position={[0, 0, 0.01]}>
        <boxGeometry args={[pane.widthM, pane.barM, 0.02]} />
        <meshStandardMaterial color={ROOM_COLORS.windowFrame} roughness={1} />
      </mesh>
    </group>
  );
}

/** Shelves, books, pots, rolled maps, a rug and a plant — the things that make a room. */
function Furnishings() {
  const { shelves, props, rug, depthM } = DRESSING_ROOM;
  const wall = -depthM / 2 + shelves.depthM / 2 + 0.03;

  const boards = useMemo(
    () =>
      Array.from({ length: shelves.count }, (_, i) => ({
        key: i,
        y: shelves.startY + i * shelves.stepY,
        // one shelf to each side of the mirror, so neither ends up behind it
        x: (i % 2 === 0 ? -1 : 1) * (shelves.widthM / 2 + 0.55),
      })),
    [shelves],
  );

  const books = useMemo(
    () =>
      boards.flatMap((board) =>
        Array.from({ length: props.bookCount }, (_, i) => ({
          key: `${board.key}-${i}`,
          x: board.x - shelves.widthM / 2 + 0.16 + i * 0.11,
          y: board.y + shelves.thickM / 2 + 0.13,
          height: 0.2 + (((i * 7) % 5) / 5) * 0.1,
          color: ROOM_COLORS.books[(i + board.key) % ROOM_COLORS.books.length],
        })),
      ),
    [boards, props.bookCount, shelves],
  );

  return (
    <group>
      {/* the rug, so the character is standing ON something */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, rug.liftM, 0.15]}>
        <circleGeometry args={[rug.radiusM, 40]} />
        <meshStandardMaterial color={ROOM_COLORS.rug} roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, rug.liftM * 2, 0.15]}>
        <ringGeometry args={[rug.radiusM - rug.ringM, rug.radiusM - rug.ringM * 0.5, 40]} />
        <meshStandardMaterial color={ROOM_COLORS.rugTrim} roughness={1} />
      </mesh>

      {boards.map((board) => (
        <mesh key={board.key} position={[board.x, board.y, wall]} castShadow receiveShadow>
          <boxGeometry args={[shelves.widthM, shelves.thickM, shelves.depthM]} />
          <meshStandardMaterial color={ROOM_COLORS.shelf} roughness={1} />
        </mesh>
      ))}

      <Instances limit={books.length} range={books.length} castShadow>
        <boxGeometry args={[0.075, 1, 0.2]} />
        <meshStandardMaterial roughness={0.95} />
        {books.map((book) => (
          <Instance
            key={book.key}
            position={[book.x, book.y + book.height / 2 - 0.13, wall]}
            rotation={[0, 0, ((book.key.charCodeAt(2) % 5) - 2) * 0.05]}
            scale={[1, book.height, 1]}
            color={book.color}
          />
        ))}
      </Instances>

      {/* pots at the end of each shelf, and rolled maps leaning in the corner */}
      {boards.map((board) => (
        <mesh
          key={`pot-${board.key}`}
          position={[
            board.x + shelves.widthM / 2 - 0.22,
            board.y + shelves.thickM / 2 + 0.13,
            wall,
          ]}
          castShadow
        >
          <cylinderGeometry args={[0.12, 0.09, 0.24, 12]} />
          <meshStandardMaterial color={ROOM_COLORS.pot} roughness={0.9} />
        </mesh>
      ))}

      <Scrolls />
      <Plant />
    </group>
  );
}

/** Rolled maps leaning in the corner. Three cylinders and a tie — pure set dressing. */
function Scrolls() {
  const { props, depthM, widthM } = DRESSING_ROOM;
  const rolls = useMemo(
    () =>
      Array.from({ length: props.scrollCount }, (_, i) => ({
        key: i,
        x: widthM / 2 - 2.3 + i * 0.13,
        lean: 0.16 + i * 0.035,
        length: 1.25 + (((i * 3) % 4) / 4) * 0.35,
      })),
    [props.scrollCount, widthM],
  );

  return (
    <group position={[0, 0, -depthM / 2 + 0.28]}>
      {rolls.map((roll) => (
        <group key={roll.key} position={[roll.x, roll.length / 2, 0]} rotation={[0, 0, -roll.lean]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.055, 0.055, roll.length, 10]} />
            <meshStandardMaterial color={ROOM_COLORS.scroll} roughness={1} />
          </mesh>
          <mesh position={[0, roll.length * 0.18, 0]}>
            <cylinderGeometry args={[0.062, 0.062, 0.05, 10]} />
            <meshStandardMaterial color={ROOM_COLORS.scrollTie} roughness={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** The potted plant beside the mirror — leaves splayed out of a pot, no two alike. */
function Plant() {
  const { plant, widthM } = DRESSING_ROOM;
  const leaves = useMemo(
    () =>
      Array.from({ length: plant.leafCount }, (_, i) => {
        const around = (i / plant.leafCount) * TAU;
        return {
          key: i,
          rotation: [0.5 + ((i * 5) % 4) / 8, around, 0] as [number, number, number],
          scale: plant.leafM * (0.7 + (((i * 7) % 5) / 5) * 0.5),
        };
      }),
    [plant],
  );

  return (
    <group position={[-widthM / 2 + 2.2, 0, -0.6]}>
      <mesh position={[0, plant.potHeightM / 2, 0]} castShadow>
        <cylinderGeometry
          args={[plant.potRadiusM, plant.potRadiusM * 0.76, plant.potHeightM, 14]}
        />
        <meshStandardMaterial color={ROOM_COLORS.plantPot} roughness={0.9} />
      </mesh>
      <group position={[0, plant.potHeightM, 0]}>
        {leaves.map((leaf) => (
          <mesh
            key={leaf.key}
            rotation={leaf.rotation}
            position={[0, leaf.scale * 0.5, 0]}
            scale={[leaf.scale * 0.4, leaf.scale, leaf.scale * 0.2]}
            castShadow
          >
            <sphereGeometry args={[1, 8, 6]} />
            <meshStandardMaterial color={ROOM_COLORS.plantLeaf} roughness={0.85} flatShading />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// ── The mirror ───────────────────────────────────────────────────────────────

/**
 * The full-length mirror: an oval of glass in a brass frame with a crest on top,
 * standing on two feet.
 *
 * The frame is built from flat RINGS scaled into ellipses rather than from a torus.
 * A scaled torus has a tube that gets thin where the scale is small, so an oval one
 * ends up thin down the sides and fat top and bottom; flat rings stay the same width
 * all the way round, which is what an actual picture frame does — and from a camera
 * looking at it head-on, flat is all it ever needed to be.
 */
function Mirror() {
  const { mirror } = DRESSING_ROOM;
  const rx = mirror.widthM / 2;
  const ry = mirror.heightM / 2;
  const studs = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => {
        const around = (i / 10) * TAU;
        return {
          key: i,
          position: [
            Math.cos(around) * (rx + mirror.frameM * 0.5),
            ry + Math.sin(around) * (ry + mirror.frameM * 0.5),
            0.03,
          ] as const,
        };
      }),
    [rx, ry, mirror.frameM],
  );

  return (
    <group position={[0, 0, -0.62]} rotation={[mirror.tiltRad, 0, 0]}>
      {/* the glass, and the two rings that frame it */}
      <mesh position={[0, ry, 0]} scale={[rx, ry, 1]}>
        <circleGeometry args={[1, 48]} />
        <meshStandardMaterial color={ROOM_COLORS.glass} roughness={0.25} metalness={0.35} />
      </mesh>
      <mesh position={[0, ry, 0.01]} scale={[rx + mirror.bevelM, ry + mirror.bevelM, 1]}>
        <ringGeometry args={[1 - mirror.bevelM / rx, 1, 48]} />
        <meshStandardMaterial color={ROOM_COLORS.bevel} roughness={0.4} metalness={0.5} />
      </mesh>
      <mesh position={[0, ry, 0.02]} scale={[rx + mirror.frameM, ry + mirror.frameM, 1]}>
        <ringGeometry args={[1 - mirror.frameM / (rx + mirror.frameM), 1, 48]} />
        <meshStandardMaterial
          color={ROOM_COLORS.frame}
          roughness={0.35}
          metalness={0.7}
          side={DoubleSide}
        />
      </mesh>

      <Instances limit={studs.length} range={studs.length}>
        <sphereGeometry args={[mirror.frameM * 0.34, 10, 8]} />
        <meshStandardMaterial color={ROOM_COLORS.bevel} roughness={0.3} metalness={0.7} />
        {studs.map((stud) => (
          <Instance key={stud.key} position={stud.position} />
        ))}
      </Instances>

      {/* the crest: a fan over the top, which is the whole of "ornate" */}
      <group position={[0, mirror.heightM + mirror.frameM, 0.02]}>
        <mesh scale={[mirror.crestM * 1.6, mirror.crestM, mirror.crestM * 0.3]}>
          <sphereGeometry args={[1, 14, 10]} />
          <meshStandardMaterial color={ROOM_COLORS.frame} roughness={0.35} metalness={0.7} />
        </mesh>
        <mesh position={[0, mirror.crestM * 0.7, 0]}>
          <coneGeometry args={[mirror.crestM * 0.28, mirror.crestM * 0.9, 8]} />
          <meshStandardMaterial color={ROOM_COLORS.bevel} roughness={0.3} metalness={0.7} />
        </mesh>
      </group>

      {/* the feet, and the bar between them */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * mirror.footSpreadM, mirror.footM / 2, 0]} castShadow>
          <cylinderGeometry args={[mirror.footM * 0.5, mirror.footM * 0.9, mirror.footM, 10]} />
          <meshStandardMaterial color={ROOM_COLORS.frameShade} roughness={0.4} metalness={0.6} />
        </mesh>
      ))}
      <mesh position={[0, mirror.footM * 0.7, 0]}>
        <boxGeometry args={[mirror.footSpreadM * 2, mirror.footM * 0.35, mirror.footM * 0.35]} />
        <meshStandardMaterial color={ROOM_COLORS.frameShade} roughness={0.4} metalness={0.6} />
      </mesh>
    </group>
  );
}

// ── The character in it ──────────────────────────────────────────────────────

/**
 * You, standing in the mirror, on a turntable.
 *
 * Dragging anywhere over the room spins it, and it EASES onto whatever angle the
 * drag asked for rather than tracking the finger exactly — a preview that snaps
 * around under your thumb feels like a debug control, one that follows a beat behind
 * feels like a thing being turned.
 *
 * The idle is deliberately minimal: breathing, a slow weight shift, and a blink.
 * Everything the character does in the arena is driven by things that are not
 * happening in here (speed, swings, hits), so this animates the two that are.
 */
function Model({ cosmetic, hammer }: { cosmetic: Cosmetic; hammer: string }) {
  const rig = useRef<CharacterHandles>(null);
  const turntable = useRef<Group>(null);
  const angle = useRef(0);
  const target = useRef(0);
  const { gl } = useThree();

  useEffect(() => {
    const canvas = gl.domElement;
    let dragging = false;
    let lastX = 0;

    const down = (event: PointerEvent) => {
      dragging = true;
      lastX = event.clientX;
    };
    const move = (event: PointerEvent) => {
      if (!dragging) return;
      target.current -= (event.clientX - lastX) * DRESSING_ROOM.turntable.dragRadPerPx;
      lastX = event.clientX;
    };
    const up = () => {
      dragging = false;
    };

    canvas.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      canvas.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [gl]);

  useFrame((state, dt) => {
    if (turntable.current) {
      angle.current +=
        (target.current - angle.current) * approach(DRESSING_ROOM.turntable.easeRate, dt);
      turntable.current.rotation.y = angle.current;
    }

    const time = state.clock.elapsedTime;
    const body = rig.current;
    if (body?.torso) {
      const breath = Math.sin(time * ANIM.idleRate) * ANIM.idleScale;
      body.torso.scale.set(1 + breath, 1 - breath, 1 + breath);
    }
    if (body?.lean) {
      body.lean.rotation.z = Math.sin(time * ANIM.idleSwayRate) * ANIM.idleSwayRad;
    }
    if (body?.head) {
      body.head.rotation.z = Math.sin(time * ANIM.idleTiltRate) * ANIM.idleTiltRad;
    }
    if (body?.scarf) {
      body.scarf.rotation.x =
        RIG.scarf.tail.restTiltRad + Math.sin(time * ANIM.scarfWaveRate * 0.5) * ANIM.scarfWaveRad;
    }
  });

  return (
    <group ref={turntable} position={[0, 0, 0.15]}>
      <Character ref={rig} cosmetic={cosmetic} detail />
      {/* the hammer, shouldered — you are choosing a look, and it is part of the look */}
      <group position={[RIG.arm.x, RIG.arm.shoulderY, 0]} rotation={[0, 0, RIG.arm.restSpreadRad]}>
        <group
          position={[0, -RIG.arm.length - RIG.hand.gripDropM, 0]}
          rotation={[HAMMER.restTilt.backRad, 0, -HAMMER.restTilt.outRad]}
        >
          <HammerModel kind={hammer} />
        </group>
      </group>
    </group>
  );
}
