import { BACKS, BackId, COSMETIC_NONE_ID, FACES, FaceId, HATS, HatId, TAU } from "@hammer/shared";
import type { Cosmetic } from "../store";
import { RIG } from "../config/view";
import { COSMETIC_COLORS, GHOST_COLORS } from "../config/theme";

/* ── Procedural low-poly cosmetic meshes (swap for glTF later) ────────────────
   Worn by the one shared `Character` everywhere the game draws somebody — the
   plaza, the arena, the ghosts and the join screen — so a hat looks identical in
   all of them.

   Every piece anchors off `RIG` (`config/view.ts`): the skull top is `RIG.hatY`,
   the face plane is `RIG.face`, the back is `RIG.back`. Nothing here hard-codes a
   height, because the character has been re-proportioned once already.          */

/** Every cosmetic takes this: what to draw, and how it should look on a ghost. */
interface CosmeticProps {
  id: string;
  /** true when worn by a dead player — drained of colour and see-through */
  ghost?: boolean;
  opacity?: number;
}

/** Resolve the three catalog indexes into the mesh ids this file switches on. */
export function cosmeticIds(cosmetic: Cosmetic): { hat: string; face: string; back: string } {
  return {
    hat: HATS[cosmetic.hatIndex]?.id ?? COSMETIC_NONE_ID,
    face: FACES[cosmetic.faceIndex]?.id ?? COSMETIC_NONE_ID,
    back: BACKS[cosmetic.backIndex]?.id ?? COSMETIC_NONE_ID,
  };
}

/** A ghost's gear fades with it, so nothing floats around looking solid. */
function tint(color: string, ghost?: boolean): string {
  return ghost ? GHOST_COLORS.trim : color;
}

/** Evenly spaced points for the crown's spikes. */
const SPIKES = [0, 1, 2, 3, 4];

export function Hat({ id, ghost, opacity = 1 }: CosmeticProps) {
  const see = { transparent: !!ghost, opacity };
  const c = COSMETIC_COLORS;

  switch (id) {
    case HatId.Cap:
      return (
        <group position={[0, RIG.hatY, 0]}>
          <mesh position={[0, 0.06, 0]} scale={[1, 0.6, 1]} castShadow>
            <sphereGeometry args={[RIG.head.radius * 0.92, 16, 12, 0, TAU, 0, Math.PI / 2]} />
            <meshStandardMaterial color={tint(c.capCrown, ghost)} roughness={0.7} {...see} />
          </mesh>
          <mesh position={[0, 0.04, RIG.head.radius * 0.72]} castShadow>
            <boxGeometry args={[0.44, 0.06, 0.34]} />
            <meshStandardMaterial color={tint(c.capBrim, ghost)} roughness={0.7} {...see} />
          </mesh>
        </group>
      );

    case HatId.Crown:
      return (
        <group position={[0, RIG.hatY + 0.04, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.3, 0.32, 0.16, 10]} />
            <meshStandardMaterial
              color={tint(c.gold, ghost)}
              metalness={ghost ? 0 : 0.85}
              roughness={0.25}
              emissive={ghost ? "#000000" : c.goldGlow}
              emissiveIntensity={ghost ? 0 : 0.35}
              {...see}
            />
          </mesh>
          {SPIKES.map((i) => {
            const a = (i / SPIKES.length) * TAU;
            return (
              <mesh key={i} position={[Math.cos(a) * 0.27, 0.16, Math.sin(a) * 0.27]} castShadow>
                <coneGeometry args={[0.065, 0.18, 6]} />
                <meshStandardMaterial
                  color={tint(c.goldLight, ghost)}
                  metalness={ghost ? 0 : 0.8}
                  roughness={0.25}
                  {...see}
                />
              </mesh>
            );
          })}
        </group>
      );

    case HatId.Horns:
      return (
        <group position={[0, RIG.hatY - 0.14, 0]}>
          {[-1, 1].map((side) => (
            <mesh
              key={side}
              position={[0.26 * side, 0.12, 0]}
              rotation={[0, 0, -0.55 * side]}
              castShadow
            >
              <coneGeometry args={[0.095, 0.4, 7]} />
              <meshStandardMaterial color={tint(c.bone, ghost)} roughness={0.6} {...see} />
            </mesh>
          ))}
        </group>
      );

    case HatId.TopHat:
      return (
        <group position={[0, RIG.hatY - 0.04, 0]}>
          {/* the brim is RED — it is what makes this the game's own hat rather than
              a generic black cylinder, and it reads from right across the arena */}
          <mesh castShadow>
            <cylinderGeometry args={[0.44, 0.44, 0.06, 20]} />
            <meshStandardMaterial color={tint(c.hatBrim, ghost)} roughness={0.55} {...see} />
          </mesh>
          <mesh position={[0, 0.3, 0]} castShadow>
            <cylinderGeometry args={[0.28, 0.29, 0.56, 20]} />
            <meshStandardMaterial color={tint(c.hatDark, ghost)} roughness={0.5} {...see} />
          </mesh>
          <mesh position={[0, 0.1, 0]}>
            <cylinderGeometry args={[0.295, 0.295, 0.1, 20]} />
            <meshStandardMaterial color={tint(c.ribbon, ghost)} roughness={0.6} {...see} />
          </mesh>
        </group>
      );

    case HatId.Party:
      return (
        <group position={[0, RIG.hatY - 0.02, 0]}>
          <mesh position={[0, 0.28, 0]} rotation={[0, 0, 0.12]} castShadow>
            <coneGeometry args={[0.27, 0.58, 16]} />
            <meshStandardMaterial color={tint(c.party, ghost)} roughness={0.65} {...see} />
          </mesh>
          <mesh position={[0.07, 0.6, 0]} castShadow>
            <sphereGeometry args={[0.1, 12, 12]} />
            <meshStandardMaterial
              color={tint(c.goldLight, ghost)}
              emissive={ghost ? "#000000" : c.gold}
              emissiveIntensity={ghost ? 0 : 0.5}
              {...see}
            />
          </mesh>
        </group>
      );

    default:
      return null;
  }
}

