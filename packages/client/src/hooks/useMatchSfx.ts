import { useEffect, useRef } from "react";
import { GamePhase } from "@hammer/shared";
import { selectMeAlive, selectMeHammer, selectMeHp, useGame } from "../store";
import { sfx } from "../audio";

/**
 * Plays the local player's sounds by watching their own row for transitions.
 *
 * The Host has no player row, so its values never change — which is exactly right:
 * the big screen only ever hears the win fanfare.
 */

/** HP loss smaller than this is zone bleed, not a hit — don't play the crunch. */
const HIT_HP_EPSILON = 0.5;

export function useMatchSfx(): void {
  const alive = useGame(selectMeAlive);
  const hp = useGame(selectMeHp);
  const hammer = useGame(selectMeHammer);
  const phase = useGame((s) => s.phase);

  const prevHp = useRef(hp);
  const prevHammer = useRef(hammer);
  const prevAlive = useRef(alive);
  const prevPhase = useRef(phase);

  useEffect(() => {
    if (alive && hp < prevHp.current - HIT_HP_EPSILON) sfx.hit();
    prevHp.current = hp;
  }, [hp, alive]);

  useEffect(() => {
    if (hammer !== prevHammer.current) sfx.pickup();
    prevHammer.current = hammer;
  }, [hammer]);

  useEffect(() => {
    if (prevAlive.current && !alive) sfx.die();
    prevAlive.current = alive;
  }, [alive]);

  useEffect(() => {
    if (phase === GamePhase.Ended && prevPhase.current !== GamePhase.Ended) sfx.win();
    prevPhase.current = phase;
  }, [phase]);
}
