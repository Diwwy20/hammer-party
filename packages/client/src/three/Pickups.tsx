import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { PickupKind } from "@hammer/shared";
import { selectPickupsKey, useGame, type PickupView } from "../store";
import { SCENE } from "../config/view";
import { WEAPON_COLORS, pickupStyle } from "../config/theme";

/** Collectibles on the floor: weapon hammers and event orbs, bobbing and spinning. */

function PickupMesh({ pickup }: { pickup: PickupView }) {
  const bob = useRef<Group>(null);
  const style = pickupStyle(pickup.kind);

  useFrame((state) => {
    if (!bob.current) return;
    const t = state.clock.elapsedTime;
    bob.current.rotation.y = t * SCENE.pickupSpinRate;
    bob.current.position.y =
      SCENE.pickupHeightM + Math.sin(t * SCENE.pickupBobRate) * SCENE.pickupBobAmplitudeM;
  });

  return (
    <group position={[pickup.x, 0, pickup.z]}>
      <group ref={bob} position={[0, SCENE.pickupHeightM, 0]}>
        {pickup.kind === PickupKind.Heal ? (
          <mesh castShadow>
            <sphereGeometry args={[0.34, 16, 16]} />
            <meshStandardMaterial
              color={style.color}
              emissive={style.color}
              emissiveIntensity={style.glow}
            />
          </mesh>
        ) : (
          <group rotation={[0, 0, -0.5]}>
            <mesh position={[0, 0.18, 0]}>
              <cylinderGeometry args={[0.05, 0.05, 0.6, 8]} />
              <meshStandardMaterial color={WEAPON_COLORS.haft} />
            </mesh>
            <mesh position={[0, 0.5, 0]} castShadow>
              <boxGeometry args={[0.34, 0.28, 0.28]} />
              <meshStandardMaterial
                color={style.color}
                emissive={style.color}
                emissiveIntensity={style.glow}
                metalness={0.5}
                roughness={0.3}
              />
            </mesh>
          </group>
        )}
      </group>
      {/* floor marker so a pickup reads from across the arena */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <ringGeometry args={[0.5, 0.62, 24]} />
        <meshBasicMaterial color={style.color} />
      </mesh>
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
