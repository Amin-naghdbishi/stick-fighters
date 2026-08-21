import { WebSocket } from 'ws';

/**
 * Stick Fighters Multiplayer Server Load & Stress Testing Utility
 * Simulates multiple concurrent rooms and players sending input payloads over WebSockets.
 *
 * Usage:
 *   npx tsx scripts/loadTest.ts [targetRooms] [playersPerRoom] [serverUrl]
 *
 * Example:
 *   npx tsx scripts/loadTest.ts 50 10 ws://localhost:3000/ws
 */

const targetRooms = parseInt(process.argv[2] || '10', 10);
const playersPerRoom = parseInt(process.argv[3] || '4', 10);
const serverUrl = process.argv[4] || 'ws://localhost:3000/ws';

console.log('====================================================');
console.log('🚀 STICK FIGHTERS SERVER LOAD TEST');
console.log(`Target Rooms       : ${targetRooms}`);
console.log(`Players Per Room   : ${playersPerRoom}`);
console.log(`Total Target Clients: ${targetRooms * playersPerRoom}`);
console.log(`Server URL         : ${serverUrl}`);
console.log('====================================================\n');

interface Stats {
  connectedClients: number;
  createdRooms: number;
  tickMessagesReceived: number;
  errorsEncountered: number;
  startTime: number;
  pings: number[];
}

const stats: Stats = {
  connectedClients: 0,
  createdRooms: 0,
  tickMessagesReceived: 0,
  errorsEncountered: 0,
  startTime: Date.now(),
  pings: [],
};

const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function randomRoomCode(): string {
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += letters[Math.floor(Math.random() * letters.length)];
  }
  return 'LT' + code.slice(2);
}

class SimulatedClient {
  public ws: WebSocket | null = null;
  public id: string = '';
  public isHost: boolean;
  public roomCode: string;
  private inputInterval: any = null;

  constructor(isHost: boolean, roomCode: string) {
    this.isHost = isHost;
    this.roomCode = roomCode;
  }

  public connect() {
    this.ws = new WebSocket(serverUrl);

    this.ws.on('open', () => {
      stats.connectedClients++;

      if (this.isHost) {
        // Create Room
        this.send({
          type: 'create_room',
          player: {
            name: `HostBot_${Math.floor(Math.random() * 1000)}`,
            gender: 'male',
            color: '#FF5733',
            hat: 'cap',
          },
          mode: 'ffa',
          mapId: 'park',
          maxPlayers: playersPerRoom,
          fillWithBots: false,
          roomName: `LoadTest_${this.roomCode}`,
        });
      } else {
        // Join Room
        this.send({
          type: 'join_room',
          roomId: this.roomCode,
          player: {
            name: `LoadBot_${Math.floor(Math.random() * 1000)}`,
            gender: 'female',
            color: '#3B82F6',
            hat: 'ninja',
          },
        });
      }

      // Start input loop at 30Hz
      this.inputInterval = setInterval(() => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          const aim = (Math.random() - 0.5) * Math.PI * 2;
          this.send({
            type: 'input',
            input: {
              left: Math.random() > 0.6,
              right: Math.random() > 0.6,
              up: Math.random() > 0.85,
              down: false,
              fastAttack: Math.random() > 0.7,
              heavyAttack: Math.random() > 0.9,
              block: false,
              fire: Math.random() > 0.5,
              aimAngle: aim,
            },
          });
        }
      }, 33);
    });

    this.ws.on('message', (data: string) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'room_state') {
          if (this.isHost && msg.room.status === 'lobby') {
            stats.createdRooms++;
            // Start game
            this.send({ type: 'start_game' });
          }
        } else if (msg.type === 'game_tick') {
          stats.tickMessagesReceived++;
        } else if (msg.type === 'pong') {
          if (msg.timestamp) {
            stats.pings.push(Date.now() - msg.timestamp);
          }
        }
      } catch (err) {
        stats.errorsEncountered++;
      }
    });

    this.ws.on('error', () => {
      stats.errorsEncountered++;
    });

    this.ws.on('close', () => {
      if (this.inputInterval) clearInterval(this.inputInterval);
    });
  }

  public send(msg: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  public close() {
    if (this.inputInterval) clearInterval(this.inputInterval);
    if (this.ws) this.ws.close();
  }
}

async function runLoadTest() {
  const clients: SimulatedClient[] = [];

  for (let r = 0; r < targetRooms; r++) {
    const roomCode = randomRoomCode();
    // Host client
    const host = new SimulatedClient(true, roomCode);
    clients.push(host);
    host.connect();

    // Small delay before spawning other players in room
    await new Promise((res) => setTimeout(res, 80));

    for (let p = 1; p < playersPerRoom; p++) {
      const peer = new SimulatedClient(false, roomCode);
      clients.push(peer);
      peer.connect();
      await new Promise((res) => setTimeout(res, 20));
    }
  }

  console.log('⚡ All test clients dispatched! Monitoring server performance...\n');

  // Monitor Stats Interval
  const monitorInterval = setInterval(() => {
    const elapsedSec = (Date.now() - stats.startTime) / 1000;
    const ticksPerSec = Math.round(stats.tickMessagesReceived / Math.max(1, elapsedSec));
    const avgPing =
      stats.pings.length > 0
        ? (stats.pings.reduce((a, b) => a + b, 0) / stats.pings.length).toFixed(1)
        : 'N/A';

    console.log(
      `[${elapsedSec.toFixed(0)}s] Connected: ${stats.connectedClients}/${targetRooms * playersPerRoom} | ` +
        `Rooms: ${stats.createdRooms} | Ticks/sec: ${ticksPerSec} | Avg Latency: ${avgPing}ms | Errors: ${stats.errorsEncountered}`
    );
  }, 2000);

  // Stop test after 30 seconds
  setTimeout(() => {
    clearInterval(monitorInterval);
    console.log('\n====================================================');
    console.log('🏁 LOAD TEST COMPLETED SUMMARY');
    console.log(`Total Connected Clients  : ${stats.connectedClients}`);
    console.log(`Total Active Rooms       : ${stats.createdRooms}`);
    console.log(`Total Packets Received   : ${stats.tickMessagesReceived}`);
    console.log(`Total Packet Rate        : ${Math.round(stats.tickMessagesReceived / 30)} packets/sec`);
    console.log(`Total Errors Encountered : ${stats.errorsEncountered}`);
    console.log('====================================================');

    for (const c of clients) {
      c.close();
    }
    process.exit(0);
  }, 30000);
}

runLoadTest().catch((e) => {
  console.error('Load test error:', e);
  process.exit(1);
});