export function Face({ id, ghost, opacity = 1 }: CosmeticProps) {
  const see = { transparent: !!ghost, opacity };
  const c = COSMETIC_COLORS;
  const { y, z } = RIG.face;

  switch (id) {
    case FaceId.Shades:
      return (
        <group position={[0, y, z]}>
          <mesh>
            <boxGeometry args={[0.5, 0.15, 0.06]} />
            <meshStandardMaterial
              color={tint(c.lensDark, ghost)}
              roughness={0.25}
              metalness={ghost ? 0 : 0.4}
              {...see}
            />
          </mesh>
          {[-1, 1].map((side) => (
            <mesh key={side} position={[0.3 * side, 0.01, -0.09]}>
              <boxGeometry args={[0.14, 0.04, 0.04]} />
              <meshStandardMaterial color={tint(c.lensDark, ghost)} {...see} />
            </mesh>
          ))}
        </group>
      );

    case FaceId.Visor:
      return (
        <mesh position={[0, y, z - 0.02]} scale={[1, 0.42, 0.5]}>
          <sphereGeometry args={[0.36, 16, 12, 0, Math.PI]} />
          <meshStandardMaterial
            color={tint(c.visor, ghost)}
            emissive={ghost ? "#000000" : c.visor}
            emissiveIntensity={ghost ? 0 : 0.75}
            roughness={0.2}
            side={2}
            {...see}
          />
        </mesh>
      );

    case FaceId.Nerd:
      return (
        <group position={[0, y, z]}>
          {[-0.15, 0.15].map((x) => (
            <mesh key={x} position={[x, 0, 0]}>
              <torusGeometry args={[0.1, 0.025, 8, 16]} />
              <meshStandardMaterial color={tint(c.frame, ghost)} {...see} />
            </mesh>
          ))}
          {[-0.15, 0.15].map((x) => (
            <mesh key={`lens${x}`} position={[x, 0, -0.01]}>
              <circleGeometry args={[0.095, 16]} />
              <meshStandardMaterial
                color={tint(c.lensClear, ghost)}
                transparent
                opacity={opacity * 0.55}
              />
            </mesh>
          ))}
          <mesh>
            <boxGeometry args={[0.1, 0.02, 0.02]} />
            <meshStandardMaterial color={tint(c.frame, ghost)} {...see} />
          </mesh>
        </group>
      );

    case FaceId.Eyepatch:
      return (
        <group position={[0, y, z - 0.02]}>
          <mesh position={[-RIG.eye.x, 0.03, 0.02]}>
            <boxGeometry args={[0.22, 0.2, 0.05]} />
            <meshStandardMaterial color={tint(c.patch, ghost)} roughness={0.7} {...see} />
          </mesh>
          <mesh position={[0, 0.16, -0.1]} rotation={[0, 0, -0.42]}>
            <boxGeometry args={[0.72, 0.035, 0.035]} />
            <meshStandardMaterial color={tint(c.patch, ghost)} {...see} />
          </mesh>
        </group>
      );

    default:
      return null;
  }
}

