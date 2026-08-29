import { useEffect, type MutableRefObject } from "react";
import { sendAttack } from "../../net/session";
import { markSwing } from "../../runtime/combatFx";
import { sfx } from "../../audio";
import { HUD } from "../../config/view";
import { NO_MOVEMENT, type MoveVec } from "../../runtime/input";

/**
 * Desktop controls: WASD / arrows to move, Space to swing.
 *
 * They write the SAME raw screen-space vector the joystick does, so both schemes
 * share one send + prediction path — there is no separate desktop netcode.
 *
 * Keys are tracked by physical CODE (`e.code`), never `e.key`: on a Thai keyboard
 * layout the W key reports a Thai character, and `e.key` matching would silently
 * stop working.
 */

const KEY = {
  Up: ["KeyW", "ArrowUp"],
  Down: ["KeyS", "ArrowDown"],
  Left: ["KeyA", "ArrowLeft"],
  Right: ["KeyD", "ArrowRight"],
  Attack: "Space",
} as const;

const MOVE_CODES: readonly string[] = [...KEY.Up, ...KEY.Down, ...KEY.Left, ...KEY.Right];

export function KeyboardControls({
  input,
  sessionId,
}: {
  input: MutableRefObject<MoveVec>;
  sessionId?: string;
}) {
  useEffect(() => {
    const held = new Set<string>();
    let swingTimer: number | undefined;

    const anyHeld = (codes: readonly string[]) => codes.some((code) => held.has(code));

    const recompute = () => {
      let dx = 0;
      let dz = 0;
      if (anyHeld(KEY.Up)) dz += 1;
      if (anyHeld(KEY.Down)) dz -= 1;
      if (anyHeld(KEY.Right)) dx += 1;
      if (anyHeld(KEY.Left)) dx -= 1;

      const magnitude = Math.hypot(dx, dz);
      input.current = magnitude > 1 ? { dx: dx / magnitude, dz: dz / magnitude } : { dx, dz };
    };

    const swing = () => {
      if (sessionId) markSwing(sessionId);
      sendAttack();
    };
    const startSwinging = () => {
      if (swingTimer) return; // key-repeat, not a new press
      sfx.swing();
      swing();
      swingTimer = window.setInterval(swing, HUD.swingRepeatMs);
    };
    const stopSwinging = () => {
      if (!swingTimer) return;
      window.clearInterval(swingTimer);
      swingTimer = undefined;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === KEY.Attack) {
        e.preventDefault();
        startSwinging();
        return;
      }
      if (!MOVE_CODES.includes(e.code)) return;
      e.preventDefault();
      if (held.has(e.code)) return;
      held.add(e.code);
      recompute();
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === KEY.Attack) return stopSwinging();
      if (!MOVE_CODES.includes(e.code)) return;
      held.delete(e.code);
      recompute();
    };

    // alt-tabbing away must not leave a key stuck down
    const onBlur = () => {
      held.clear();
      recompute();
      stopSwinging();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      stopSwinging();
      input.current = { ...NO_MOVEMENT };
    };
  }, [input, sessionId]);

  return null;
}
