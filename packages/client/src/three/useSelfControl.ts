import { useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { MOVE_SPEED, approach, lerpAngle } from "@hammer/shared";
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
 */
export function useSelfControl({
  sessionId,
  enabled,
  firstPerson,
  maxRadius,
  input,
  self,
}: {
  sessionId?: string;
  /** false for the Host, the dead, and between matches — nothing to drive. */
  enabled: boolean;
  /** true in a match (eye cam), false in the plaza (fixed follow cam). */
  firstPerson: boolean;
  /** how far from the centre the player may walk (m). */
  maxRadius: number;
  input: MutableRefObject<MoveVec>;
  self: MutableRefObject<SelfTransform>;
}): void {
  const cameraYaw = useRef(0);
  const stunned = useGame(selectMeStunned);

  useFrame((state, dt) => {
    if (!enabled || !sessionId) return;

    // seed the prediction from the first server snapshot we see
    if (!self.current.ready) {
      const spawn = latest(sessionId);
      if (!spawn) return;
      self.current = { x: spawn.x, z: spawn.z, dir: spawn.dir, ready: true };
      cameraYaw.current = spawn.dir;
    }

    const { dx, dz } = toWorld(input.current.dx, input.current.dz, useGame.getState().phase);
    if (!stunned && (dx !== 0 || dz !== 0)) {
      self.current.x += dx * MOVE_SPEED * dt;
      self.current.z += dz * MOVE_SPEED * dt;
      clampToArena(self.current, maxRadius);
      self.current.dir = Math.atan2(dx, dz);
    }

    reconcile(self.current, sessionId, dt, stunned);
    localPlayer.distanceFromCentre = Math.hypot(self.current.x, self.current.z);

    const { x, z } = self.current;
    if (firstPerson) {
      // match: the eye cam swings round to follow your facing
      cameraYaw.current = lerpAngle(
        cameraYaw.current,
        self.current.dir,
        approach(CAMERA.turnRate, dt),
      );
      const forwardX = Math.sin(cameraYaw.current);
      const forwardZ = Math.cos(cameraYaw.current);
      state.camera.position.set(x, CAMERA.eyeHeight, z);
      state.camera.lookAt(
        x + forwardX * CAMERA.lookAheadDistance,
        CAMERA.lookAheadHeight,
        z + forwardZ * CAMERA.lookAheadDistance,
      );
    } else {
      // plaza: a FIXED-orientation follow cam, always looking +z. It never chases
      // your facing, so the stick stays intuitive (up = away from camera, down =
      // toward it). `toWorld()` maps the stick into this view.
      state.camera.position.set(x, CAMERA.plaza.height, z - CAMERA.plaza.distance);
      state.camera.lookAt(x, CAMERA.plaza.lookHeight, z);
    }
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
