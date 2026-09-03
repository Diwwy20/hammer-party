import { GamePhase, HAMMERS, HP_MAX, type HammerKind } from "@hammer/shared";
import { selectMeAlive, selectMeHammer, selectMeHp, useGame } from "../../store";
import { hpColor, hpRatio } from "../../config/theme";
import { HammerIcon } from "../dressing/ItemIcon";

/**
 * Your own vitals while you're in the fight: a chunky HP bar and the hammer you're
 * carrying, sat in the band above the thumbs where the lobby's dock lives.
 *
 * It is built out of the SAME three layers as the nameplates floating over everyone
 * else (`three/PlayerAvatar.tsx`): a dark track that is your maximum, the bright
 * fill of what is left, and the number on the end. One bar design, read the same way
 * whether it is over your head or under your thumbs.
 *
 * The hammer is drawn with the same painted icon the wardrobe's weapon grid uses, so
 * "the thing I am holding" and "the thing I saw in the dressing room" are visibly
 * one object. Everything about the ROOM (how many are left, who the Host is
 * watching) belongs to `HudTop`; this is only ever about you, and it disappears the
 * moment you're out.
 */
export function MatchHud() {
  const isHost = useGame((s) => s.isHost);
  const phase = useGame((s) => s.phase);
  const meAlive = useGame(selectMeAlive);
  const meHp = useGame(selectMeHp);
  const meHammer = useGame(selectMeHammer);

  const isFighting = !isHost && meAlive && phase === GamePhase.Playing;
  if (!isFighting) return null;

  const ratio = hpRatio(meHp, HP_MAX);
  const hammerLabel = HAMMERS[meHammer as HammerKind]?.label ?? meHammer;

  return (
    <div className="vitals">
      <div className="hp-track">
        <div className="hp-fill" style={{ width: `${ratio * 100}%`, background: hpColor(ratio) }} />
        <span className="hp-num">{Math.ceil(meHp)}</span>
      </div>
      <span className="glass glass--weapon">
        <HammerIcon kind={meHammer} label={hammerLabel} />
        {hammerLabel}
      </span>
    </div>
  );
}
