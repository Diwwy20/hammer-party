import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Grid, Html, OrbitControls } from "@react-three/drei";
import type { Group, Mesh } from "three";
import nipplejs from "nipplejs";
import { HAMMERS, HP_MAX, INPUT_SEND_HZ, MOVE_SPEED, PLAYER_RADIUS, type HammerKind } from "@hammer/shared";
import { useGame, type PickupView } from "../store";
import { leaveRoom, sendAttack, sendEvent, sendInput, sendPrank, sendRestart } from "../net/session";
import { latest, sampleOther } from "../net/movement";
import { markSwing, prankAt, selfStat, swingAt } from "../net/combat";
import { AvatarBody } from "../three/cosmetics";
import { sfx } from "../audio";

type Vec = { dx: number; dz: number };
type Self = { x: number; z: number; dir: number; ready: boolean };

/** First-person eye height (m). At the avatar's head level. */
const EYE_HEIGHT = 2.05;
/** Swing animation length (ms). Purely visual; the server owns the real cooldown. */
const SWING_MS = 300;

/** Look of each pickup kind (weapons + event items). */
const PICKUP_STYLE: Record<string, { color: string; glow: number }> = {
  fast: { color: "#38a3ff", glow: 0.25 },
  heavy: { color: "#5b6672", glow: 0.2 },
  golden: { color: "#ffcf3a", glow: 0.85 },
  heal: { color: "#34c86a", glow: 0.6 },
};

/** One player. Own avatar is client-predicted; others are interpolated ~100ms back. */
function PlayerAvatar({
  id,
  isMe,
  fpSelf,
  self,
}: {
  id: string;
  isMe: boolean;
  fpSelf: boolean;
  self: MutableRefObject<Self>;
}) {
  const g = useRef<Group>(null);
  const tip = useRef<Group>(null);
  const hammer = useRef<Group>(null);
  const dead = useRef(0);
  const prankRef = useRef<HTMLDivElement>(null);

  const name = useGame((s) => s.players[id]?.name ?? "");
  const hp = useGame((s) => s.players[id]?.hp ?? HP_MAX);
  const alive = useGame((s) => s.players[id]?.alive ?? true);
  const connected = useGame((s) => s.players[id]?.connected ?? true);
  const hammerKind = useGame((s) => s.players[id]?.hammer ?? "mid");
  const colorIndex = useGame((s) => s.players[id]?.colorIndex ?? 1);
  const hatIndex = useGame((s) => s.players[id]?.hatIndex ?? 0);
  const faceIndex = useGame((s) => s.players[id]?.faceIndex ?? 0);
  const backIndex = useGame((s) => s.players[id]?.backIndex ?? 0);
  const cos = { colorIndex, hatIndex, faceIndex, backIndex };

  useFrame((_, dt) => {
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

    dead.current += ((alive ? 0 : 1) - dead.current) * (1 - Math.exp(-dt * 6));
    if (tip.current) {
      tip.current.rotation.z = dead.current * 1.45;
      tip.current.position.y = -dead.current * 0.5;
    }

    if (hammer.current) {
      const started = swingAt[id] ?? -1;
      const t = started > 0 ? (performance.now() - started) / SWING_MS : 2;
      const strike = t >= 0 && t <= 1 ? Math.sin(t * Math.PI) : 0;
      hammer.current.rotation.x = -0.5 - strike * 1.95;
    }

    if (prankRef.current) {
      const pk = prankAt[id];
      const age = pk ? performance.now() - pk.t : 9999;
      if (age < 1200) {
        prankRef.current.textContent = pk!.kind === "banana" ? "🍌" : "💣";
        prankRef.current.style.opacity = String(1 - age / 1200);
      } else if (prankRef.current.style.opacity !== "0") {
        prankRef.current.style.opacity = "0";
      }
    }
  });

  const ratio = Math.max(0, Math.min(1, hp / HP_MAX));
  const golden = hammerKind === "golden";

  return (
    <group ref={g}>
      <group ref={tip}>
        {/* full cosmetic avatar (hidden for your own first-person view) */}
        {!fpSelf && <AvatarBody cosmetic={cos} isMe={isMe} />}

        {/* held hammer (also the first-person view-model); glows gold with the power weapon */}
        <group ref={hammer} position={[0.48, 1.12, 0.32]}>
          <mesh position={[0, 0.34, 0]} castShadow>
            <cylinderGeometry args={[0.05, 0.05, 0.8, 8]} />
            <meshStandardMaterial color="#5a3a1e" />
          </mesh>
          <mesh position={[0, 0.78, 0]} castShadow>
            <boxGeometry args={golden ? [0.42, 0.36, 0.36] : [0.3, 0.26, 0.26]} />
            <meshStandardMaterial
              color={golden ? "#ffcf3a" : "#c9d2da"}
              emissive={golden ? "#ffcf3a" : "#000000"}
              emissiveIntensity={golden ? 0.7 : 0}
              metalness={0.5}
              roughness={0.35}
            />
          </mesh>
        </group>
      </group>

      {!fpSelf && (
        <Html position={[0, 2.7, 0]} center distanceFactor={15} zIndexRange={[10, 0]} className="pointer-events-none">
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
                <div style={{ width: `${ratio * 100}%`, height: "100%", background: hpColor(ratio), transition: "width 120ms linear" }} />
              </div>
            )}
          </div>
        </Html>
      )}

      {!fpSelf && (
        <Html position={[0, 3.35, 0]} center distanceFactor={16} zIndexRange={[11, 0]} className="pointer-events-none">
          <div ref={prankRef} className="text-3xl" style={{ opacity: 0 }} />
        </Html>
      )}
    </group>
  );
}

