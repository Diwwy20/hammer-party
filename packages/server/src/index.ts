import { createServer } from "node:http";
import express from "express";
import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { ROOM_NAME } from "@hammer/shared";
import { GameRoom } from "./rooms/GameRoom";
import { getLeaderboard } from "./leaderboard";

const port = Number(process.env.PORT ?? 2567);

// HTTP side: the monthly leaderboard API (Phase 05), served on the same port as
// the Colyseus WS so a phone only needs one address. CORS "*" — it's a LAN tool.
const app = express();
app.use((_req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET");
  next();
});
app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});
app.get("/api/leaderboard", (req, res) => {
  const period = typeof req.query.period === "string" ? req.query.period : undefined;
  res.json(getLeaderboard(period));
});

const httpServer = createServer(app);
const gameServer = new Server({ transport: new WebSocketTransport({ server: httpServer }) });

// filterBy(['code']) groups matchmaking by room code: the Host creates a room
// with a code, and players who join with the same code land in that exact room.
gameServer.define(ROOM_NAME, GameRoom).filterBy(["code"]);

gameServer
  .listen(port)
  .then(() => {
    console.log(`⚔️  Hammer Party server listening on ws://localhost:${port}`);
    console.log(`    HTTP API: http://localhost:${port}/api/leaderboard`);
  })
  .catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });
