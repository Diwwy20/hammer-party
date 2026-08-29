import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh, MeshBasicMaterial } from "three";
import { HazardPhase, METEOR, clamp01 } from "@hammer/shared";
import { selectHazardsKey, useGame, type HazardView } from "../store";
import { blasts, seeHazard } from "../runtime/combatFx";
import { METEOR_FX } from "../config/view";
import { METEOR_COLORS } from "../config/theme";

/**
 * The meteor storm, drawn.
 *
 * The server syncs WHERE a strike lands and which phase it is in; the countdown is
 * animated locally from the moment the marker arrives (`seeHazard`), because a
 * rock's descent is decoration — the damage was resolved on the server the instant
 * the timer ran out, whatever this client happened to be drawing.
 *
 * A hazard changes state three times in its life (appears, lands, is swept up), so
 * the subscription is on that signature and NOT on the 20Hz state object.
 */

/** Rotation that lays a plane flat on the ground, facing up. */
const FLAT: [number, number, number] = [-Math.PI / 2, 0, 0];

/** Just above the floor, under the players' feet. */
const MARKER_Y = 0.05;

export function Hazards() {
  const signature = useGame(selectHazardsKey);

  // the signature IS the dependency: it changes exactly when a hazard appears,
  // detonates or is swept up — which is the only time this list needs rebuilding
  const live = useMemo(() => Object.entries(useGame.getState().hazards), [signature]);

  return (
    <>
      {live.map(([id, hazard]) => (
        <Meteor key={id} id={id} hazard={hazard} />
      ))}
      <Blasts />
    </>
  );
}

/**
 * One strike: a pulsing danger circle on the floor, a rock falling into it, and the
 * scorch it leaves behind.
 */
function Meteor({ id, hazard }: { id: string; hazard: HazardView }) {
  const rock = useRef<Group>(null);
  const marker = useRef<Mesh>(null);
  const warning = hazard.phase === HazardPhase.Warn;

  useFrame((state) => {
    const seenAt = seeHazard(id);
    const age = performance.now() - seenAt;

    if (rock.current) {
      // fall from the sky into the marker over the warning window
      const fall = clamp01(age / METEOR.warnMs);
      rock.current.visible = warning;
      rock.current.position.y = METEOR_FX.fallHeightM * (1 - fall * fall);
      rock.current.rotation.x = age * 0.004;
      rock.current.rotation.z = age * 0.003;
    }

    if (marker.current && warning) {
      // pulse faster and brighter as the impact closes in
      const urgency = clamp01(age / METEOR.warnMs);
      const beat =
        0.5 + 0.5 * Math.sin(state.clock.elapsedTime * METEOR_FX.warnPulseRate * (1 + urgency));
      const material = marker.current.material as MeshBasicMaterial;
      material.opacity = 0.25 + beat * 0.45 + urgency * 0.2;
      const size = 0.9 + beat * 0.06;
      marker.current.scale.set(size, size, size);
    }
  });

  return (
    <group position={[hazard.x, 0, hazard.z]}>
      {warning ? (
        <>
          {/* the danger circle: a filled disc inside a hard-edged rim */}
          <mesh ref={marker} rotation={FLAT} position={[0, MARKER_Y, 0]}>
            <circleGeometry args={[hazard.radius, 32]} />
            <meshBasicMaterial
              color={METEOR_COLORS.warnFill}
              transparent
              opacity={0.4}
              depthWrite={false}
            />
          </mesh>
          <mesh rotation={FLAT} position={[0, MARKER_Y + 0.01, 0]}>
            <ringGeometry args={[hazard.radius * 0.92, hazard.radius, 32]} />
            <meshBasicMaterial color={METEOR_COLORS.warn} transparent opacity={0.9} />
          </mesh>

          <group ref={rock}>
            <mesh castShadow>
              <dodecahedronGeometry args={[METEOR_FX.rockRadiusM, 0]} />
              <meshStandardMaterial
                color={METEOR_COLORS.rock}
                emissive={METEOR_COLORS.ember}
                emissiveIntensity={0.55}
                roughness={0.9}
              />
            </mesh>
            {/* a short tail of embers, thinning out behind it */}
            {Array.from({ length: METEOR_FX.emberCount }, (_, i) => (
              <mesh key={i} position={[0, METEOR_FX.rockRadiusM * (1.6 + i * 1.1), 0]}>
                <sphereGeometry args={[METEOR_FX.rockRadiusM * (0.42 - i * 0.06), 6, 6]} />
                <meshBasicMaterial
                  color={METEOR_COLORS.ember}
                  transparent
                  opacity={0.7 - i * 0.13}
                  depthWrite={false}
                />
              </mesh>
            ))}
          </group>
        </>
      ) : (
        /* the crater it left */
        <mesh rotation={FLAT} position={[0, MARKER_Y, 0]}>
          <circleGeometry args={[hazard.radius * 0.92, 28]} />
          <meshBasicMaterial
            color={METEOR_COLORS.scorch}
            transparent
            opacity={0.55}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
}

/**
 * The moment of impact: a flash and an expanding shockwave, driven off the `boom`
 * broadcast so it fires on the exact frame the server resolved the hit rather than
 * on the next state patch.
 */
function Blasts() {
  const group = useRef<Group>(null);

  useFrame(() => {
    const container = group.current;
    if (!container) return;
    const now = performance.now();

    container.children.forEach((node, index) => {
      const blast = blasts[index];
      if (!blast) {
        node.visible = false;
        return;
      }

      const progress = (now - blast.t) / METEOR_FX.flashMs;
      if (progress < 0 || progress > 1) {
        node.visible = false;
        return;
      }

      node.visible = true;
      node.position.set(blast.x, 0, blast.z);

      const [flash, wave] = node.children as Mesh[];
      const fade = 1 - progress;
      if (flash) {
        const size = blast.radius * (0.4 + progress * 0.9);
        flash.scale.set(size, size, size);
        (flash.material as MeshBasicMaterial).opacity = fade * 0.9;
      }
      if (wave) {
        const size = blast.radius * (0.5 + progress * METEOR_FX.shockwaveScale);
        wave.scale.set(size, size, size);
        (wave.material as MeshBasicMaterial).opacity = fade * 0.8;
      }
    });
  });

  // a fixed pool of reusable nodes — a storm never allocates geometry mid-flight
  return (
    <group ref={group}>
      {BLAST_SLOTS.map((slot) => (
        <group key={slot} visible={false}>
          <mesh position={[0, 0.6, 0]}>
            <sphereGeometry args={[1, 12, 10]} />
            <meshBasicMaterial
              color={METEOR_COLORS.flash}
              transparent
              opacity={0}
              depthWrite={false}
            />
          </mesh>
          <mesh rotation={FLAT} position={[0, MARKER_Y + 0.02, 0]}>
            <ringGeometry args={[0.72, 1, 32]} />
            <meshBasicMaterial
              color={METEOR_COLORS.shockwave}
              transparent
              opacity={0}
              depthWrite={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/**
 * Blast nodes are mounted once and reused, so a storm never allocates geometry mid
 * flight. The `blasts` queue in `combatFx` is capped at the same size, so slot `n`
 * always maps to `blasts[n]`.
 */
const BLAST_SLOTS = [0, 1, 2, 3, 4, 5, 6, 7];
