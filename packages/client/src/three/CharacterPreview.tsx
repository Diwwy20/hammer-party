import { Canvas } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import { BACKS, FACES, HATS, PLAYER_COLORS } from "@hammer/shared";
import type { Cosmetic } from "../store";

/* ── Cosmetic meshes (procedural low-poly; swap for glTF later) ──────────────
   Head center ≈ [0, 1.98, 0], size 0.6³ → top ≈ 2.26, front z ≈ 0.28.        */

function Hat({ id }: { id: string }) {
  switch (id) {
    case "cap":
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
    case "crown":
      return (
        <group position={[0, 2.42, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.34, 0.34, 0.18, 8]} />
            <meshStandardMaterial color="#e8c583" metalness={0.85} roughness={0.25} emissive="#7a5a1e" emissiveIntensity={0.4} />
          </mesh>
          {[0, 1, 2, 3, 4].map((i) => {
            const a = (i / 5) * Math.PI * 2;
            return (
              <mesh key={i} position={[Math.cos(a) * 0.3, 0.16, Math.sin(a) * 0.3]} castShadow>
                <coneGeometry args={[0.07, 0.18, 6]} />
                <meshStandardMaterial color="#f8e6b6" metalness={0.8} roughness={0.25} />
              </mesh>
            );
          })}
        </group>
      );
    case "horns":
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
    case "tophat":
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
    case "party":
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

function Face({ id }: { id: string }) {
  const z = 0.29;
  const y = 2.04;
  switch (id) {
    case "shades":
      return (
        <mesh position={[0, y, z]}>
          <boxGeometry args={[0.52, 0.13, 0.06]} />
          <meshStandardMaterial color="#101014" roughness={0.3} metalness={0.4} />
        </mesh>
      );
    case "visor":
      return (
        <mesh position={[0, y, z]}>
          <boxGeometry args={[0.54, 0.16, 0.05]} />
          <meshStandardMaterial color="#39e0e0" emissive="#39e0e0" emissiveIntensity={0.8} roughness={0.2} />
        </mesh>
      );
    case "nerd":
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
    case "eyepatch":
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

function Back({ id }: { id: string }) {
  switch (id) {
    case "cape":
      return (
        <mesh position={[0, 1.08, -0.32]} rotation={[0.14, 0, 0]} castShadow>
          <boxGeometry args={[0.74, 1.05, 0.05]} />
          <meshStandardMaterial color="#b0324a" side={2} />
        </mesh>
      );
    case "backpack":
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
    case "wings":
      return (
        <group position={[0, 1.3, -0.28]}>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[0.34 * s, 0, 0]} rotation={[0, 0.5 * s, 0.25 * s]} castShadow>
              <boxGeometry args={[0.5, 0.7, 0.05]} />
              <meshStandardMaterial color="#eaf2ff" emissive="#8fb6ff" emissiveIntensity={0.15} side={2} />
            </mesh>
          ))}
        </group>
      );
    case "jetpack":
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

function Avatar({ cosmetic }: { cosmetic: Cosmetic }) {
  const color = PLAYER_COLORS[cosmetic.colorIndex] ?? PLAYER_COLORS[0];
  const hatId = HATS[cosmetic.hatIndex]?.id ?? "none";
  const faceId = FACES[cosmetic.faceIndex]?.id ?? "none";
  const backId = BACKS[cosmetic.backIndex]?.id ?? "none";

  return (
    <group position={[0, 0, 0]}>
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
        <meshStandardMaterial color={color} roughness={0.6} metalness={0.05} />
      </mesh>
      {/* head */}
      <mesh position={[0, 1.98, 0]} castShadow>
        <boxGeometry args={[0.6, 0.56, 0.56]} />
        <meshStandardMaterial color="#f0c9a0" />
      </mesh>
      <Face id={faceId} />
      <Hat id={hatId} />
      {/* hammer on the shoulder */}
      <group position={[0.56, 1.2, 0.12]} rotation={[0, 0, -0.5]}>
        <mesh position={[0, 0.42, 0]} castShadow>
          <cylinderGeometry args={[0.05, 0.05, 0.95, 8]} />
          <meshStandardMaterial color="#5a3a1e" />
        </mesh>
        <mesh position={[0, 0.95, 0]} castShadow>
          <boxGeometry args={[0.34, 0.28, 0.28]} />
          <meshStandardMaterial color="#c9d2da" metalness={0.5} roughness={0.35} />
        </mesh>
      </group>
    </group>
  );
}

export function CharacterPreview({ cosmetic }: { cosmetic: Cosmetic }) {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true }}
      camera={{ position: [0.4, 1.35, 4.7], fov: 38 }}
      style={{ background: "transparent" }}
    >
      {/* bright, flat cartoon lighting */}
      <ambientLight intensity={0.95} />
      <directionalLight position={[3, 6, 4]} intensity={1.05} color="#ffffff" castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-4, 3, -2]} intensity={0.4} color="#cfe4ff" />
      <pointLight position={[0, 2.4, 2.5]} intensity={0.3} color="#ffffff" />

      <Avatar cosmetic={cosmetic} />
      {/* podium */}
      <group position={[0, -0.05, 0]}>
        <mesh position={[0, -0.09, 0]} receiveShadow>
          <cylinderGeometry args={[1.35, 1.5, 0.18, 48]} />
          <meshStandardMaterial color="#dbe8f5" roughness={0.9} metalness={0} />
        </mesh>
        <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.33, 0.035, 12, 60]} />
          <meshStandardMaterial color="#38a3ff" metalness={0.1} roughness={0.6} />
        </mesh>
      </group>
      <ContactShadows position={[0, -0.14, 0]} opacity={0.32} scale={4} blur={2.8} far={3} color="#5b7da6" />

      <OrbitControls
        autoRotate
        autoRotateSpeed={1.1}
        enableZoom={false}
        enablePan={false}
        minPolarAngle={Math.PI / 2.5}
        maxPolarAngle={Math.PI / 2.02}
        target={[0, 1.05, 0]}
      />
    </Canvas>
  );
}
