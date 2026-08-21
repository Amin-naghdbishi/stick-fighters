const fs = require('fs');

const gsPath = '/home/daEstitch/project/stickfighters/stick-fighters/server/gameServer.ts';
let gs = fs.readFileSync(gsPath, 'utf8');

// 1. returnToLobby
gs = gs.replace(
  `    if (!room) return;`,
  `    if (!room) return;\n    if (room.hostId !== client.id) return;`
);

// 2. updateCustomization
gs = gs.replace(
  `    Object.assign(room.players[client.id], cust);\n\n    this.broadcastRoom(room);`,
  `    const allowedKeys: (keyof import('../src/types/game.js').FighterCustomization)[] = [\n      'name', 'gender', 'color', 'hat', 'hair', 'skin', 'face', 'outfit', 'cape', 'shoes', 'accessory', 'effect'\n    ];\n    for (const key of allowedKeys) {\n      if (cust[key] !== undefined) {\n        (room.players[client.id] as any)[key] = cust[key];\n      }\n    }\n\n    this.broadcastRoom(room);`
);

// 3, 13. cleanupDeadRooms & purgeRoomSessions
gs = gs.replace(
  `  private cleanupDeadRooms() {\n    for (const [roomId, room] of this.rooms.entries()) {\n      const activeHumanPlayers = Object.keys(room.players).filter(\n        (id) => !room.players[id].isBot && this.clients.has(id)\n      );\n      if (activeHumanPlayers.length === 0) {\n        this.stopRoomLoop(roomId);\n        this.rooms.delete(roomId);\n        this.roomClients.delete(roomId);\n      }\n    }\n  }`,
  `  private purgeRoomSessions(roomId: string) {\n    for (const [clientId, session] of this.reconnectSessions.entries()) {\n      if (session.roomId === roomId) {\n        clearTimeout(session.timeout);\n        this.reconnectSessions.delete(clientId);\n      }\n    }\n  }\n\n  private cleanupDeadRooms() {\n    for (const [roomId, room] of this.rooms.entries()) {\n      const activeHumanPlayers = Object.keys(room.players).filter(\n        (id) => !room.players[id].isBot && this.clients.has(id)\n      );\n      let hasReconnectSession = false;\n      for (const session of this.reconnectSessions.values()) {\n        if (session.roomId === roomId) {\n          hasReconnectSession = true;\n          break;\n        }\n      }\n      if (activeHumanPlayers.length === 0 && !hasReconnectSession) {\n        this.stopRoomLoop(roomId);\n        this.rooms.delete(roomId);\n        this.roomClients.delete(roomId);\n        this.purgeRoomSessions(roomId);\n      }\n    }\n  }`
);

// expireReconnectSession purge
gs = gs.replace(
  `      if (remainingHumanIds.length === 0) {\n        this.stopRoomLoop(roomId);\n        this.rooms.delete(roomId);\n        this.roomClients.delete(roomId);\n      }`,
  `      if (remainingHumanIds.length === 0) {\n        this.stopRoomLoop(roomId);\n        this.rooms.delete(roomId);\n        this.roomClients.delete(roomId);\n        this.purgeRoomSessions(roomId);\n      }`
);

// leaveRoom purge
let leaveRoomStr = `  private leaveRoom(client: ConnectedClient) {`;
let idxLeaveRoom = gs.indexOf(leaveRoomStr);
let nextPart = gs.slice(idxLeaveRoom);
nextPart = nextPart.replace(
  `      if (remainingHumanIds.length === 0) {\n        this.stopRoomLoop(roomId);\n        this.rooms.delete(roomId);\n        this.roomClients.delete(roomId);\n      }`,
  `      if (remainingHumanIds.length === 0) {\n        this.stopRoomLoop(roomId);\n        this.rooms.delete(roomId);\n        this.roomClients.delete(roomId);\n        this.purgeRoomSessions(roomId);\n      }`
);
gs = gs.slice(0, idxLeaveRoom) + nextPart;

// 4. generateRoomCode
gs = gs.replace(
  `  private generateRoomCode(): string {\n    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';\n    let code = '';\n    for (let i = 0; i < 4; i++) {\n      code += letters[Math.floor(Math.random() * letters.length)];\n    }\n    return code;\n  }`,
  `  private generateRoomCode(): string {\n    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';\n    let code = '';\n    do {\n      code = '';\n      for (let i = 0; i < 4; i++) {\n        code += letters[Math.floor(Math.random() * letters.length)];\n      }\n    } while (this.rooms.has(code));\n    return code;\n  }`
);

// 5. Duel mode lockup
gs = gs.replace(
  `          const roundEnded =\n            (fighters.length >= 2 && livingFighters.length <= 1) ||\n            (room.matchDuration > 0 && room.matchTimeRemaining <= 0);`,
  `          const roundEnded =\n            fighters.length <= 1 ||\n            (fighters.length >= 2 && livingFighters.length <= 1) ||\n            (room.matchDuration > 0 && room.matchTimeRemaining <= 0);`
);

// 6. expireReconnectSession timeout clear
gs = gs.replace(
  `  private expireReconnectSession(clientId: string, roomId: string) {\n    this.reconnectSessions.delete(clientId);`,
  `  private expireReconnectSession(clientId: string, roomId: string) {\n    const session = this.reconnectSessions.get(clientId);\n    if (session) {\n      clearTimeout(session.timeout);\n    }\n    this.reconnectSessions.delete(clientId);`
);

