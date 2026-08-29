import { useEffect, useRef, type MutableRefObject } from "react";
import nipplejs from "nipplejs";
import { INPUT_SEND_HZ } from "@hammer/shared";
import { sendInput } from "../../net/session";
import { NO_MOVEMENT, toWorld, type MoveVec } from "../../runtime/input";
import { JOYSTICK } from "../../config/view";

/**
 * The DOM virtual joystick (nipplejs).
 *
 * It writes the raw screen-space vector into `input` (read every frame by the
 * prediction loop) and separately streams the WORLD-space vector to the server at
 * `INPUT_SEND_HZ`, but only when it actually changed — an idle thumb sends nothing.
 */
export function Joystick({ input }: { input: MutableRefObject<MoveVec> }) {
  const zone = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!zone.current) return;

    const manager = nipplejs.create({
      zone: zone.current,
      mode: "static",
      position: { left: "50%", top: "50%" },
      color: JOYSTICK.color,
      size: JOYSTICK.sizePx,
      restJoystick: true,
    });

    manager.on("move", (event) => {
      const vector = event?.data?.vector;
      if (vector) input.current = { dx: vector.x, dz: vector.y };
    });
    manager.on("end", () => {
      input.current = { ...NO_MOVEMENT };
    });

    let lastSent: MoveVec = { ...NO_MOVEMENT };
    const timer = window.setInterval(() => {
      const { dx, dz } = toWorld(input.current.dx, input.current.dz);
      if (dx === lastSent.dx && dz === lastSent.dz) return;
      sendInput(dx, dz);
      lastSent = { dx, dz };
    }, 1000 / INPUT_SEND_HZ);

    return () => {
      window.clearInterval(timer);
      manager.destroy();
      input.current = { ...NO_MOVEMENT };
      sendInput(NO_MOVEMENT.dx, NO_MOVEMENT.dz); // don't leave the avatar walking
    };
  }, [input]);

  return <div ref={zone} className="fixed bottom-6 left-6 h-[140px] w-[140px] touch-none" />;
}
