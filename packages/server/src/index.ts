import { createServer } from "node:http";
import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { ROOM_NAME } from "@hammer/shared";
import { GameRoom } from "./rooms/GameRoom";

const port = Number(process.env.PORT ?? 2567);

// Bare HTTP server — just enough to host the Colyseus WebSocket transport and a
// health check. (No leaderboard API any more: results are per-match only, shown on
// the Results screen and never persisted.)
const httpServer = createServer((req, res) => {
  if (req.url === "/api/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const gameServer = new Server({ transport: new WebSocketTransport({ server: httpServer }) });

// filterBy(['code']) groups matchmaking by room code: the Host creates a room
// with a code, and players who join with the same code land in that exact room.
gameServer.define(ROOM_NAME, GameRoom).filterBy(["code"]);

gameServer
  .listen(port)
  .then(() => {
    console.log(`⚔️  Hammer Party server listening on ws://localhost:${port}`);
  })
  .catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });
