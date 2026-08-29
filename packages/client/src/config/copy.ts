import { AwardKind, EventKind, MAX_PLAYERS, PrankKind } from "@hammer/shared";
import { MS_PER_SECOND } from "./view";

/**
 * Thai copy that more than one component needs, keyed by the shared enums.
 *
 * The server publishes FACTS (which event fired, who won which award); the wording
 * lives here, so the simulation carries no UI strings and a re-word never touches
 * game code. One-off copy stays inline in the component that shows it.
 */

/** Random events: the Host's button, and the banner everyone sees when it fires. */
export const EVENT_COPY: Record<EventKind, { button: string; banner: string }> = {
  [EventKind.Golden]: {
    button: "⚡ ค้อนทองคำ",
    banner: "⚡ ค้อนทองคำปรากฏกลางสนาม!",
  },
  [EventKind.Heal]: {
    button: "💚 ออร์บฮีล",
    banner: "💚 ออร์บพลังชีวิตปรากฏ!",
  },
  [EventKind.Meteor]: {
    button: "☄️ ฝนอุกกาบาต",
    banner: "☄️ อุกกาบาตถล่ม! วงแดงบนพื้น = รีบหลบ",
  },
  [EventKind.Rain]: {
    button: "🌧️ ฝนตก",
    banner: "🌧️ ฝนตกแล้ว! พื้นลื่น โดนตีทีไถลไกลกว่าเดิม",
  },
};

/** Buttons a dead player gets, and the emoji that pops over their victim. */
export const PRANK_COPY: Record<PrankKind, { button: string; emoji: string }> = {
  [PrankKind.Banana]: { button: "🍌 กล้วย", emoji: "🍌" },
  [PrankKind.Bomb]: { button: "💣 ระเบิด", emoji: "💣" },
};

/**
 * Award cards. `detail` turns the server's bare number into a phrase; awards with
 * nothing to count (First Blood) simply don't have one.
 */
export const AWARD_COPY: Record<
  AwardKind,
  { icon: string; label: string; detail?: (value: number) => string }
> = {
  [AwardKind.MostKills]: {
    icon: "⚔️",
    label: "สังหารมากสุด",
    detail: (kills) => `${kills} คิล`,
  },
  [AwardKind.FirstBlood]: {
    icon: "🩸",
    label: "เลือดหยดแรก",
  },
  [AwardKind.LongestSurvivor]: {
    icon: "🛡️",
    label: "อยู่รอดนานสุด",
    detail: (ms) => `${Math.round(ms / MS_PER_SECOND)} วิ`,
  },
  [AwardKind.Pacifist]: {
    icon: "🕊️",
    label: "สายรักสงบ",
    detail: (dmg) => `ดาเมจ ${dmg}`,
  },
  [AwardKind.MostWallSlams]: {
    icon: "🧱",
    label: "โดนอัดกำแพงมากสุด",
    detail: (times) => `${times} ครั้ง`,
  },
};

/** Splash-screen tips, shown one at random while the room opens. */
export const SPLASH_TIPS = [
  "ค้อนแรงเหวี่ยงไกล แต่ตีช้า — จังหวะคือทุกอย่าง",
  "โดนผลักไปชนกำแพง = เจ็บกว่าเดิม ระวังขอบสนาม",
  "เก็บค้อนในแมพเพื่อเปลี่ยนสไตล์การเล่น",
  "ตายแล้วไม่จบ — เป็นวิญญาณลอยไปป่วนคนที่ยังรอดได้",
  "เห็นวงแดงบนพื้นเมื่อไหร่ วิ่งออกทันที อุกกาบาตกำลังลง",
  "ฝนตกพื้นจะลื่น โดนตีทีเดียวไถลออกนอกวงได้เลย",
  "หลบหลังเสาไว้ ตอนโดนไล่ตีมันช่วยได้จริง",
] as const;

/** What a dead player sees and does — they stay in the world as a ghost. */
export const GHOST_COPY = {
  title: "👻 คุณเป็นวิญญาณแล้ว",
  hint: "ลอยไปไหนก็ได้ คนเป็นมองไม่เห็น — ลอยไปใกล้ๆ ใครแล้วปาของใส่ได้เลย",
  /** shown on a prank button while its cooldown is still running */
  cooling: "รอ",
} as const;

/** The Host's spectator controls — following one player around the arena. */
export const SPECTATE_COPY = {
  label: "ตามดู",
  /** the free orbit camera, i.e. following nobody */
  free: "🎥 มุมกว้าง",
  prev: "‹",
  next: "›",
  hint: "เลือกผู้เล่นเพื่อตามดูแบบประชิด",
} as const;

/**
 * Suggested display names for the 🎲 button on the join screen — a nudge for
 * whoever is standing at the party not wanting to think of one.
 */
export const NAME_SUGGESTIONS = [
  "ค้อนสายฟ้า",
  "หมีจอมทุบ",
  "เจ้าชายค้อนทอง",
  "ตัวป่วนประจำออฟฟิศ",
  "นักตบมือหนัก",
  "ยักษ์ใจดี",
  "กระต่ายถือค้อน",
  "สายบุญไม่ตีใคร",
  "ราชาสนามประลอง",
  "ลูกชิ้นเด้งได้",
  "ป้าข้างบ้าน",
  "หัวหน้าทีมทุบ",
] as const;

/** Connection failures, mapped from what the server said to what a player reads. */
export const CONNECT_ERROR = {
  roomFull: `ห้องเต็มแล้ว (สูงสุด ${MAX_PLAYERS} คน)`,
  noSuchRoom: "ไม่พบห้องรหัสนี้ — ลองตรวจโค้ดอีกครั้ง",
  generic: "เชื่อมต่อไม่สำเร็จ ลองใหม่อีกครั้ง",
  dropped: "หลุดจากห้อง",
  reconnectFailed: "กลับเข้าห้องไม่สำเร็จ",
  unknown: "เกิดข้อผิดพลาด",
} as const;
