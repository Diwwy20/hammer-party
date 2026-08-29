import { createServer } from "node:http";
import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { ROOM_NAME } from "@hammer/shared";
import { EXIT_FAILURE, HEALTH_PATH, HTTP_STATUS, serverConfig } from "./config";
import { createLogger } from "./logger";
import { GameRoom } from "./rooms/GameRoom";

/**
 * Process entry point: an HTTP server that exists only to carry the Colyseus
 * WebSocket transport (plus a health check). There is no HTTP data API — every
 * result is per-match and lives in the room state.
 */

const log = createLogger();

const httpServer = createServer((req, res) => {
  if (req.url === HEALTH_PATH) {
    res.writeHead(HTTP_STATUS.Ok, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  res.writeHead(HTTP_STATUS.NotFound);
  res.end();
});

const gameServer = new Server({ transport: new WebSocketTransport({ server: httpServer }) });

// filterBy(['code']) groups matchmaking by room code: the Host creates a room
// with a code, and players who join with the same code land in that exact room.
gameServer.define(ROOM_NAME, GameRoom).filterBy(["code"]);

gameServer
  .listen(serverConfig.port)
  .then(() => {
    log.info(`⚔️  Hammer Party server listening on ws://localhost:${serverConfig.port}`);
  })
  .catch((err) => {
    log.error("Failed to start server:", err);
    process.exit(EXIT_FAILURE);
  });
