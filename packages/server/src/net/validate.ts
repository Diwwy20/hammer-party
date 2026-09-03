import { z } from "zod";
import {
  EVENT_ORDER,
  FALLBACK_PLAYER_NAME,
  MAX_NAME_LENGTH,
  PrankKind,
  STAGE_ORDER,
  type EventKind,
  type StageId,
} from "@hammer/shared";

/**
 * The server edge: nothing from a socket reaches the simulation without passing
 * through here first.
 *
 * The server is authoritative anyway, so this is belt-and-braces — it rejects
 * malformed or hostile message SHAPES cheaply, and sanitises the one piece of free
 * player text (the display name), which goes up on the big screen.
 */

export const inputSchema = z.object({
  seq: z.number().finite().optional(),
  dx: z.number().finite(),
  dz: z.number().finite(),
});

export const readySchema = z.object({ ready: z.boolean() });

export const cosmeticSchema = z.object({
  colorIndex: z.number().int().optional(),
  hairIndex: z.number().int().optional(),
  hatIndex: z.number().int().optional(),
  faceIndex: z.number().int().optional(),
  backIndex: z.number().int().optional(),
});

/** Only an event this build actually ships can be triggered. (`z.enum` needs a tuple.) */
const EVENT_KINDS = EVENT_ORDER as unknown as [EventKind, ...EventKind[]];
export const eventSchema = z.object({ kind: z.enum(EVENT_KINDS) });

export const prankSchema = z.object({
  kind: z.enum([PrankKind.Banana, PrankKind.Bomb]),
});

/** Only a stage the build actually ships can be selected. (`z.enum` needs a tuple.) */
const STAGE_IDS = STAGE_ORDER as unknown as [StageId, ...StageId[]];
export const stageSchema = z.object({ stageId: z.enum(STAGE_IDS) });

/** Tiny profanity list (English + a little Thai). Owner can extend for the event. */
const BAD_WORDS = [
  "fuck",
  "shit",
  "bitch",
  "cunt",
  "asshole",
  "nigger",
  "faggot",
  "เหี้ย",
  "สัส",
  "ควย",
  "หี",
  "เย็ด",
];

/** Control characters — invisible on screen, so they're stripped, not masked. */
const CONTROL_CHARS = /\p{Cc}/gu;
const WHITESPACE_RUN = /\s+/g;
const REGEXP_SPECIALS = /[.*+?^${}()|[\]\\]/g;
const MASK_CHAR = "*";

function escapeRegExp(text: string): string {
  return text.replace(REGEXP_SPECIALS, "\\$&");
}

/**
 * Sanitise a display name: strip control chars, collapse whitespace, clamp length,
 * mask profanity. Always returns a non-empty, screen-safe string.
 */
export function cleanName(raw: unknown): string {
  let name = String(raw ?? "")
    // whitespace first: a newline/tab is itself a control char, and collapsing it to a
    // space keeps "Ann<TAB>Lee" readable instead of gluing it into "AnnLee"
    .replace(WHITESPACE_RUN, " ")
    .replace(CONTROL_CHARS, "")
    .trim()
    .slice(0, MAX_NAME_LENGTH);
  if (!name) return FALLBACK_PLAYER_NAME;

  for (const word of BAD_WORDS) {
    name = name.replace(new RegExp(escapeRegExp(word), "gi"), (match) =>
      MASK_CHAR.repeat(match.length),
    );
  }
  return name.trim() || FALLBACK_PLAYER_NAME;
}
