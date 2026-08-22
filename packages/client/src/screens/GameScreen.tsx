import { useEffect, useRef, type MutableRefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Grid, Html, OrbitControls } from "@react-three/drei";
import type { Group } from "three";
import nipplejs from "nipplejs";
import { ARENA_RADIUS, INPUT_SEND_HZ, MOVE_SPEED, PLAYER_COLORS, PLAYER_RADIUS } from "@hammer/shared";
import { useGame } from "../store";
import { leaveRoom, sendInput } from "../net/session";
import { latest, sampleOther } from "../net/movement";

type Vec = { dx: number; dz: number };
type Self = { x: number; z: number; dir: number; ready: boolean };

/** One player: own avatar is client-predicted; others are interpolated. */
function PlayerAvatar({ id, isMe, self }: { id: string; isMe: boolean; self: MutableRefObject<Self> }) {
  const g = useRef<Group>(null);
  const color = useGame((s) => PLAYER_COLORS[s.players[id]?.colorIndex ?? 1]);
  const name = useGame((s) => s.players[id]?.name ?? "");

  useFrame(() => {
    const grp = g.current;
    if (!grp) return;
    if (isMe) {
      grp.position.set(self.current.x, 0, self.current.z);
      grp.rotation.y = self.current.dir;
    } else {
      const p = sampleOther(id, performance.now());
      if (p) {
        grp.position.set(p.x, 0, p.z);
        grp.rotation.y = p.dir;
      }
    }
  });

  return (
    <group ref={g}>
      <mesh position={[0, 0.6, 0]} castShadow>
        <boxGeometry args={[0.8, 1.2, 0.8]} />
        <meshStandardMaterial color={color} emissive={isMe ? color : "#000000"} emissiveIntensity={isMe ? 0.3 : 0} />
      </mesh>
      {/* facing marker */}
      <mesh position={[0, 0.6, 0.5]} castShadow>
        <boxGeometry args={[0.24, 0.24, 0.24]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      <Html position={[0, 1.7, 0]} center distanceFactor={14} zIndexRange={[10, 0]} className="pointer-events-none">
        <div className="whitespace-nowrap rounded-full bg-white/85 px-2 py-0.5 text-xs font-bold text-ink shadow">
          {name}
        </div>
      </Html>
    </group>
  );
}

function World({ ids, sessionId, isHost, input }: { ids: string[]; sessionId?: string; isHost: boolean; input: MutableRefObject<Vec> }) {
  const self = useRef<Self>({ x: 0, z: 0, dir: 0, ready: false });
  const maxR = ARENA_RADIUS - PLAYER_RADIUS;

  useFrame((state, dt) => {
    if (isHost || !sessionId) return;

    // snap to the authoritative spawn the first time we hear about ourselves
    if (!self.current.ready) {
      const s = latest(sessionId);
      if (s) self.current = { x: s.x, z: s.z, dir: s.dir, ready: true };
    }

    // client-side prediction from the same input we send up
    const { dx, dz } = input.current;
    if (dx !== 0 || dz !== 0) {
      self.current.x += dx * MOVE_SPEED * dt;
      self.current.z += dz * MOVE_SPEED * dt;
      const r = Math.hypot(self.current.x, self.current.z);
      if (r > maxR) {
        self.current.x = (self.current.x / r) * maxR;
        self.current.z = (self.current.z / r) * maxR;
      }
      self.current.dir = Math.atan2(dx, dz);
    }

    // gently reconcile toward the server to correct drift
    const server = latest(sessionId);
    if (server) {
      const k = 1 - Math.exp(-dt * 5);
      self.current.x += (server.x - self.current.x) * k;
      self.current.z += (server.z - self.current.z) * k;
    }

    // third-person follow camera
    const cam = state.camera;
    const tx = self.current.x;
    const tz = self.current.z;
    const ck = 1 - Math.exp(-dt * 6);
    cam.position.x += (tx - cam.position.x) * ck;
    cam.position.z += (tz + 11 - cam.position.z) * ck;
    cam.position.y += (10 - cam.position.y) * ck;
    cam.lookAt(tx, 1, tz);
  });

  return (
    <>
      <color attach="background" args={["#bfe4ff"]} />
      <ambientLight intensity={0.8} />
      <directionalLight position={[10, 18, 8]} intensity={1.2} castShadow shadow-mapSize={[2048, 2048]} />

      {/* arena floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[ARENA_RADIUS, 64]} />
        <meshStandardMaterial color="#eaf6ff" />
      </mesh>
      {/* boundary ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[ARENA_RADIUS - 0.3, ARENA_RADIUS, 64]} />
        <meshBasicMaterial color="#38a3ff" />
      </mesh>
      <Grid
        args={[ARENA_RADIUS * 2, ARENA_RADIUS * 2]}
        cellSize={2}
        cellColor="#cfe0ef"
        sectionSize={10}
        sectionColor="#a9c9e6"
        fadeDistance={60}
        position={[0, 0.01, 0]}
      />

      {ids.map((id) => (
        <PlayerAvatar key={id} id={id} isMe={id === sessionId} self={self} />
      ))}

      {isHost && <OrbitControls target={[0, 0.5, 0]} maxPolarAngle={Math.PI / 2.1} enableDamping />}
    </>
  );
}

/** DOM virtual joystick (nipplejs). Writes to `input` and streams it up at INPUT_SEND_HZ. */
function Joystick({ input }: { input: MutableRefObject<Vec> }) {
  const zone = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!zone.current) return;
    const manager = nipplejs.create({
      zone: zone.current,
      mode: "static",
      position: { left: "50%", top: "50%" },
      color: "#38a3ff",
      size: 110,
      restJoystick: true,
    });

    manager.on("move", (evt) => {
      const v = evt?.data?.vector;
      if (v) input.current = { dx: v.x, dz: v.y };
    });
    manager.on("end", () => {
      input.current = { dx: 0, dz: 0 };
    });

    let last: Vec = { dx: 0, dz: 0 };
    const timer = window.setInterval(() => {
      const { dx, dz } = input.current;
      if (dx !== last.dx || dz !== last.dz) {
        sendInput(dx, dz);
        last = { dx, dz };
      }
    }, 1000 / INPUT_SEND_HZ);

    return () => {
      window.clearInterval(timer);
      manager.destroy();
    };
  }, [input]);

  return <div ref={zone} className="fixed bottom-6 left-6 h-[140px] w-[140px] touch-none" />;
}

export function GameScreen() {
  const idsKey = useGame((s) => Object.keys(s.players).sort().join("|"));
  const sessionId = useGame((s) => s.sessionId);
  const isHost = useGame((s) => s.isHost);
  const input = useRef<Vec>({ dx: 0, dz: 0 });

  const ids = idsKey ? idsKey.split("|") : [];

  return (
    <div className="fixed inset-0">
      <Canvas shadows camera={{ position: [0, 12, 16], fov: 50 }}>
        <World ids={ids} sessionId={sessionId} isHost={isHost} input={input} />
      </Canvas>

      {!isHost && <Joystick input={input} />}

      <div className="hud">
        <b>⚔ กำลังประลอง</b> · {ids.length} คน
        <div className="muted text-[11px]">{isHost ? "มุมมองเจ้าภาพ" : "ลากจอยสติ๊กเพื่อเดิน"}</div>
      </div>

      <button className="btn btn--ghost fixed right-4 top-3 w-auto px-4 py-2 text-sm" onClick={leaveRoom}>
        ออก
      </button>
    </div>
  );
}
