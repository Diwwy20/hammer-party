/**
 * The one place the server writes to the console.
 *
 * Game-day logs are read live off a laptop terminal, so they stay short, prefixed
 * with their scope (`[room ABCD]`) and human-readable. Swapping in a real log sink
 * later means changing this file only.
 */

export interface Logger {
  info(message: string): void;
  error(message: string, cause?: unknown): void;
  /** A nested logger, e.g. `createLogger().child("room ABCD")`. */
  child(scope: string): Logger;
}

const joinScopes = (parent: string, scope: string): string =>
  parent ? `${parent} · ${scope}` : scope;

export function createLogger(scope = ""): Logger {
  const prefix = scope ? `[${scope}] ` : "";
  return {
    info: (message) => console.log(`${prefix}${message}`),
    error: (message, cause) => console.error(`${prefix}${message}`, cause ?? ""),
    child: (child) => createLogger(joinScopes(scope, child)),
  };
}
