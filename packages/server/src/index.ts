import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { ROOM_NAME } from "@hammer/shared";
import { GameRoom } from "./rooms/GameRoom";

const port = Number(process.env.PORT ?? 2567);

const gameServer = new Server({
  transport: new WebSocketTransport(),
});

gameServer.define(ROOM_NAME, GameRoom);

gameServer
  .listen(port)
  .then(() => {
    console.log(`⚔️  Hammer Party server listening on ws://localhost:${port}`);
    console.log(`    (room "${ROOM_NAME}" ready — Phase 00 handshake)`);
  })
  .catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });
