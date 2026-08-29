import { Client } from "colyseus.js";
import { SERVER_URL } from "./config";

/** The single Colyseus client instance. Everything else goes through `session.ts`. */
export const colyseus = new Client(SERVER_URL);
