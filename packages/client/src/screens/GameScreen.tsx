import { Canvas } from "@react-three/fiber";
import { Grid, OrbitControls } from "@react-three/drei";
import { ARENA_RADIUS, PLAYER_COLORS } from "@hammer/shared";
import { useGame } from "../store";

/** One box per player. No movement yet (Phase 01 next slice) — lay them on a ring. */
function Players() {
  const players = useGame((s) => s.players);
  const mySession = useGame((s) => s.sessionId);
  const ids = Object.keys(players);

  return (
    <>
      {ids.map((id, i) => {
        const p = players[id];
        const ring = ids.length > 1 ? 3 : 0;
        const angle = (i / Math.max(1, ids.length)) * Math.PI * 2;
        const x = p.x || Math.cos(angle) * ring;
        const z = p.z || Math.sin(angle) * ring;
        const isMe = id === mySession;
        const color = PLAYER_COLORS[p.colorIndex] ?? PLAYER_COLORS[0];

        return (
          <mesh key={id} position={[x, 0.6, z]} castShadow>
            <boxGeometry args={[0.8, 1.2, 0.8]} />
            <meshStandardMaterial
              color={color}
              emissive={isMe ? color : "#000000"}
              emissiveIntensity={isMe ? 0.35 : 0}
            />
          </mesh>
        );
      })}
    </>
  );
}

function Arena() {
  return (
    <>
      <color attach="background" args={["#0e1116"]} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[8, 14, 6]} intensity={1.1} castShadow />

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[ARENA_RADIUS, 48]} />
        <meshStandardMaterial color="#1b2430" />
      </mesh>
      <Grid
        args={[ARENA_RADIUS * 2, ARENA_RADIUS * 2]}
        cellSize={2}
        cellColor="#2a3646"
        sectionSize={10}
        sectionColor="#3a4a5e"
        infiniteGrid={false}
        fadeDistance={70}
        position={[0, 0.01, 0]}
      />

      <Players />
      <OrbitControls target={[0, 0.5, 0]} maxPolarAngle={Math.PI / 2.1} enableDamping />
    </>
  );
}

export function GameScreen() {
  const count = useGame((s) => Object.keys(s.players).length);
  return (
    <>
      <Canvas shadows camera={{ position: [0, 11, 15], fov: 50 }}>
        <Arena />
      </Canvas>
      <div className="hud">
        <b>⚔ กำลังประลอง</b> · {count} คน
        <div className="muted" style={{ fontSize: 11 }}>movement/combat มาเฟสถัดไป</div>
      </div>
    </>
  );
}