/** Arena floor + shrinking safe zone. The danger floor is revealed as the safe
 *  disc (scaled to zoneRadius each frame) shrinks over it. */
function Arena() {
  const arenaR = useGame((s) => s.arenaRadius);
  const safe = useRef<Mesh>(null);
  const zoneRing = useRef<Mesh>(null);

  useFrame(() => {
    const zr = useGame.getState().zoneRadius || arenaR;
    if (safe.current) safe.current.scale.set(zr, zr, 1);
    if (zoneRing.current) zoneRing.current.scale.set(zr, zr, 1);
  });

  return (
    <>
      {/* danger floor (lava) — full arena, sits under the safe disc */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[arenaR, 64]} />
        <meshStandardMaterial color="#ff7a5c" emissive="#e14b3d" emissiveIntensity={0.28} />
      </mesh>
      {/* safe floor — unit circle scaled to zoneRadius */}
      <mesh ref={safe} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]} receiveShadow>
        <circleGeometry args={[1, 64]} />
        <meshStandardMaterial color="#eaf6ff" />
      </mesh>
      {/* glowing safe-zone edge */}
      <mesh ref={zoneRing} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[0.965, 1, 64]} />
        <meshBasicMaterial color="#38a3ff" />
      </mesh>
      {/* physical arena boundary */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[arenaR - 0.3, arenaR, 64]} />
        <meshBasicMaterial color="#2c81d6" />
      </mesh>
    </>
  );
}

function PickupMesh({ p }: { p: PickupView }) {
  const spin = useRef<Group>(null);
  useFrame((s) => {
    if (!spin.current) return;
    spin.current.rotation.y = s.clock.elapsedTime * 2;
    spin.current.position.y = 1 + Math.sin(s.clock.elapsedTime * 3) * 0.16;
  });
  const cfg = PICKUP_STYLE[p.kind] ?? PICKUP_STYLE.fast;

  return (
    <group position={[p.x, 0, p.z]}>
      <group ref={spin} position={[0, 1, 0]}>
        {p.kind === "heal" ? (
          <mesh castShadow>
            <sphereGeometry args={[0.34, 16, 16]} />
            <meshStandardMaterial color={cfg.color} emissive={cfg.color} emissiveIntensity={cfg.glow} />
          </mesh>
        ) : (
          <group rotation={[0, 0, -0.5]}>
            <mesh position={[0, 0.18, 0]}>
              <cylinderGeometry args={[0.05, 0.05, 0.6, 8]} />
              <meshStandardMaterial color="#5a3a1e" />
            </mesh>
            <mesh position={[0, 0.5, 0]} castShadow>
              <boxGeometry args={[0.34, 0.28, 0.28]} />
              <meshStandardMaterial color={cfg.color} emissive={cfg.color} emissiveIntensity={cfg.glow} metalness={0.5} roughness={0.3} />
            </mesh>
          </group>
        )}
      </group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <ringGeometry args={[0.5, 0.62, 24]} />
        <meshBasicMaterial color={cfg.color} />
      </mesh>
    </group>
  );
}

