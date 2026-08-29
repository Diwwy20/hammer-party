import {
  BACKS,
  BackId,
  COSMETIC_NONE_ID,
  FACES,
  FaceId,
  HATS,
  HatId,
  PLAYER_COLORS,
  TAU,
} from "@hammer/shared";
import type { Cosmetic } from "../store";

/* ── Procedural low-poly cosmetic meshes (swap for glTF later) ────────────────
   The shared avatar used everywhere the game draws a character — the plaza lobby
   and the in-game arena — so a hat/face/back looks identical in both. Head center
   ≈ [0, 1.98, 0], size 0.6³.                                                     */

/** Evenly spaced points for the crown's spikes. */
const SPIKES = [0, 1, 2, 3, 4];

export function Hat({ id }: { id: string }) {
  switch (id) {
    case HatId.Cap:
      return (
        <group>
          <mesh position={[0, 2.36, 0]} castShadow>
            <boxGeometry args={[0.64, 0.24, 0.62]} />
            <meshStandardMaterial color="#3fae6a" />
          </mesh>
          <mesh position={[0, 2.3, 0.36]} castShadow>
            <boxGeometry args={[0.5, 0.06, 0.34]} />
            <meshStandardMaterial color="#2f9455" />
          </mesh>
        </group>
      );
    case HatId.Crown:
      return (
        <group position={[0, 2.42, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.34, 0.34, 0.18, 8]} />
            <meshStandardMaterial
              color="#e8c583"
              metalness={0.85}
              roughness={0.25}
              emissive="#7a5a1e"
              emissiveIntensity={0.4}
            />
          </mesh>
          {SPIKES.map((i) => {
            const a = (i / SPIKES.length) * TAU;
            return (
              <mesh key={i} position={[Math.cos(a) * 0.3, 0.16, Math.sin(a) * 0.3]} castShadow>
                <coneGeometry args={[0.07, 0.18, 6]} />
                <meshStandardMaterial color="#f8e6b6" metalness={0.8} roughness={0.25} />
              </mesh>
            );
          })}
        </group>
      );
    case HatId.Horns:
      return (
        <group position={[0, 2.24, 0]}>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[0.28 * s, 0.14, 0]} rotation={[0, 0, -0.5 * s]} castShadow>
              <coneGeometry args={[0.1, 0.42, 7]} />
              <meshStandardMaterial color="#efe6d2" />
            </mesh>
          ))}
        </group>
      );
    case HatId.TopHat:
      return (
        <group position={[0, 2.3, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.46, 0.46, 0.06, 20]} />
            <meshStandardMaterial color="#15161c" />
          </mesh>
          <mesh position={[0, 0.32, 0]} castShadow>
            <cylinderGeometry args={[0.3, 0.3, 0.58, 20]} />
            <meshStandardMaterial color="#1b1c24" />
          </mesh>
          <mesh position={[0, 0.12, 0]}>
            <cylinderGeometry args={[0.305, 0.305, 0.1, 20]} />
            <meshStandardMaterial color="#b0324a" />
          </mesh>
        </group>
      );
    case HatId.Party:
      return (
        <group position={[0, 2.32, 0]}>
          <mesh position={[0, 0.28, 0]} castShadow>
            <coneGeometry args={[0.3, 0.56, 18]} />
            <meshStandardMaterial color="#e05aa0" />
          </mesh>
          <mesh position={[0, 0.6, 0]} castShadow>
            <sphereGeometry args={[0.09, 12, 12]} />
            <meshStandardMaterial color="#f8e6b6" emissive="#e8c583" emissiveIntensity={0.5} />
          </mesh>
        </group>
      );
    default:
      return null;
  }
}

export function Face({ id }: { id: string }) {
  const z = 0.29;
  const y = 2.04;
  switch (id) {
    case FaceId.Shades:
      return (
        <mesh position={[0, y, z]}>
          <boxGeometry args={[0.52, 0.13, 0.06]} />
          <meshStandardMaterial color="#101014" roughness={0.3} metalness={0.4} />
        </mesh>
      );
    case FaceId.Visor:
      return (
        <mesh position={[0, y, z]}>
          <boxGeometry args={[0.54, 0.16, 0.05]} />
          <meshStandardMaterial
            color="#39e0e0"
            emissive="#39e0e0"
            emissiveIntensity={0.8}
            roughness={0.2}
          />
        </mesh>
      );
    case FaceId.Nerd:
      return (
        <group position={[0, y, z]}>
          {[-0.14, 0.14].map((x) => (
            <mesh key={x} position={[x, 0, 0]}>
              <boxGeometry args={[0.17, 0.17, 0.04]} />
              <meshStandardMaterial color="#bfe3ff" emissive="#2b6fa0" emissiveIntensity={0.2} />
            </mesh>
          ))}
          <mesh>
            <boxGeometry args={[0.12, 0.04, 0.04]} />
            <meshStandardMaterial color="#2a2a2a" />
          </mesh>
        </group>
      );
    case FaceId.Eyepatch:
      return (
        <group position={[0, y, z]}>
          <mesh position={[-0.14, 0, 0]}>
            <boxGeometry args={[0.2, 0.2, 0.05]} />
            <meshStandardMaterial color="#141414" />
          </mesh>
          <mesh position={[0.02, 0.12, -0.02]} rotation={[0, 0, -0.5]}>
            <boxGeometry args={[0.6, 0.04, 0.04]} />
            <meshStandardMaterial color="#141414" />
          </mesh>
        </group>
      );
    default:
      return null;
  }
}

