import { WebSocket } from 'ws';

/**
 * Stick Fighters Multiplayer Server Load & Stress Testing Utility
 * Simulates multiple concurrent rooms and players sending input payloads over WebSockets.
 *
 * Usage:
 *   npx tsx scripts/loadTest.ts [targetRooms] [playersPerRoom] [serverUrl] [testDurationSec]
 *
 * Example:
 *   npx tsx scripts/loadTest.ts 50 10 ws://localhost:3000/ws 60
 */

const targetRooms = parseInt(process.argv[2] || '10', 10);
const playersPerRoom = parseInt(process.argv[3] || '4', 10);
const serverUrl = process.argv[4] || 'ws://localhost:3000/ws';
const testDuration = parseInt(process.argv[5] || '30', 10);

console.log('====================================================');
console.log('🚀 STICK FIGHTERS SERVER LOAD TEST');
console.log(`Target Rooms        : ${targetRooms}`);
console.log(`Players Per Room    : ${playersPerRoom}`);
console.log(`Total Target Clients: ${targetRooms * playersPerRoom}`);
console.log(`Server URL          : ${serverUrl}`);
console.log(`Test Duration       : ${testDuration}s`);
console.log('====================================================\n');

interface Stats {
  connectedClients: number;
  disconnectedClients: number;
  createdRooms: number;
  joinedRooms: number;
  gamesStarted: number;
  tickMessagesReceived: number;
  errorsEncountered: number;
  startTime: number;
  pings: number[];
  lastTickTime: number;
  tickIntervals: number[];
  messagesSent: number;
  bytesReceived: number;
}

const stats: Stats = {
  connectedClients: 0,
  disconnectedClients: 0,
  createdRooms: 0,
  joinedRooms: 0,
  gamesStarted: 0,
  tickMessagesReceived: 0,
  errorsEncountered: 0,
  startTime: Date.now(),
  pings: [],
  lastTickTime: 0,
  tickIntervals: [],
  messagesSent: 0,
  bytesReceived: 0,
};

// Track room codes assigned by server (host ID -> room code)
const roomCodes: Map<number, string> = new Map(); // roomIndex -> serverRoomCode
const roomWaiters: Map<number, ((code: string) => void)[]> = new Map();

class SimulatedClient {
  public ws: WebSocket | null = null;
  public id: string = '';
  public isHost: boolean;
  public roomIndex: number;
  private inputInterval: any = null;
  private pingInterval: any = null;
  private serverRoomCode: string = '';

  constructor(isHost: boolean, roomIndex: number) {
    this.isHost = isHost;
    this.roomIndex = roomIndex;
  }

  public async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(serverUrl);
      } catch (e) {
        stats.errorsEncountered++;
        reject(e);
        return;
      }

      const timeout = setTimeout(() => {
        stats.errorsEncountered++;
        reject(new Error('Connection timeout'));
      }, 10000);

      this.ws.on('open', async () => {
        clearTimeout(timeout);
        stats.connectedClients++;

        if (this.isHost) {
          // Create Room
          this.send({
            type: 'create_room',
            player: {
              name: `HostBot_R${this.roomIndex}`,
              gender: 'male',
              color: '#FF5733',
              hat: 'cap',
            },
            mode: 'ffa',
            mapId: 'park',
            maxPlayers: playersPerRoom,
            fillWithBots: false,
            roomName: `LoadTest_R${this.roomIndex}`,
          });
        } else {
          // Wait for room code from host
          const code = roomCodes.get(this.roomIndex);
          if (code) {
            this.joinWithCode(code);
          } else {
            // Register a waiter
            if (!roomWaiters.has(this.roomIndex)) {
              roomWaiters.set(this.roomIndex, []);
            }
            roomWaiters.get(this.roomIndex)!.push((c) => this.joinWithCode(c));
          }
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

        // Send pings every 3 seconds
        this.pingInterval = setInterval(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.send({ type: 'ping', timestamp: Date.now() });
          }
        }, 3000);

        resolve();
      });

      this.ws.on('message', (data: Buffer | string) => {
        try {
          const raw = data.toString();
          stats.bytesReceived += raw.length;
          const msg = JSON.parse(raw);

          if (msg.type === 'room_joined') {
            this.serverRoomCode = msg.room.roomId;
            this.id = msg.yourId;

            if (this.isHost) {
              stats.createdRooms++;
              roomCodes.set(this.roomIndex, this.serverRoomCode);

              // Notify waiting peers
              const waiters = roomWaiters.get(this.roomIndex);
              if (waiters) {
                for (const cb of waiters) cb(this.serverRoomCode);
                roomWaiters.delete(this.roomIndex);
              }
            } else {
              stats.joinedRooms++;
            }
          } else if (msg.type === 'room_state') {
            // Host starts game when all players joined
            if (this.isHost && msg.room?.status === 'lobby') {
              const playerCount = msg.room.players ? Object.keys(msg.room.players).length : 0;
              if (playerCount >= playersPerRoom) {
                this.send({ type: 'start_game' });
                stats.gamesStarted++;
              }
            }
          } else if (msg.type === 'game_tick') {
            stats.tickMessagesReceived++;
            const now = Date.now();
            if (stats.lastTickTime > 0) {
              stats.tickIntervals.push(now - stats.lastTickTime);
              if (stats.tickIntervals.length > 200) stats.tickIntervals.shift();
            }
            stats.lastTickTime = now;
          } else if (msg.type === 'pong') {
            if (msg.timestamp) {
              const latency = Date.now() - msg.timestamp;
              stats.pings.push(latency);
              if (stats.pings.length > 500) stats.pings.shift();
            }
          } else if (msg.type === 'error') {
            // Ignore "All players must be Ready" errors during load test
          }
        } catch (err) {
          stats.errorsEncountered++;
        }
      });

      this.ws.on('error', () => {
        stats.errorsEncountered++;
      });

      this.ws.on('close', () => {
        stats.disconnectedClients++;
        if (this.inputInterval) clearInterval(this.inputInterval);
        if (this.pingInterval) clearInterval(this.pingInterval);
      });
    });
  }

  private joinWithCode(code: string) {
    this.send({
      type: 'join_room',
      roomId: code,
      player: {
        name: `LoadBot_R${this.roomIndex}_P${Math.floor(Math.random() * 1000)}`,
        gender: 'female',
        color: '#3B82F6',
        hat: 'ninja',
      },
    });
  }

  public send(msg: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
      stats.messagesSent++;
    }
  }

  public close() {
    if (this.inputInterval) clearInterval(this.inputInterval);
    if (this.pingInterval) clearInterval(this.pingInterval);
    if (this.ws) this.ws.close();
  }
}

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.floor(sorted.length * p);
  return sorted[Math.min(idx, sorted.length - 1)];
}

