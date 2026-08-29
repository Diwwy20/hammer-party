import { DEFAULT_SERVER_PORT, ROOM_CODE_STRIP_PATTERN, ROOM_CODE_LENGTH } from "@hammer/shared";

/** Everything the network layer is configured by: where to dial, and how to retry. */

/**
 * Where to reach the Colyseus server. Defaults to the same host that served the
 * page — so scanning a QR on a phone just works on the same LAN without hardcoding
 * an IP. Override with VITE_SERVER_URL.
 */
export const SERVER_URL: string =
  (import.meta.env.VITE_SERVER_URL as string | undefined) ??
  `ws://${location.hostname}:${DEFAULT_SERVER_PORT}`;

/** Query params on the join link: `?room=ABCD` from the QR, `?host` for the big screen. */
export const JOIN_PARAM = {
  Room: "room",
  Host: "host",
} as const;

/** The link encoded into the Host's QR code. */
export function buildJoinUrl(code: string): string {
  return `${location.origin}/?${JOIN_PARAM.Room}=${encodeURIComponent(code)}`;
}

/** Normalise a code typed by hand or read off a URL. */
export function normaliseRoomCode(raw: string): string {
  return raw.toUpperCase().replace(ROOM_CODE_STRIP_PATTERN, "").slice(0, ROOM_CODE_LENGTH);
}

/**
 * Mid-match drop policy. Party wifi blips; the server holds the seat for
 * `RECONNECT_SECONDS`, so keep trying for roughly that long.
 */
export const RECONNECT = {
  attempts: 6,
  retryDelayMs: 1500,
} as const;

/** WebSocket close code for a clean, intentional close — never worth retrying. */
export const WS_NORMAL_CLOSE = 1000;

/** The name the Host connection joins under. It is never rendered as a player. */
export const HOST_DISPLAY_NAME = "HOST";
