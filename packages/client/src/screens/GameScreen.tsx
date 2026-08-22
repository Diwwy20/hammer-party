import { useEffect, useRef, type MutableRefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Grid, Html, OrbitControls } from "@react-three/drei";
import type { Group } from "three";
import nipplejs from "nipplejs";
import {
  ARENA_RADIUS,
  HAMMERS,
  HP_MAX,
  INPUT_SEND_HZ,
  MOVE_SPEED,
  PLAYER_COLORS,
  PLAYER_RADIUS,
  type HammerKind,
} from "@hammer/shared";
import { useGame } from "../store";
import { leaveRoom, sendAttack, sendInput, sendRestart } from "../net/session";
import { latest, sampleOther } from "../net/movement";
import { markSwing, swingAt } from "../net/combat";

type Vec = { dx: number; dz: number };
type Self = { x: number; z: number; dir: number; ready: boolean };

/** First-person eye height (m). Just above the avatar's head. */
const EYE_HEIGHT = 1.5;
/** Swing animation length (ms). Purely visual; the server owns the real cooldown. */
const SWING_MS = 300;

/** One player. Own avatar is client-predicted; others are interpolated ~100ms back. */
function PlayerAvatar({
  id,
  isMe,
  fpSelf,
  self,
}: {
  id: string;
  isMe: boolean;
  /** true when this is the local player rendered in first-person (hide the body). */
  fpSelf: boolean;
  self: MutableRefObject<Self>;
}) {
  const g = useRef<Group>(null); // world transform (position + facing)
  const tip = useRef<Group>(null); // ragdoll tip-over on death (client-only)
  const hammer = useRef<Group>(null); // swing pivot
  const dead = useRef(0); // 0..1 ragdoll progress

  const color = useGame((s) => PLAYER_COLORS[s.players[id]?.colorIndex ?? 1]);
  const name = useGame((s) => s.players[id]?.name ?? "");
  const hp = useGame((s) => s.players[id]?.hp ?? HP_MAX);
  const alive = useGame((s) => s.players[id]?.alive ?? true);
  const connected = useGame((s) => s.players[id]?.connected ?? true);

  useFrame((_, dt) => {
    const grp = g.current;
    if (!grp) return;

    // position + facing
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

    // ragdoll: tip over + sink when dead
    dead.current += ((alive ? 0 : 1) - dead.current) * (1 - Math.exp(-dt * 6));
    if (tip.current) {
      tip.current.rotation.z = dead.current * 1.45;
      tip.current.position.y = -dead.current * 0.3;
    }

    // hammer swing (driven by the shared swingAt map)
    if (hammer.current) {
      const started = swingAt[id] ?? -1;
      const t = started > 0 ? (performance.now() - started) / SWING_MS : 2;
      const strike = t >= 0 && t <= 1 ? Math.sin(t * Math.PI) : 0;
      hammer.current.rotation.x = -0.5 - strike * 1.95;
    }
  });

  const ratio = Math.max(0, Math.min(1, hp / HP_MAX));

  return (
    <group ref={g}>
      <group ref={tip}>
        {/* body — hidden for the local first-person avatar so it never blocks the view */}
        {!fpSelf && (
          <>
            <mesh position={[0, 0.62, 0]} castShadow>
              <boxGeometry args={[0.7, 0.9, 0.5]} />
              <meshStandardMaterial
                color={color}
                emissive={isMe ? color : "#000000"}
                emissiveIntensity={isMe ? 0.25 : 0}
              />
            </mesh>
            <mesh position={[0, 1.25, 0]} castShadow>
              <boxGeometry args={[0.44, 0.42, 0.44]} />
              <meshStandardMaterial color="#f0c9a0" />
            </mesh>
            {/* facing nose so others can read which way you point */}
            <mesh position={[0, 1.25, 0.26]}>
              <boxGeometry args={[0.14, 0.14, 0.08]} />
              <meshStandardMaterial color="#ffffff" />
            </mesh>
          </>
        )}

        {/* held hammer (always shown — it's the first-person view-model too) */}
        <group ref={hammer} position={[0.34, 1.02, 0.16]}>
          <mesh position={[0, 0.34, 0]} castShadow>
            <cylinderGeometry args={[0.05, 0.05, 0.8, 8]} />
            <meshStandardMaterial color="#5a3a1e" />
          </mesh>
          <mesh position={[0, 0.78, 0]} castShadow>
            <boxGeometry args={[0.3, 0.26, 0.26]} />
            <meshStandardMaterial color="#c9d2da" metalness={0.5} roughness={0.35} />
          </mesh>
        </group>
      </group>

      {/* name + health, upright above the head (not for your own FP avatar) */}
      {!fpSelf && (
        <Html position={[0, 1.85, 0]} center distanceFactor={15} zIndexRange={[10, 0]} className="pointer-events-none">
          <div className="flex flex-col items-center gap-0.5" style={{ opacity: connected ? 1 : 0.45 }}>
            <div className="whitespace-nowrap rounded-full bg-white/85 px-2 py-0.5 text-xs font-bold text-ink shadow">
              {alive ? name : `💀 ${name}`}
            </div>
            {alive && (
              <div
                style={{
                  width: 46,
                  height: 6,
                  borderRadius: 4,
                  background: "rgba(255,255,255,0.7)",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${ratio * 100}%`,
                    height: "100%",
                    background: hpColor(ratio),
                    transition: "width 120ms linear",
                  }}
                />
              </div>
            )}
          </div>
        </Html>
      )}
    </group>
  );
}

function World({
  ids,
  sessionId,
  isHost,
  input,
}: {
  ids: string[];
  sessionId?: string;
  isHost: boolean;
  input: MutableRefObject<Vec>;
}) {
  const self = useRef<Self>({ x: 0, z: 0, dir: 0, ready: false });
  const camYaw = useRef(0);
  const maxR = ARENA_RADIUS - PLAYER_RADIUS;
  const { camera } = useThree();

  const meAlive = useGame((s) => (s.sessionId ? (s.players[s.sessionId]?.alive ?? true) : true));
  const meStunned = useGame((s) => (s.sessionId ? (s.players[s.sessionId]?.stunned ?? false) : false));
  const phase = useGame((s) => s.phase);

  // First-person for the living local player; free spectator cam for the host and the dead.
  const fpActive = !isHost && !!sessionId && meAlive;
  const spectator = isHost || (!!sessionId && !meAlive);

  // Lift to a spectator vantage the moment we start spectating (death / host).
  useEffect(() => {
    if (spectator) camera.position.set(0, 16, 22);
  }, [spectator, camera]);

  useFrame((state, dt) => {
    if (!fpActive || !sessionId) return; // spectator: OrbitControls drives the camera

    // snap to the authoritative spawn the first time we hear about ourselves
    if (!self.current.ready) {
      const s = latest(sessionId);
      if (s) {
        self.current = { x: s.x, z: s.z, dir: s.dir, ready: true };
        camYaw.current = s.dir;
      }
    }

    // client-side prediction from the same input we send up (suppressed while stunned)
    const { dx, dz } = input.current;
    if (!meStunned && phase === "playing" && (dx !== 0 || dz !== 0)) {
      self.current.x += dx * MOVE_SPEED * dt;
      self.current.z += dz * MOVE_SPEED * dt;
      const r = Math.hypot(self.current.x, self.current.z);
      if (r > maxR) {
        self.current.x = (self.current.x / r) * maxR;
        self.current.z = (self.current.z / r) * maxR;
      }
      self.current.dir = Math.atan2(dx, dz);
    }

    // reconcile toward the server — snap hard on a big gap (knockback / teleport)
    const server = latest(sessionId);
    if (server) {
      const ex = server.x - self.current.x;
      const ez = server.z - self.current.z;
      const gap = Math.hypot(ex, ez);
      const k = gap > 1.5 ? 1 : 1 - Math.exp(-dt * 8);
      self.current.x += ex * k;
      self.current.z += ez * k;
      if (meStunned) self.current.dir = server.dir; // knockback spins us; follow it
    }

    // first-person camera: eye at the player, look forward + a touch down
    camYaw.current = lerpAngle(camYaw.current, self.current.dir, 1 - Math.exp(-dt * 12));
    const fx = Math.sin(camYaw.current);
    const fz = Math.cos(camYaw.current);
    const cx = self.current.x;
    const cz = self.current.z;
    state.camera.position.set(cx, EYE_HEIGHT, cz);
    state.camera.lookAt(cx + fx * 6, 0.6, cz + fz * 6);
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
        <PlayerAvatar
          key={id}
          id={id}
          isMe={id === sessionId}
          fpSelf={fpActive && id === sessionId}
          self={self}
        />
      ))}

      {spectator && <OrbitControls target={[0, 0.5, 0]} maxPolarAngle={Math.PI / 2.1} enableDamping />}
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
      input.current = { dx: 0, dz: 0 };
      sendInput(0, 0);
    };
  }, [input]);

  return <div ref={zone} className="fixed bottom-6 left-6 h-[140px] w-[140px] touch-none" />;
}

/** Big thumb-friendly attack button. Hold to swing repeatedly; server gates cooldown. */
function AttackButton({ sessionId }: { sessionId?: string }) {
  const timer = useRef<number>();

  const swing = () => {
    if (sessionId) markSwing(sessionId); // instant local feedback
    sendAttack();
  };
  const stop = () => {
    if (timer.current) {
      window.clearInterval(timer.current);
      timer.current = undefined;
    }
  };
  const start = (e: React.PointerEvent) => {
    e.preventDefault();
    swing();
    stop();
    timer.current = window.setInterval(swing, 130);
  };

  useEffect(() => stop, []);

  return (
    <button
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      className="fixed right-7 bottom-10 grid h-[104px] w-[104px] touch-none select-none place-items-center rounded-full bg-coral text-[42px] shadow-[0_6px_0_var(--color-coral-d),var(--shadow-soft)] transition-transform active:translate-y-1 active:scale-95"
      aria-label="โจมตี"
    >
      🔨
    </button>
  );
}

/** Champion / spectate card shown when the match ends. */
function ResultsOverlay() {
  const winnerId = useGame((s) => s.winnerId);
  const sessionId = useGame((s) => s.sessionId);
  const isHost = useGame((s) => s.isHost);
  const winnerName = useGame((s) => (s.winnerId ? (s.players[s.winnerId]?.name ?? "") : ""));
  const iWon = !!sessionId && winnerId === sessionId;

  return (
    <div className="fixed inset-0 z-20 grid place-items-center bg-ink/35 px-5 backdrop-blur-sm">
      <div className="panel text-center">
        <div className="mb-2 text-[54px]">🏆</div>
        <h2 className="mb-1 font-display text-2xl font-extrabold text-ink">
          {winnerName ? `${winnerName} ชนะ!` : "จบเกม"}
        </h2>
        <p className="muted mb-4">
          {isHost
            ? "ผู้เล่นคนสุดท้ายที่รอดคือผู้ชนะ"
            : iWon
              ? "คุณคือคนสุดท้ายที่รอด! 🎉"
              : "รอบนี้คุณตกรอบ — รอโฮสต์เริ่มรอบใหม่"}
        </p>
        {isHost ? (
          <button className="btn btn--jade" onClick={sendRestart}>
            เริ่มรอบใหม่
          </button>
        ) : null}
        <button className="link-btn mt-3" onClick={leaveRoom}>
          ออกจากห้อง
        </button>
      </div>
    </div>
  );
}

export function GameScreen() {
  const idsKey = useGame((s) => Object.keys(s.players).sort().join("|"));
  const sessionId = useGame((s) => s.sessionId);
  const isHost = useGame((s) => s.isHost);
  const phase = useGame((s) => s.phase);
  const conn = useGame((s) => s.conn);
  const aliveCount = useGame((s) => Object.values(s.players).filter((p) => p.alive).length);
  const meAlive = useGame((s) => (s.sessionId ? (s.players[s.sessionId]?.alive ?? true) : true));
  const meHp = useGame((s) => (s.sessionId ? (s.players[s.sessionId]?.hp ?? HP_MAX) : HP_MAX));
  const meHammer = useGame((s) => (s.sessionId ? (s.players[s.sessionId]?.hammer ?? "mid") : "mid"));

  const input = useRef<Vec>({ dx: 0, dz: 0 });
  const ids = idsKey ? idsKey.split("|") : [];

  const playing = phase === "playing";
  const canControl = !isHost && meAlive && playing;
  const ratio = Math.max(0, Math.min(1, meHp / HP_MAX));
  const hammerLabel = HAMMERS[meHammer as HammerKind]?.label ?? meHammer;

  return (
    <div className="fixed inset-0">
      <Canvas shadows camera={{ position: [0, 12, 16], fov: 50 }}>
        <World ids={ids} sessionId={sessionId} isHost={isHost} input={input} />
      </Canvas>

      {canControl && <Joystick input={input} />}
      {canControl && <AttackButton sessionId={sessionId} />}

      <div className="hud">
        <div>
          <b>⚔ กำลังประลอง</b> · {aliveCount} รอด
        </div>
        {!isHost && meAlive && playing && (
          <div className="mt-1.5 flex items-center gap-2">
            <span className="text-[11px] font-bold">🔨 {hammerLabel}</span>
            <div className="h-[9px] w-[120px] overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full"
                style={{ width: `${ratio * 100}%`, background: hpColor(ratio), transition: "width 120ms linear" }}
              />
            </div>
            <span className="text-[11px] font-bold">{Math.ceil(meHp)}</span>
          </div>
        )}
        {!isHost && !meAlive && playing && (
          <div className="muted mt-1 text-[11px]">☠️ คุณตกรอบแล้ว — หมุนดูสนามได้</div>
        )}
        {isHost && <div className="muted text-[11px]">มุมมองเจ้าภาพ · ลากเพื่อหมุนกล้อง</div>}
      </div>

      {conn === "reconnecting" && (
        <div className="fixed inset-x-0 top-16 z-20 flex justify-center">
          <div className="pill">กำลังเชื่อมต่อใหม่…</div>
        </div>
      )}

      <button className="btn btn--ghost fixed right-4 top-3 z-20 w-auto px-4 py-2 text-sm" onClick={leaveRoom}>
        ออก
      </button>

      {phase === "ended" && <ResultsOverlay />}
    </div>
  );
}

/** Green → amber → red as HP drops. */
function hpColor(ratio: number): string {
  if (ratio > 0.5) return "#34c86a";
  if (ratio > 0.22) return "#ffc93c";
  return "#ff6f61";
}

/** Shortest-path angle interpolation (radians). */
function lerpAngle(a: number, b: number, f: number): number {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * f;
}
