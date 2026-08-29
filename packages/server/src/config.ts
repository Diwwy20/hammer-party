import { DEFAULT_SERVER_PORT } from "@hammer/shared";

/**
 * Everything the process reads from its environment, resolved once at boot so no
 * module reaches into `process.env` on its own.
 */

/** Liveness probe — the only HTTP route; everything else is the WS transport. */
export const HEALTH_PATH = "/api/health";

/** HTTP statuses the health server answers with. */
export const HTTP_STATUS = {
  Ok: 200,
  NotFound: 404,
} as const;

/** Exit code used when the server cannot bind its port. */
export const EXIT_FAILURE = 1;

export interface ServerConfig {
  port: number;
}

function readPort(): number {
  const raw = process.env.PORT;
  const parsed = raw === undefined ? NaN : Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_SERVER_PORT;
}

export const serverConfig: ServerConfig = {
  port: readPort(),
};