export function Back({ id }: { id: string }) {
  switch (id) {
    case BackId.Cape:
      return (
        <mesh position={[0, 1.08, -0.32]} rotation={[0.14, 0, 0]} castShadow>
          <boxGeometry args={[0.74, 1.05, 0.05]} />
          <meshStandardMaterial color="#b0324a" side={2} />
        </mesh>
      );
    case BackId.Backpack:
      return (
        <group position={[0, 1.15, -0.36]}>
          <mesh castShadow>
            <boxGeometry args={[0.5, 0.62, 0.28]} />
            <meshStandardMaterial color="#6f4f30" />
          </mesh>
          <mesh position={[0, 0.1, 0.16]}>
            <boxGeometry args={[0.34, 0.24, 0.04]} />
            <meshStandardMaterial color="#8a6540" />
          </mesh>
        </group>
      );
    case BackId.Wings:
      return (
        <group position={[0, 1.3, -0.28]}>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[0.34 * s, 0, 0]} rotation={[0, 0.5 * s, 0.25 * s]} castShadow>
              <boxGeometry args={[0.5, 0.7, 0.05]} />
              <meshStandardMaterial
                color="#eaf2ff"
                emissive="#8fb6ff"
                emissiveIntensity={0.15}
                side={2}
              />
            </mesh>
          ))}
        </group>
      );
    case BackId.Jetpack:
      return (
        <group position={[0, 1.16, -0.36]}>
          {[-0.22, 0.22].map((x) => (
            <mesh key={x} position={[x, 0, 0]} castShadow>
              <cylinderGeometry args={[0.13, 0.13, 0.62, 12]} />
              <meshStandardMaterial color="#3a4150" metalness={0.4} roughness={0.5} />
            </mesh>
          ))}
          {[-0.22, 0.22].map((x) => (
            <mesh key={"f" + x} position={[x, -0.42, 0]}>
              <coneGeometry args={[0.1, 0.24, 10]} />
              <meshStandardMaterial color="#ff8a3a" emissive="#ff6a1a" emissiveIntensity={0.9} />
            </mesh>
          ))}
        </group>
      );
    default:
      return null;
  }
}

/**
 * The blocky low-poly body (legs + torso + head) with cosmetics layered on.
 *
 * The SAME avatar draws the plaza lobby and the arena, so a hat looks identical in
 * both and a dress-up edit shows up in-world immediately. No hammer here — that is
 * the animated view-model in `PlayerAvatar`.
 */
export function AvatarBody({ cosmetic, isMe = false }: { cosmetic: Cosmetic; isMe?: boolean }) {
  const color = PLAYER_COLORS[cosmetic.colorIndex] ?? PLAYER_COLORS[0];
  const hatId = HATS[cosmetic.hatIndex]?.id ?? COSMETIC_NONE_ID;
  const faceId = FACES[cosmetic.faceIndex]?.id ?? COSMETIC_NONE_ID;
  const backId = BACKS[cosmetic.backIndex]?.id ?? COSMETIC_NONE_ID;

  return (
    <group>
      <Back id={backId} />
      {/* legs */}
      <mesh position={[-0.22, 0.35, 0]} castShadow>
        <boxGeometry args={[0.28, 0.7, 0.3]} />
        <meshStandardMaterial color="#6f4f30" />
      </mesh>
      <mesh position={[0.22, 0.35, 0]} castShadow>
        <boxGeometry args={[0.28, 0.7, 0.3]} />
        <meshStandardMaterial color="#6f4f30" />
      </mesh>
      {/* body */}
      <mesh position={[0, 1.15, 0]} castShadow>
        <boxGeometry args={[0.82, 0.9, 0.5]} />
        <meshStandardMaterial
          color={color}
          emissive={isMe ? color : "#000000"}
          emissiveIntensity={isMe ? 0.22 : 0}
          roughness={0.6}
          metalness={0.05}
        />
      </mesh>
      {/* head */}
      <mesh position={[0, 1.98, 0]} castShadow>
        <boxGeometry args={[0.6, 0.56, 0.56]} />
        <meshStandardMaterial color="#f0c9a0" />
      </mesh>
      <Face id={faceId} />
      <Hat id={hatId} />
    </group>
  );
}
