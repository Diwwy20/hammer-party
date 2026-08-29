import { type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import {
  GHOST,
  MOVE_SPEED,
  PLAYER_RADIUS,
  approach,
  pushOutOfObstacles,
  type Obstacle,
} from "@hammer/shared";
import { selectMeStunned, useGame } from "../store";
import { latest } from "../net/movement";
import { localPlayer } from "../runtime/localPlayer";
import { toWorld, type MoveVec } from "../runtime/input";
import { CAMERA, PREDICTION } from "../config/view";
import type { SelfTransform } from "./types";

/**
 * Client-side prediction + the player camera, in one frame loop.
 *
 * Prediction: we move our own avatar immediately on input so the game feels
 * instant, then ease toward the server's answer every frame (snapping only if we're
 * badly out of sync). The server still owns the truth — this just hides the round
 * trip. Everyone ELSE is interpolated instead (`net/movement.ts`).
 *
 * The camera is always a FIXED-ORIENTATION third-person follow cam. It never rotates
 * with your facing, which is what keeps the stick honest everywhere (up is always
 * away from the camera) and what lets you actually watch your own character fight.
 */

/** Which of the three player views is on screen. */
export const ViewMode = {
  /** waiting-room plaza: close in, so outfits read */
  Plaza: "plaza",
  /** live match: pulled back, to see threats coming */
  Match: "match",
  /** dead: floating above the fight you just left */
  Ghost: "ghost",
} as const;
export type ViewMode = (typeof ViewMode)[keyof typeof ViewMode];

const FRAMING: Record<ViewMode, { height: number; distance: number; lookHeight: number }> = {
  [ViewMode.Plaza]: CAMERA.plaza,
  [ViewMode.Match]: CAMERA.match,
  [ViewMode.Ghost]: CAMERA.ghostCam,
};

export function useSelfControl({
  sessionId,
  enabled,
  mode,
  maxRadius,
  obstacles,
  input,
  self,
}: {
  sessionId?: string;
  /** false for the Host and between matches — nothing to drive. */
  enabled: boolean;
  mode: ViewMode;
  /** how far from the centre the player may walk (m). */
  maxRadius: number;
  /** solid cover to predict against — empty in the plaza, and ghosts pass through. */
  obstacles: readonly Obstacle[];
  input: MutableRefObject<MoveVec>;
  self: MutableRefObject<SelfTransform>;
}): void {
  const stunned = useGame(selectMeStunned);

  useFrame((state, dt) => {
    if (!enabled || !sessionId) return;

    // seed the prediction from the first server snapshot we see
    if (!self.current.ready) {
      const spawn = latest(sessionId);
      if (!spawn) return;
      self.current = { x: spawn.x, z: spawn.z, dir: spawn.dir, ready: true };
    }

    const ghost = mode === ViewMode.Ghost;
    const speed = MOVE_SPEED * (ghost ? GHOST.speedFactor : 1);
    const { dx, dz } = toWorld(input.current.dx, input.current.dz);

    // a ghost is never stunned — nothing in the arena can touch them any more
    if ((ghost || !stunned) && (dx !== 0 || dz !== 0)) {
      self.current.x += dx * speed * dt;
      self.current.z += dz * speed * dt;
      clampToArena(self.current, maxRadius);
      if (obstacles.length > 0) {
        const free = pushOutOfObstacles(self.current.x, self.current.z, PLAYER_RADIUS, obstacles);
        self.current.x = free.x;
        self.current.z = free.z;
      }
      self.current.dir = Math.atan2(dx, dz);
    }

    reconcile(self.current, sessionId, dt, stunned && !ghost);
    localPlayer.distanceFromCentre = Math.hypot(self.current.x, self.current.z);

    // fixed-orientation follow cam: parked behind (-z) and above, always looking +z
    const framing = FRAMING[mode];
    const { x, z } = self.current;
    const ease = approach(CAMERA.followEaseRate, dt);
    state.camera.position.x += (x - state.camera.position.x) * ease;
    state.camera.position.y += (framing.height - state.camera.position.y) * ease;
    state.camera.position.z += (z - framing.distance - state.camera.position.z) * ease;
    state.camera.lookAt(x, framing.lookHeight, z);
  });
}

/** Keep the predicted position inside the wall, exactly like the server does. */
function clampToArena(self: SelfTransform, maxRadius: number): void {
  const radius = Math.hypot(self.x, self.z);
  if (radius <= maxRadius) return;
  self.x = (self.x / radius) * maxRadius;
  self.z = (self.z / radius) * maxRadius;
}

/**
 * Pull the prediction back onto the server position: ease for ordinary drift, snap
 * outright for a big gap (a knockback or a respawn — not something to slide into).
 */
function reconcile(self: SelfTransform, sessionId: string, dt: number, stunned: boolean): void {
  const server = latest(sessionId);
  if (!server) return;

  const errorX = server.x - self.x;
  const errorZ = server.z - self.z;
  const gap = Math.hypot(errorX, errorZ);
  const pull = gap > PREDICTION.snapDistanceM ? 1 : approach(PREDICTION.correctionRate, dt);
  self.x += errorX * pull;
  self.z += errorZ * pull;
  // while stunned you don't steer, so the server owns your facing too
  if (stunned) self.dir = server.dir;
}