function Pickups() {
  // gate re-renders on the id/active signature (positions never move)
  const sig = useGame((s) =>
    Object.keys(s.pickups)
      .map((k) => k + (s.pickups[k].active ? "1" : "0"))
      .join("|"),
  );
  void sig;
  const pickups = useGame.getState().pickups;
  return (
    <>
      {Object.entries(pickups)
        .filter(([, p]) => p.active)
        .map(([id, p]) => (
          <PickupMesh key={id} p={p} />
        ))}
    </>
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
  const { camera } = useThree();

  const meAlive = useGame((s) => (s.sessionId ? (s.players[s.sessionId]?.alive ?? true) : true));
  const meStunned = useGame((s) => (s.sessionId ? (s.players[s.sessionId]?.stunned ?? false) : false));
  const phase = useGame((s) => s.phase);
  const arenaR = useGame((s) => s.arenaRadius);
  const maxR = arenaR - PLAYER_RADIUS;

  const fpActive = !isHost && !!sessionId && meAlive;
  const spectator = isHost || (!!sessionId && !meAlive);

  useEffect(() => {
    if (spectator) camera.position.set(0, 16, 22);
  }, [spectator, camera]);

  useFrame((state, dt) => {
    if (!fpActive || !sessionId) return;

    if (!self.current.ready) {
      const s = latest(sessionId);
      if (s) {
        self.current = { x: s.x, z: s.z, dir: s.dir, ready: true };
        camYaw.current = s.dir;
      }
    }

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

    const server = latest(sessionId);
    if (server) {
      const ex = server.x - self.current.x;
      const ez = server.z - self.current.z;
      const gap = Math.hypot(ex, ez);
      const k = gap > 1.5 ? 1 : 1 - Math.exp(-dt * 8);
      self.current.x += ex * k;
      self.current.z += ez * k;
      if (meStunned) self.current.dir = server.dir;
    }

    selfStat.r = Math.hypot(self.current.x, self.current.z);

    camYaw.current = lerpAngle(camYaw.current, self.current.dir, 1 - Math.exp(-dt * 12));
    const fx = Math.sin(camYaw.current);
    const fz = Math.cos(camYaw.current);
    const cx = self.current.x;
    const cz = self.current.z;
    state.camera.position.set(cx, EYE_HEIGHT, cz);
    state.camera.lookAt(cx + fx * 6, 1.0, cz + fz * 6);
  });

  return (
    <>
      <color attach="background" args={["#bfe4ff"]} />
      <ambientLight intensity={0.8} />
      <directionalLight position={[10, 18, 8]} intensity={1.2} castShadow shadow-mapSize={[2048, 2048]} />

      <Arena />
      <Grid
        args={[arenaR * 2, arenaR * 2]}
        cellSize={2}
        cellColor="#cfe0ef"
        sectionSize={10}
        sectionColor="#a9c9e6"
        fadeDistance={60}
        position={[0, 0.012, 0]}
      />

      <Pickups />

      {ids.map((id) => (
        <PlayerAvatar key={id} id={id} isMe={id === sessionId} fpSelf={fpActive && id === sessionId} self={self} />
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
    if (sessionId) markSwing(sessionId);
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
    sfx.swing();
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

interface Award {
  icon: string;
  label: string;
  name: string;
  detail: string;
}

/** Champion + funny awards shown when the match ends. */
function ResultsOverlay() {
  const winnerId = useGame((s) => s.winnerId);
  const sessionId = useGame((s) => s.sessionId);
  const isHost = useGame((s) => s.isHost);
  const winnerName = useGame((s) => (s.winnerId ? (s.players[s.winnerId]?.name ?? "") : ""));
  const awardsJson = useGame((s) => s.awardsJson);
  const iWon = !!sessionId && winnerId === sessionId;

  let awards: Award[] = [];
  try {
    if (awardsJson) awards = JSON.parse(awardsJson);
  } catch {
    awards = [];
  }

  return (
    <div className="fixed inset-0 z-20 grid place-items-center overflow-y-auto bg-ink/40 px-5 py-8 backdrop-blur-sm">
      <div className="panel max-w-[520px] text-center">
        <div className="mb-1 text-[54px]">🏆</div>
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

        {awards.length > 0 && (
          <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {awards.map((a, i) => (
              <div key={i} className="flex items-center gap-3 rounded-field border-2 border-line bg-surface-2 px-3 py-2 text-left">
                <span className="text-2xl">{a.icon}</span>
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-ink-soft">{a.label}</div>
                  <div className="truncate font-display font-bold text-ink">{a.name}</div>
                  {a.detail && <div className="text-[11px] text-ink-faint">{a.detail}</div>}
                </div>
              </div>
            ))}
          </div>
        )}

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
  const banner = useGame((s) => s.eventBanner);
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

  // SFX on local-player events (host's constant values never change, so it only
  // hears the win fanfare — which is what the big screen wants)
  const prevHp = useRef(meHp);
  const prevHammer = useRef(meHammer);
  const prevAlive = useRef(meAlive);
  const prevPhase = useRef(phase);
  useEffect(() => {
    if (meAlive && meHp < prevHp.current - 0.5) sfx.hit();
    prevHp.current = meHp;
  }, [meHp, meAlive]);
  useEffect(() => {
    if (meHammer !== prevHammer.current) {
      sfx.pickup();
      prevHammer.current = meHammer;
    }
  }, [meHammer]);
  useEffect(() => {
    if (prevAlive.current && !meAlive) sfx.die();
    prevAlive.current = meAlive;
  }, [meAlive]);
  useEffect(() => {
    if (phase === "ended" && prevPhase.current !== "ended") sfx.win();
    prevPhase.current = phase;
  }, [phase]);

  // out-of-zone warning — polls the game loop's self radius (no per-frame re-render)
  const [outside, setOutside] = useState(false);
  useEffect(() => {
    const t = window.setInterval(() => {
      const st = useGame.getState();
      const sid = st.sessionId;
      const alive = sid ? (st.players[sid]?.alive ?? true) : true;
      setOutside(!st.isHost && alive && st.phase === "playing" && selfStat.r > st.zoneRadius + 0.15);
    }, 150);
    return () => window.clearInterval(t);
  }, []);

  return (
    <div className="fixed inset-0">
      <Canvas shadows camera={{ position: [0, 12, 16], fov: 50 }}>
        <World ids={ids} sessionId={sessionId} isHost={isHost} input={input} />
      </Canvas>

      {/* out-of-zone red vignette */}
      {outside && (
        <>
          <div className="pointer-events-none fixed inset-0 z-10" style={{ boxShadow: "inset 0 0 120px 40px rgba(225,75,61,0.55)" }} />
          <div className="fixed inset-x-0 top-24 z-10 flex justify-center">
            <div className="rounded-full bg-coral px-4 py-1.5 text-sm font-bold text-white shadow">
              ⚠ ออกนอกเขตปลอดภัย — รีบกลับเข้าวง!
            </div>
          </div>
        </>
      )}

      {canControl && <Joystick input={input} />}
      {canControl && <AttackButton sessionId={sessionId} />}

      {/* Host: trigger random events */}
      {isHost && playing && (
        <div className="fixed bottom-6 left-1/2 z-20 flex -translate-x-1/2 gap-2">
          <button className="pill" onClick={() => sendEvent("golden")}>
            ⚡ ค้อนทองคำ
          </button>
          <button className="pill" onClick={() => sendEvent("heal")}>
            💚 ออร์บฮีล
          </button>
        </div>
      )}

      {/* Dead player: prank the survivors (harass, never kill) */}
      {!isHost && !meAlive && playing && (
        <div className="fixed bottom-6 left-1/2 z-20 flex -translate-x-1/2 gap-2">
          <button className="pill" onClick={() => sendPrank("banana")}>
            🍌 กล้วย
          </button>
          <button className="pill" onClick={() => sendPrank("bomb")}>
            💣 ระเบิด
          </button>
        </div>
      )}

      <div className="hud">
        <div>
          <b>⚔ กำลังประลอง</b> · {aliveCount} รอด
        </div>
        {!isHost && meAlive && playing && (
          <div className="mt-1.5 flex items-center gap-2">
            <span className="text-[11px] font-bold">🔨 {hammerLabel}</span>
            <div className="h-[9px] w-[120px] overflow-hidden rounded-full bg-line">
              <div className="h-full rounded-full" style={{ width: `${ratio * 100}%`, background: hpColor(ratio), transition: "width 120ms linear" }} />
            </div>
            <span className="text-[11px] font-bold">{Math.ceil(meHp)}</span>
          </div>
        )}
        {!isHost && !meAlive && playing && (
          <div className="muted mt-1 text-[11px]">☠️ ตกรอบแล้ว — หมุนดูสนาม + ป่วนคนที่ยังรอดได้!</div>
        )}
        {isHost && <div className="muted text-[11px]">มุมมองเจ้าภาพ · ลากเพื่อหมุนกล้อง</div>}
      </div>

      {/* event banner */}
      {banner && (
        <div className="fixed inset-x-0 top-3 z-20 flex justify-center">
          <div className="rounded-full bg-yellow px-5 py-2 font-display text-base font-extrabold text-ink shadow-soft">
            {banner}
          </div>
        </div>
      )}

      {conn === "reconnecting" && (
        <div className="fixed inset-x-0 top-16 z-30 flex justify-center">
          <div className="pill">กำลังเชื่อมต่อใหม่…</div>
        </div>
      )}

      <button className="btn btn--ghost fixed right-4 top-3 z-30 w-auto px-4 py-2 text-sm" onClick={leaveRoom}>
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
