import { Client } from "colyseus.js";

/**
 * Where to reach the Colyseus server. Defaults to the same host that served the
 * page on port 2567 — so scanning a QR to http://<host>:5173 on a phone just
 * works on the same LAN without hardcoding an IP. Override with VITE_SERVER_URL.
 */
export const SERVER_URL: string =
  (import.meta.env.VITE_SERVER_URL as string | undefined) ??
  `ws://${location.hostname}:2567`;

export const colyseus = new Client(SERVER_URL);