async function runLoadTest() {
  const clients: SimulatedClient[] = [];

  console.log('📡 Connecting clients...\n');

  for (let r = 0; r < targetRooms; r++) {
    // Host client
    const host = new SimulatedClient(true, r);
    clients.push(host);
    try {
      await host.connect();
    } catch (e) {
      console.error(`  ⚠ Host for room ${r} failed to connect`);
    }

    // Small delay before spawning other players in room
    await new Promise((res) => setTimeout(res, 100));

    for (let p = 1; p < playersPerRoom; p++) {
      const peer = new SimulatedClient(false, r);
      clients.push(peer);
      try {
        await peer.connect();
      } catch (e) {
        console.error(`  ⚠ Player ${p} for room ${r} failed to connect`);
      }
      await new Promise((res) => setTimeout(res, 30));
    }

    if ((r + 1) % 5 === 0) {
      console.log(`  ✓ Created ${r + 1}/${targetRooms} rooms (${stats.connectedClients} clients connected)`);
    }
  }

  console.log(`\n⚡ All ${clients.length} test clients dispatched! Monitoring server for ${testDuration}s...\n`);

  // Reset tick counter for accurate rate measurement
  const measureStart = Date.now();
  let measureTicks = 0;

  // Monitor Stats Interval
  const monitorInterval = setInterval(() => {
    const elapsedSec = (Date.now() - stats.startTime) / 1000;
    const measureElapsed = (Date.now() - measureStart) / 1000;

    const avgPing =
      stats.pings.length > 0
        ? (stats.pings.reduce((a, b) => a + b, 0) / stats.pings.length).toFixed(1)
        : 'N/A';
    const p99Ping = stats.pings.length > 0 ? percentile(stats.pings, 0.99).toFixed(0) : 'N/A';
    const avgTickInterval =
      stats.tickIntervals.length > 0
        ? (stats.tickIntervals.reduce((a, b) => a + b, 0) / stats.tickIntervals.length).toFixed(1)
        : 'N/A';

    const ticksPerSec = measureElapsed > 0 ? Math.round(stats.tickMessagesReceived / measureElapsed) : 0;
    const sendRate = measureElapsed > 0 ? Math.round(stats.messagesSent / measureElapsed) : 0;
    const bandwidth = measureElapsed > 0 ? (stats.bytesReceived / measureElapsed / 1024).toFixed(1) : '0';

    const memUsage = process.memoryUsage();

    console.log(
      `[${elapsedSec.toFixed(0)}s] ` +
        `Clients: ${stats.connectedClients - stats.disconnectedClients}/${targetRooms * playersPerRoom} | ` +
        `Rooms: ${stats.createdRooms} | Games: ${stats.gamesStarted} | ` +
        `Ticks/s: ${ticksPerSec} | Send/s: ${sendRate} | ` +
        `Ping avg: ${avgPing}ms p99: ${p99Ping}ms | ` +
        `Tick Δ: ${avgTickInterval}ms | ` +
        `BW: ${bandwidth} KB/s | ` +
        `Mem: ${(memUsage.heapUsed / 1024 / 1024).toFixed(1)}MB | ` +
        `Errors: ${stats.errorsEncountered}`
    );
  }, 3000);

  // Stop test after duration
  await new Promise((res) => setTimeout(res, testDuration * 1000));

  clearInterval(monitorInterval);
  const totalElapsed = (Date.now() - stats.startTime) / 1000;
  const measureElapsed = (Date.now() - measureStart) / 1000;
  const memUsage = process.memoryUsage();

  console.log('\n====================================================');
  console.log('🏁 LOAD TEST COMPLETED — FINAL REPORT');
  console.log('====================================================');
  console.log(`Test Duration            : ${totalElapsed.toFixed(1)}s`);
  console.log(`Connected Clients        : ${stats.connectedClients}`);
  console.log(`Disconnected During Test : ${stats.disconnectedClients}`);
  console.log(`Active Clients           : ${stats.connectedClients - stats.disconnectedClients}`);
  console.log(`Rooms Created            : ${stats.createdRooms}`);
  console.log(`Rooms Joined             : ${stats.joinedRooms}`);
  console.log(`Games Started            : ${stats.gamesStarted}`);
  console.log('----------------------------------------------------');
  console.log(`Total Ticks Received     : ${stats.tickMessagesReceived}`);
  console.log(`Avg Tick Rate            : ${Math.round(stats.tickMessagesReceived / measureElapsed)} ticks/sec`);
  console.log(`Total Messages Sent      : ${stats.messagesSent}`);
  console.log(`Avg Send Rate            : ${Math.round(stats.messagesSent / measureElapsed)} msgs/sec`);
  console.log(`Total Bytes Received     : ${(stats.bytesReceived / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Avg Bandwidth Received   : ${(stats.bytesReceived / measureElapsed / 1024).toFixed(1)} KB/s`);
  console.log('----------------------------------------------------');

  if (stats.pings.length > 0) {
    const sorted = [...stats.pings].sort((a, b) => a - b);
    console.log(`Ping Samples             : ${stats.pings.length}`);
    console.log(`Ping Min                 : ${sorted[0]}ms`);
    console.log(`Ping Avg                 : ${(sorted.reduce((a, b) => a + b, 0) / sorted.length).toFixed(1)}ms`);
    console.log(`Ping Median (p50)        : ${percentile(sorted, 0.5)}ms`);
    console.log(`Ping p95                 : ${percentile(sorted, 0.95)}ms`);
    console.log(`Ping p99                 : ${percentile(sorted, 0.99)}ms`);
    console.log(`Ping Max                 : ${sorted[sorted.length - 1]}ms`);
  } else {
    console.log('Ping                     : No samples collected');
  }

  if (stats.tickIntervals.length > 0) {
    const avgTick = stats.tickIntervals.reduce((a, b) => a + b, 0) / stats.tickIntervals.length;
    const maxTick = Math.max(...stats.tickIntervals);
    const jitter = Math.sqrt(
      stats.tickIntervals.reduce((sum, t) => sum + (t - avgTick) ** 2, 0) / stats.tickIntervals.length
    );
    console.log('----------------------------------------------------');
    console.log(`Tick Interval Avg        : ${avgTick.toFixed(1)}ms (target: 33.3ms)`);
    console.log(`Tick Interval Max        : ${maxTick}ms`);
    console.log(`Tick Jitter (stddev)     : ${jitter.toFixed(1)}ms`);
  }

  console.log('----------------------------------------------------');
  console.log(`Client Memory (heap)     : ${(memUsage.heapUsed / 1024 / 1024).toFixed(1)} MB`);
  console.log(`Errors Encountered       : ${stats.errorsEncountered}`);
  console.log('====================================================');

  // Capacity estimate
  const activeClients = stats.connectedClients - stats.disconnectedClients;
  const expectedTotalTicksPerSec = stats.createdRooms * activeClients * 30;
  if (expectedTotalTicksPerSec > 0) {
    const deliveryRatio = stats.tickMessagesReceived / measureElapsed / (expectedTotalTicksPerSec / 30);
    console.log(`\n📊 Estimated Delivery Ratio: ${(deliveryRatio * 100).toFixed(1)}%`);
    if (deliveryRatio > 0.9) {
      console.log('✅ Server is handling the load well.');
    } else if (deliveryRatio > 0.7) {
      console.log('⚠️  Server is under moderate stress — some ticks may be delayed.');
    } else {
      console.log('🔴 Server is under heavy stress — significant tick loss detected.');
    }
  }

  for (const c of clients) {
    c.close();
  }

  // Give sockets time to close
  await new Promise((res) => setTimeout(res, 1000));
  process.exit(0);
}

runLoadTest().catch((e) => {
  console.error('Load test error:', e);
  process.exit(1);
});
