import { useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { Grid, OrbitControls } from "@react-three/drei";
import type { Room } from "colyseus.js";
import { ARENA_RADIUS, ROOM_NAME } from "@hammer/shared";
import { colyseus } from "./net/client";
import { useGame, type PlayerView } from "./store";

// A throwaway guest identity for Phase 00. Real name entry lands in Phase 01 (Join screen).
const guestName = "guest-" + Math.random().toString(36).slice(2, 6);

/** Connect once, mirror room.state.players into the zustand store. */
function useConnect() {
  useEffect(() => {
    let room: Room | undefined;
    let cancelled = false;

    (async () => {
      try {
        const r = await colyseus.joinOrCreate(ROOM_NAME, { name: guestName });
        room = r;
        if (cancelled) {
          void r.leave();
          return;
        }

        useGame.getState().set({
          status: "connected",
          roomId: r.roomId,
          sessionId: r.sessionId,
        });

        // Rebuild the render-friendly player view on every state patch.
        // Version-proof (no per-item callback API) and trivially cheap for 25
        // players @ 20Hz. Phase 01 can switch to granular callbacks if needed.
        const applyState = (state: any) => {
          const players: Record<string, PlayerView> = {};
          state.players?.forEach((p: any, key: string) => {
            players[key] = { name: p.name, x: p.x, z: p.z, ready: p.ready };
          });
          useGame.getState().set({ players });
        };
        applyState(r.state);
        r.onStateChange(() => applyState(r.state));

        r.onLeave(() => useGame.getState().set({ status: "error" }));
      } catch (err) {
        console.error("[net] join failed:", err);
        useGame.getState().set({ status: "error" });
      }
    })();

    return () => {
      cancelled = true;
      void room?.leave();
    };
  }, []);
}

/** One box per connected player. Phase 00 has no movement, so lay them out on a ring. */
function Players() {
  const players = useGame((s) => s.players);
  const mySession = useGame((s) => s.sessionId);
  const ids = Object.keys(players);

  return (
    <>
      {ids.map((id, i) => {
        const p = players[id];
        const onRing = ids.length > 1 ? 3 : 0;
        const angle = (i / Math.max(1, ids.length)) * Math.PI * 2;
        const x = p.x || Math.cos(angle) * onRing;
        const z = p.z || Math.sin(angle) * onRing;
        const isMe = id === mySession;
        const color = isMe ? "#f2a03a" : p.ready ? "#3fae4f" : "#d9512f";

        return (
          <mesh key={id} position={[x, 0.6, z]} castShadow>
            <boxGeometry args={[0.8, 1.2, 0.8]} />
            <meshStandardMaterial color={color} />
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

      {/* the one floor — Phase 00 milestone: "empty 3D canvas + a floor" */}
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

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: "flex", gap: 14, justifyContent: "space-between" }}>
      <span style={{ opacity: 0.6 }}>{k}</span>
      <span style={{ fontWeight: 600 }}>{v}</span>
    </div>
  );
}

function Hud() {
  const status = useGame((s) => s.status);
  const roomId = useGame((s) => s.roomId);
  const sessionId = useGame((s) => s.sessionId);
  const count = useGame((s) => Object.keys(s.players).length);

  const statusText =
    status === "connected" ? "🟢 connected" : status === "connecting" ? "🟡 connecting…" : "🔴 disconnected";

  return (
    <div
      style={{
        position: "fixed",
        top: 12,
        left: 12,
        padding: "12px 14px",
        borderRadius: 12,
        background: "rgba(20,26,34,0.82)",
        color: "#eef2f6",
        font: "13px/1.55 system-ui, sans-serif",
        backdropFilter: "blur(6px)",
        border: "1px solid rgba(255,255,255,0.08)",
        minWidth: 190,
      }}
    >
      <div style={{ fontWeight: 800, letterSpacing: "0.04em", color: "#f2a03a" }}>🔨 HAMMER PARTY</div>
      <div style={{ opacity: 0.55, fontSize: 11, marginBottom: 8 }}>Phase 00 · handshake</div>
      <Row k="สถานะ" v={statusText} />
      <Row k="ห้อง" v={roomId ?? "—"} />
      <Row k="ฉัน" v={sessionId ? `${guestName} · ${sessionId.slice(0, 6)}` : "—"} />
      <Row k="ในห้อง" v={`${count} คน`} />
    </div>
  );
}

export function App() {
  useConnect();
  return (
    <>
      <Canvas shadows camera={{ position: [0, 11, 15], fov: 50 }}>
        <Arena />
      </Canvas>
      <Hud />
    </>
  );
}