export function Back({ id, ghost, opacity = 1 }: CosmeticProps) {
  const see = { transparent: !!ghost, opacity };
  const c = COSMETIC_COLORS;
  const { y, z } = RIG.back;

  switch (id) {
    case BackId.Cape:
      return (
        <mesh position={[0, y - 0.16, z + 0.06]} rotation={[0.16, 0, 0]} castShadow>
          <boxGeometry args={[0.74, 1, 0.05]} />
          <meshStandardMaterial color={tint(c.cape, ghost)} roughness={0.8} side={2} {...see} />
        </mesh>
      );

    case BackId.Backpack:
      return (
        <group position={[0, y - 0.06, z]}>
          <mesh castShadow>
            <boxGeometry args={[0.48, 0.56, 0.26]} />
            <meshStandardMaterial color={tint(c.pack, ghost)} roughness={0.8} {...see} />
          </mesh>
          <mesh position={[0, 0.08, 0.15]}>
            <boxGeometry args={[0.32, 0.22, 0.04]} />
            <meshStandardMaterial color={tint(c.packTrim, ghost)} {...see} />
          </mesh>
        </group>
      );

    case BackId.Wings:
      return (
        <group position={[0, y + 0.16, z + 0.04]}>
          {[-1, 1].map((side) => (
            <mesh
              key={side}
              position={[0.32 * side, 0, 0]}
              rotation={[0, 0.5 * side, 0.28 * side]}
              castShadow
            >
              <boxGeometry args={[0.5, 0.68, 0.05]} />
              <meshStandardMaterial
                color={tint(c.wing, ghost)}
                emissive={ghost ? "#000000" : c.wingGlow}
                emissiveIntensity={ghost ? 0 : 0.18}
                side={2}
                {...see}
              />
            </mesh>
          ))}
        </group>
      );

    case BackId.Jetpack:
      return (
        <group position={[0, y - 0.06, z]}>
          {[-0.2, 0.2].map((x) => (
            <mesh key={x} position={[x, 0, 0]} castShadow>
              <capsuleGeometry args={[0.12, 0.36, 4, 10]} />
              <meshStandardMaterial
                color={tint(c.metal, ghost)}
                metalness={ghost ? 0 : 0.45}
                roughness={0.5}
                {...see}
              />
            </mesh>
          ))}
          {[-0.2, 0.2].map((x) => (
            <mesh key={`flame${x}`} position={[x, -0.36, 0]} rotation={[Math.PI, 0, 0]}>
              <coneGeometry args={[0.1, 0.24, 10]} />
              <meshStandardMaterial
                color={tint(c.flame, ghost)}
                emissive={ghost ? "#000000" : c.flameGlow}
                emissiveIntensity={ghost ? 0 : 0.9}
                {...see}
              />
            </mesh>
          ))}
        </group>
      );

    default:
      return null;
  }
}