// 7. startGame guard
gs = gs.replace(
  `    if (!room || room.hostId !== client.id) return;`,
  `    if (!room || room.hostId !== client.id) return;\n    if (room.status !== 'lobby' && room.status !== 'round_end') return;`
);

// 8. joinRoom capacity check order
gs = gs.replace(
  `    if (client.roomId) {\n      this.leaveRoom(client);\n    }\n\n    const currentCount = Object.keys(room.players).length;\n    if (currentCount >= room.maxPlayers || currentCount >= 10) {\n      this.send(client, { type: 'error', message: 'Room is full (Maximum players reached)!' });\n      return;\n    }`,
  `    const currentCount = Object.keys(room.players).length;\n    if (currentCount >= room.maxPlayers || currentCount >= 10) {\n      this.send(client, { type: 'error', message: 'Room is full (Maximum players reached)!' });\n      return;\n    }\n\n    if (client.roomId) {\n      this.leaveRoom(client);\n    }`
);

// 9. Rate limiting
gs = gs.replace(
  `    // Max 65 packets/sec per socket\n    if (client.packetCountWindow > 65 && msg.type === 'input') {\n      return; // Reject excessive packet flooding\n    }`,
  `    // Max 100 packets/sec per socket for all types\n    if (client.packetCountWindow > 100) {\n      return; // Reject excessive packet flooding\n    }`
);

// 10. Simulation loop stop
gs = gs.replace(
  `          if (room.matchDuration > 0 && room.matchTimeRemaining <= 0) {\n            room.status = 'round_end';`,
  `          if (room.matchDuration > 0 && room.matchTimeRemaining <= 0) {\n            this.stopRoomLoop(room.roomId);\n            room.status = 'round_end';`
);

gs = gs.replace(
  `            } else {\n              room.status = 'round_end';`,
  `            } else {\n              this.stopRoomLoop(room.roomId);\n              room.status = 'round_end';`
);

// 12. Cleanup interval leak
gs = gs.replace(
  `export class GameServer {\n  private clients: Map<string, ConnectedClient> = new Map();`,
  `export class GameServer {\n  private cleanupInterval: NodeJS.Timeout;\n  private clients: Map<string, ConnectedClient> = new Map();`
);

gs = gs.replace(
  `  constructor() {\n    // Regular cleanup for dead rooms & inactive sessions\n    setInterval(() => this.cleanupDeadRooms(), 15000);\n  }`,
  `  constructor() {\n    // Regular cleanup for dead rooms & inactive sessions\n    this.cleanupInterval = setInterval(() => this.cleanupDeadRooms(), 15000);\n  }`
);

// 14. WebSocket backpressure
gs = gs.replace(
  `  private send(client: ConnectedClient, msg: ServerMessage) {\n    if (client.ws.readyState === WebSocket.OPEN) {\n      client.ws.send(JSON.stringify(msg));\n    }\n  }`,
  `  private send(client: ConnectedClient, msg: ServerMessage) {\n    if (client.ws.readyState === WebSocket.OPEN && client.ws.bufferedAmount < 65536) {\n      client.ws.send(JSON.stringify(msg));\n    }\n  }`
);

gs = gs.replace(
  `    for (const client of clients) {\n      if (client.ws.readyState === WebSocket.OPEN) {\n        client.ws.send(payload);\n      }\n    }`,
  `    for (const client of clients) {\n      if (client.ws.readyState === WebSocket.OPEN && client.ws.bufferedAmount < 65536) {\n        client.ws.send(payload);\n      }\n    }`
);

// 15. Shutdown sequence fix
gs = gs.replace(
  `  public shutdown() {\n    console.log('Shutting down GameServer...');\n    for (const roomId of Array.from(this.roomLoops.keys())) {\n      this.stopRoomLoop(roomId);\n    }\n    for (const session of this.reconnectSessions.values()) {\n      clearTimeout(session.timeout);\n    }\n    this.reconnectSessions.clear();\n    this.rooms.clear();\n    this.roomClients.clear();\n    this.clients.clear();\n  }`,
  `  public shutdown() {\n    console.log('Shutting down GameServer...');\n    clearInterval(this.cleanupInterval);\n    for (const roomId of Array.from(this.roomLoops.keys())) {\n      this.stopRoomLoop(roomId);\n    }\n    for (const session of this.reconnectSessions.values()) {\n      clearTimeout(session.timeout);\n    }\n    for (const client of this.clients.values()) {\n      try {\n        client.ws.close(1001, 'Server Shutting Down');\n      } catch (e) {}\n    }\n    this.reconnectSessions.clear();\n    this.rooms.clear();\n    this.roomClients.clear();\n    this.clients.clear();\n    setTimeout(() => process.exit(0), 3000);\n  }`
);

fs.writeFileSync(gsPath, gs, 'utf8');

// server.ts modifications
const srvPath = '/home/daEstitch/project/stickfighters/stick-fighters/server.ts';
let srv = fs.readFileSync(srvPath, 'utf8');

srv = srv.replace(
  `  const wss = new WebSocketServer({ server, path: '/ws' });`,
  `  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 16384 });`
);

fs.writeFileSync(srvPath, srv, 'utf8');

console.log("Done");
