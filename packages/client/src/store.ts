import { create } from "zustand";

export type ConnStatus = "connecting" | "connected" | "error";

/** A flattened, render-friendly view of a Player mirrored out of room.state. */
export interface PlayerView {
  name: string;
  x: number;
  z: number;
  ready: boolean;
}

interface GameStore {
  status: ConnStatus;
  roomId?: string;
  sessionId?: string;
  players: Record<string, PlayerView>;

  set: (patch: Partial<GameStore>) => void;
  upsertPlayer: (id: string, p: PlayerView) => void;
  removePlayer: (id: string) => void;
}

export const useGame = create<GameStore>((set) => ({
  status: "connecting",
  players: {},

  set: (patch) => set(patch),
  upsertPlayer: (id, p) => set((s) => ({ players: { ...s.players, [id]: p } })),
  removePlayer: (id) =>
    set((s) => {
      const next = { ...s.players };
      delete next[id];
      return { players: next };
    }),
}));
