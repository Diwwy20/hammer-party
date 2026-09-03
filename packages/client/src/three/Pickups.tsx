import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh } from "three";
import { PickupKind } from "@hammer/shared";
import { selectPickupsKey, useGame, type PickupView } from "../store";
import { SCENE } from "../config/view";
import { pickupStyle } from "../config/theme";
import { HammerModel } from "./Hammer";

/**
 * Collectibles on the floor: weapon hammers and event orbs, bobbing and spinning
 * over a pulsing pad of their own colour.
 *
 * A weapon on the floor is drawn with the SAME `HammerModel` you end up holding —
 * same kind, same shape, same metal — so what you ran across the arena for is
 * recognisably what you got.
 */

function PickupMesh({ pickup }: { pickup: PickupView }) {
  const bob = useRef<Group>(null);
  const pad = useRef<Mesh>(null);
  const style = pickupStyle(pickup.kind);
  const isHeal = pickup.kind === PickupKind.Heal;

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (bob.current) {
      bob.current.rotation.y = t * SCENE.pickupSpinRate;
      bob.current.position.y =
        SCENE.pickupHeightM + Math.sin(t * SCENE.pickupBobRate) * SCENE.pickupBobAmplitudeM;
    }
    // the pad breathes, so a pickup catches the eye from across the arena
    if (pad.current) {
      const pulse = 1 + Math.sin(t * SCENE.pickupGlowRate) * 0.12;
      pad.current.scale.set(pulse, pulse, 1);
    }
  });

  return (
    <group position={[pickup.x, 0, pickup.z]}>
      <group ref={bob} position={[0, SCENE.pickupHeightM, 0]}>
        {isHeal ? (
          <HealOrb color={style.color} glow={style.glow} />
        ) : (
          <group rotation={[0.35, 0, -0.4]} scale={SCENE.pickupHammerScale}>
            <HammerModel kind={pickup.kind} />
          </group>
        )}
      </group>

      {/* the pad it stands on: a soft disc plus the ring that reads from far off */}
      <mesh ref={pad} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <circleGeometry args={[SCENE.pickupGlowM, 24]} />
        <meshBasicMaterial color={style.color} transparent opacity={0.18} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <ringGeometry args={[0.52, 0.64, 24]} />
        <meshBasicMaterial color={style.color} transparent opacity={0.85} />
      </mesh>
    </group>
  );
}

/** The heal orb: a glowing ball with a white cross floating inside it. */
function HealOrb({ color, glow }: { color: string; glow: number }) {
  return (
    <group>
      <mesh castShadow>
        <sphereGeometry args={[0.34, 16, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={glow} />
      </mesh>
      {[
        [0.34, 0.11, 0.11],
        [0.11, 0.34, 0.11],
      ].map((size) => (
        <mesh key={size.join()} position={[0, 0, 0.24]}>
          <boxGeometry args={size as [number, number, number]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Pickups never move, so this re-renders only when one is taken, respawns, or the
 * set changes — the subscription is on that signature, not on the 20Hz state object.
 */
export function Pickups() {
  const signature = useGame(selectPickupsKey);

  const active = useMemo(
    () => Object.entries(useGame.getState().pickups).filter(([, pickup]) => pickup.active),
    [signature],
  );

  return (
    <>
      {active.map(([id, pickup]) => (
        <PickupMesh key={id} pickup={pickup} />
      ))}
    </>
  );
}
