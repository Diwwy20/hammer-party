import { Canvas } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import type { Cosmetic } from "../store";
import { AvatarBody } from "./cosmetics";

/** Lobby preview: the shared avatar body + a static shoulder hammer, on a podium. */
function Avatar({ cosmetic }: { cosmetic: Cosmetic }) {
  return (
    <group position={[0, 0, 0]}>
      <AvatarBody cosmetic={cosmetic} />
      {/* hammer resting on the shoulder */}
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
