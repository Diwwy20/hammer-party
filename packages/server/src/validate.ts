import { z } from "zod";

/**
 * Thin server-edge validation (Phase 04). The server is authoritative, so this is
 * belt-and-braces: reject malformed/hostile message shapes before they touch the
 * sim, and sanitise the one piece of free player text — the display name — since
 * it goes up on the big screen.
 */

export const inputSchema = z.object({
  seq: z.number().finite().optional(),
  dx: z.number().finite(),
  dz: z.number().finite(),
});

export const readySchema = z.object({ ready: z.boolean() });

export const cosmeticSchema = z.object({
  colorIndex: z.number().int().optional(),
  hatIndex: z.number().int().optional(),
  faceIndex: z.number().int().optional(),
  backIndex: z.number().int().optional(),
});

export const eventSchema = z.object({ kind: z.enum(["golden", "heal"]) });

export const prankSchema = z.object({ kind: z.enum(["banana", "bomb"]) });

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

const MAX_NAME = 16;
const FALLBACK_NAME = "ผู้เล่น";

/**
 * Sanitise a display name: strip control chars, collapse whitespace, clamp length,
 * mask profanity. Always returns a non-empty, screen-safe string.
 */
export function cleanName(raw: unknown): string {
  let s = String(raw ?? "")
    .replace(/\p{Cc}/gu, "") // drop control characters
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_NAME);
  if (!s) return FALLBACK_NAME;

  for (const w of BAD_WORDS) {
    s = s.replace(new RegExp(escapeRegExp(w), "gi"), (m) => "*".repeat(m.length));
  }
  s = s.trim();
  return s || FALLBACK_NAME;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
