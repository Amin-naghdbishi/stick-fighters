import { WebSocket } from 'ws';
import { ARENAS } from '../src/game/arenas.js';
import {
  checkAttackCollisions,
  checkWeaponPickups,
  createInitialFighter,
  fireFighterWeapon,
  updateBotAI,
  updateFighterPhysics,
  updateProjectiles,
} from '../src/game/physics.js';
import { generateRandomBotCustomization } from '../src/game/customizationCatalog.js';
import {
  ClientMessage,
  ComicPop,
  FighterCustomization,
  FighterState,
  GameMode,
  PlayerInput,
  RoomState,
  ServerMessage,
} from '../src/types/game.js';

interface ConnectedClient {
  id: string;
  ws: WebSocket;
  roomId: string | null;
  customization: FighterCustomization;
  input: PlayerInput;
  lastPing: number;
}

export class GameServer {
  private clients: Map<string, ConnectedClient> = new Map();
  private rooms: Map<string, RoomState> = new Map();
  private roomLoops: Map<string, any> = new Map();

  constructor() {
    // Initial cleanup interval
    setInterval(() => this.cleanupDeadRooms(), 15000);
  }

  public handleConnection(ws: WebSocket) {
    const clientId = 'p_' + Math.random().toString(36).substring(2, 9);
    const defaultInput: PlayerInput = {
      left: false,
      right: false,
      up: false,
      down: false,
      fastAttack: false,
      heavyAttack: false,
      block: false,
      fire: false,
      aimAngle: 0,
    };

    const client: ConnectedClient = {
      id: clientId,
      ws,
      roomId: null,
      customization: {
        name: `Fighter ${clientId.slice(2, 5)}`,
        gender: 'male',
        color: '#FF5733',
        hat: 'none',
      },
      input: defaultInput,
      lastPing: Date.now(),
    };

    this.clients.set(clientId, client);

    ws.on('message', (data: string) => {
      try {
        const msg = JSON.parse(data.toString()) as ClientMessage;
        this.handleClientMessage(client, msg);
      } catch (err) {
        console.error('Failed to parse client message:', err);
      }
    });

    ws.on('close', () => {
      this.handleDisconnect(client);
    });

    ws.on('error', (err) => {
      console.error(`Socket error on client ${clientId}:`, err);
    });
  }

  private handleDisconnect(client: ConnectedClient) {
    if (client.roomId) {
      this.leaveRoom(client);
    }
    this.clients.delete(client.id);
  }

  private handleClientMessage(client: ConnectedClient, msg: ClientMessage) {
    switch (msg.type) {
      case 'ping':
        this.send(client, { type: 'pong', timestamp: msg.timestamp, serverTime: Date.now() });
        break;

      case 'create_room':
        this.createRoom(
          client,
          msg.player,
          msg.mode,
          msg.mapId,
          msg.fillWithBots,
          msg.maxPlayers,
          msg.botCount,
          msg.roomName
        );
        break;

      case 'join_room':
        this.joinRoom(client, msg.roomId, msg.player, msg.mode, msg.mapId, msg.fillWithBots, msg.botCount);
        break;

      case 'quick_match':
        this.quickMatch(client, msg.player, msg.mode);
        break;

      case 'leave_room':
        this.leaveRoom(client);
        break;

      case 'set_ready':
        this.setReady(client, msg.isReady);
        break;

      case 'update_customization':
        this.updateCustomization(client, msg.customization);
        break;

      case 'update_room_settings':
        this.updateRoomSettings(client, msg);
        break;

      case 'start_game':
        this.startGame(client);
        break;

      case 'input':
        if (msg.input) {
          client.input = msg.input;
        }
        break;

      case 'chat':
        this.handleChat(client, msg.message);
        break;

      case 'restart_match':
        this.restartMatch(client);
        break;

      case 'return_to_lobby':
        this.returnToLobby(client);
        break;

      default:
        break;
    }
  }

  private generateRoomCode(): string {
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += letters[Math.floor(Math.random() * letters.length)];
    }
    return code;
  }

  private createRoom(
    client: ConnectedClient,
    playerCust: FighterCustomization,
    mode: GameMode = 'duel',
    mapId: string = 'park',
    fillWithBots: boolean = false,
    maxPlayers: number = 2,
    botCount: number = 0,
    roomName?: string,
    matchDuration: number = 300,
    duelRoundsTotal: number = 5,
    botDifficulty: any = 3
  ) {
    if (client.roomId) {
      this.leaveRoom(client);
    }

    const roomId = this.generateRoomCode();
    const arena = ARENAS[mapId] || ARENAS.park;
    const spawn = arena.spawnPoints[0] || { x: 400, y: 550 };

    const enforcedMaxPlayers = Math.min(10, Math.max(1, maxPlayers || (mode === 'duel' ? 2 : 4)));

    client.customization = playerCust;
    const fighter = createInitialFighter(
      client.id,
      playerCust.name,
      playerCust.gender,
      playerCust.color,
      playerCust.hat,
      spawn.x,
      spawn.y,
      false
    );

    const validDuration = [0, 300, 600, 900].includes(matchDuration) ? matchDuration : 300;
    const validDuelRounds = [1, 3, 5, 7, 10].includes(duelRoundsTotal) ? duelRoundsTotal : 5;

    const initialWeaponSpawns = (arena.weaponSpawns || []).map((sp) => ({
      id: sp.id,
      weaponType: sp.weaponType,
      x: sp.x,
      y: sp.y,
      isAvailable: true,
      respawnTimer: 0,
    }));

    const room: RoomState = {
      roomId,
      roomName: roomName || `${playerCust.name}'s Room`,
      mode: mode || (enforcedMaxPlayers === 2 ? 'duel' : 'ffa'),
      maxPlayers: enforcedMaxPlayers,
      status: 'lobby',
      hostId: client.id,
      mapId: arena.id,
      countdown: 3,
      roundTimer: validDuration > 0 ? validDuration : 999,
      matchDuration: validDuration,
      matchTimeRemaining: validDuration > 0 ? validDuration : 999,
      duelRoundsTotal: validDuelRounds,
      currentDuelRound: 1,
      duelRoundWinner: null,
      duelRoundHistory: [],
      finalLeaderboard: [],
      winnerId: null,
      players: { [client.id]: fighter },
      fillWithBots: fillWithBots ?? false,
      botCount: botCount ?? 0,
      botDifficulty: botDifficulty || 3,
      weaponSpawns: initialWeaponSpawns,
      projectiles: [],
    };

    this.rooms.set(roomId, room);
    client.roomId = roomId;

    this.send(client, { type: 'room_joined', room, yourId: client.id });
    this.broadcastRoom(room);
  }

  private quickMatch(client: ConnectedClient, playerCust: FighterCustomization, mode: GameMode) {
    let targetRoom: RoomState | null = null;
    for (const room of this.rooms.values()) {
      const playerCount = Object.keys(room.players).length;
      if (room.status === 'lobby' && room.mode === mode && playerCount < room.maxPlayers && playerCount < 10) {
        targetRoom = room;
        break;
      }
    }

    if (targetRoom) {
      this.joinRoom(client, targetRoom.roomId, playerCust);
    } else {
      this.createRoom(
        client,
        playerCust,
        mode,
        'park',
        false,
        mode === 'duel' ? 2 : 4,
        0
      );
    }
  }

  private joinRoom(
    client: ConnectedClient,
    rawRoomCode: string,
    playerCust: FighterCustomization,
    modeFallback?: GameMode,
    mapFallback?: string,
    botFillFallback?: boolean,
    botCountFallback?: number
  ) {
    if (!rawRoomCode || !rawRoomCode.trim()) {
      this.send(client, { type: 'error', message: 'Invalid Room Code' });
      return;
    }

    const cleanCode = rawRoomCode.trim().toUpperCase();

    let room: RoomState | undefined = this.rooms.get(cleanCode);
    if (!room) {
      for (const [id, r] of this.rooms.entries()) {
        if (id.toUpperCase() === cleanCode) {
          room = r;
          break;
        }
      }
    }

    if (!room) {
      this.send(client, { type: 'error', message: 'Invalid Room Code' });
      return;
    }

    if (client.roomId) {
      this.leaveRoom(client);
    }

    const currentCount = Object.keys(room.players).length;
    if (currentCount >= room.maxPlayers || currentCount >= 10) {
      this.send(client, { type: 'error', message: 'Room is full (Maximum players reached)!' });
      return;
    }

    client.customization = playerCust;
    client.roomId = room.roomId;

    const arena = ARENAS[room.mapId] || ARENAS.park;
    const spawnIdx = currentCount % arena.spawnPoints.length;
    const spawn = arena.spawnPoints[spawnIdx];

    const fighter = createInitialFighter(
      client.id,
      playerCust.name,
      playerCust.gender,
      playerCust.color,
      playerCust.hat,
      spawn.x,
      spawn.y,
      false
    );

    room.players[client.id] = fighter;

    this.send(client, { type: 'room_joined', room, yourId: client.id });
    this.broadcastRoom(room);
  }

  private leaveRoom(client: ConnectedClient) {
    if (!client.roomId) return;
    const room = this.rooms.get(client.roomId);
    const roomId = client.roomId;
    client.roomId = null;

    if (room) {
      delete room.players[client.id];
      const remainingHumanIds = Object.keys(room.players).filter((id) => !room.players[id].isBot);

      if (remainingHumanIds.length === 0) {
        this.stopRoomLoop(roomId);
        this.rooms.delete(roomId);
      } else {
        if (room.hostId === client.id) {
          room.hostId = remainingHumanIds[0];
        }
        this.broadcastRoom(room);
      }
    }
  }

  private setReady(client: ConnectedClient, isReady: boolean) {
    if (!client.roomId) return;
    const room = this.rooms.get(client.roomId);
    if (!room || !room.players[client.id]) return;

    room.players[client.id].isReady = isReady;
    this.broadcastRoom(room);
  }

  private updateCustomization(client: ConnectedClient, cust: FighterCustomization) {
    client.customization = cust;
    if (!client.roomId) return;
    const room = this.rooms.get(client.roomId);
    if (!room || !room.players[client.id]) return;

    Object.assign(room.players[client.id], cust);

    this.broadcastRoom(room);
  }

  private updateRoomSettings(client: ConnectedClient, msg: any) {
    if (!client.roomId) return;
    const room = this.rooms.get(client.roomId);
    if (!room || room.hostId !== client.id || room.status !== 'lobby') return;

    if (msg.mapId && ARENAS[msg.mapId]) {
      room.mapId = msg.mapId;
      const arena = ARENAS[msg.mapId];
      room.weaponSpawns = (arena.weaponSpawns || []).map((sp) => ({
        id: sp.id,
        weaponType: sp.weaponType,
        x: sp.x,
        y: sp.y,
        isAvailable: true,
        respawnTimer: 0,
      }));
    }
    if (typeof msg.mode === 'string' && ['duel', 'ffa'].includes(msg.mode)) {
      room.mode = msg.mode;
    }
    if (typeof msg.fillWithBots === 'boolean') room.fillWithBots = msg.fillWithBots;
    if (typeof msg.botCount === 'number') room.botCount = Math.max(0, Math.min(9, msg.botCount));
    if (typeof msg.botDifficulty === 'number' && msg.botDifficulty >= 1 && msg.botDifficulty <= 5) {
      room.botDifficulty = msg.botDifficulty;
    }
    if (typeof msg.maxPlayers === 'number') room.maxPlayers = Math.min(10, Math.max(1, msg.maxPlayers));
    
    if (typeof msg.matchDuration === 'number' && msg.matchDuration >= 0 && msg.matchDuration <= 7200) {
      room.matchDuration = Math.round(msg.matchDuration);
      room.matchTimeRemaining = room.matchDuration > 0 ? room.matchDuration : 999;
      room.roundTimer = room.matchTimeRemaining;
    }
    
    if (typeof msg.duelRoundsTotal === 'number' && msg.duelRoundsTotal >= 1 && msg.duelRoundsTotal <= 100) {
      room.duelRoundsTotal = Math.round(msg.duelRoundsTotal);
    }

    this.broadcastRoom(room);
  }

  private startGame(client: ConnectedClient) {
    if (!client.roomId) return;
    const room = this.rooms.get(client.roomId);
    if (!room || room.hostId !== client.id) return;

    const otherHumans = Object.values(room.players).filter(
      (p) => p.id !== room.hostId && !p.isBot
    );
    const allOtherReady = otherHumans.every((p) => p.isReady);
    if (otherHumans.length > 0 && !allOtherReady) {
      this.send(client, {
        type: 'error',
        message: 'All players in the room must be Ready before the match can start!',
      });
      return;
    }

    const arena = ARENAS[room.mapId] || ARENAS.park;

    // Reset Weapon Spawns & Projectiles
    room.weaponSpawns = (arena.weaponSpawns || []).map((sp) => ({
      id: sp.id,
      weaponType: sp.weaponType,
      x: sp.x,
      y: sp.y,
      isAvailable: true,
      respawnTimer: 0,
    }));
    room.projectiles = [];
    room.burningGround = [];

    // Clean out old bots
    for (const pid of Object.keys(room.players)) {
      if (room.players[pid].isBot) {
        delete room.players[pid];
      }
    }

    // Add configured bots
    let desiredBots = 0;
    if (typeof room.botCount === 'number' && room.botCount > 0) {
      desiredBots = room.botCount;
    } else if (room.fillWithBots) {
      desiredBots = Math.max(0, room.maxPlayers - Object.keys(room.players).length);
    }

    const currentHumanCount = Object.keys(room.players).length;
    desiredBots = Math.min(desiredBots, 10 - currentHumanCount);

    if (desiredBots > 0) {
      const botNames = ['NinjaBot', 'Rex', 'Blaze', 'Valkyrie', 'Shadow', 'Punchy', 'Titan', 'Viper', 'Echo'];

      for (let i = 0; i < desiredBots; i++) {
        const botId = `bot_${i + 1}`;
        const spawnIdx = (Object.keys(room.players).length) % arena.spawnPoints.length;
        const spawn = arena.spawnPoints[spawnIdx];
        const botCust = generateRandomBotCustomization(botNames[i % botNames.length]);

        room.players[botId] = createInitialFighter(
          botId,
          botCust,
          spawn.x as any,
          spawn.y as any,
          true as any
        );
      }
    }

    // Reset fighters for match start
    let idx = 0;
    for (const f of Object.values(room.players)) {
      const spawn = arena.spawnPoints[idx % arena.spawnPoints.length];
      f.x = spawn.x;
      f.y = spawn.y;
      f.vx = 0;
      f.vy = 0;
      f.hp = 100;
      f.shield = 100;
      f.isDead = false;
      f.state = 'idle';
      f.kills = 0;
      f.deaths = 0;
      f.score = 0;
      f.respawnTimer = 0;
      f.lastAttackerId = null;
      f.invincibleTimer = 1.5;
      f.facing = f.x < arena.width / 2 ? 1 : -1;
      f.weapons = {};
      f.activeWeapon = null;
      f.aimAngle = 0;
      f.weaponCooldown = 0;
      f.chargeTimer = 0;
      idx++;
    }

    const duration = typeof room.matchDuration === 'number' ? room.matchDuration : 300;
    room.matchDuration = duration;
    room.matchTimeRemaining = duration > 0 ? duration : 999;
    room.roundTimer = room.matchTimeRemaining;
    room.duelRoundsTotal = typeof room.duelRoundsTotal === 'number' ? room.duelRoundsTotal : 5;
    room.currentDuelRound = 1;
    room.duelRoundWinner = null;
    room.duelRoundHistory = [];
    room.finalLeaderboard = [];
    room.status = 'countdown';
    room.countdown = 3;
    room.winnerId = null;

    this.broadcastRoom(room);
    this.startRoomSimulation(room);
  }

  private restartMatch(client: ConnectedClient) {
    if (!client.roomId) return;
    const room = this.rooms.get(client.roomId);
    if (!room || room.hostId !== client.id) return;
    this.startGame(client);
  }

  private returnToLobby(client: ConnectedClient) {
    if (!client.roomId) return;
    const room = this.rooms.get(client.roomId);
    if (!room) return;

    this.stopRoomLoop(room.roomId);
    room.status = 'lobby';
    room.winnerId = null;

    for (const f of Object.values(room.players)) {
      f.hp = 100;
      f.shield = 100;
      f.isDead = false;
      f.state = 'idle';
      f.isReady = false;
      f.respawnTimer = 0;
      f.weapons = {};
      f.activeWeapon = null;
    }

    this.broadcastRoom(room);
  }

  private startRoomSimulation(room: RoomState) {
    this.stopRoomLoop(room.roomId);

    let lastTick = Date.now();
    let countdownTimer = 3;

    const interval = setInterval(() => {
      const now = Date.now();
      const dt = Math.min(0.05, (now - lastTick) / 1000);
      lastTick = now;

      const arena = ARENAS[room.mapId] || ARENAS.park;
      const fighters = Object.values(room.players);

      if (!room.weaponSpawns) room.weaponSpawns = [];
      if (!room.projectiles) room.projectiles = [];

      if (room.status === 'countdown') {
        countdownTimer -= dt;
        room.countdown = Math.max(0, Math.ceil(countdownTimer));

        if (countdownTimer <= 0) {
          room.status = 'in_game';
        }
      } else if (room.status === 'in_game') {
        // Synchronized Match Duration Timer
        if (room.matchDuration > 0) {
          room.matchTimeRemaining = Math.max(0, room.matchTimeRemaining - dt);
          room.roundTimer = room.matchTimeRemaining;
        } else {
          room.roundTimer = 999;
        }

        // 1. Update Weapon Spawns Respawn Timers
        for (const spawn of room.weaponSpawns) {
          if (!spawn.isAvailable) {
            spawn.respawnTimer -= dt;
            if (spawn.respawnTimer <= 0) {
              spawn.isAvailable = true;
              spawn.respawnTimer = 0;
            }
          }
        }

        // 2. Check and Collect Weapon Pickups
        const pickups = checkWeaponPickups(fighters, room.weaponSpawns);
        for (const pk of pickups) {
          this.broadcastToRoom(room.roomId, {
            type: 'weapon_pickup_event',
            playerId: pk.playerId,
            weaponType: pk.weaponType,
            x: pk.x,
            y: pk.y,
          });
        }

        // 3. Update each fighter with physics and inputs
        const extraHits: any[] = [];
        const extraExplosions: any[] = [];

        for (const f of fighters) {
          let input: PlayerInput;
          const connectedClient = !f.isBot ? this.clients.get(f.id) : undefined;
          if (f.isBot) {
            input = updateBotAI(f, fighters, arena, room.weaponSpawns, room.projectiles, room.botDifficulty || 3);
          } else {
            input = connectedClient?.input || {
              left: false,
              right: false,
              up: false,
              down: false,
              fastAttack: false,
              heavyAttack: false,
              block: false,
              fire: false,
              aimAngle: f.aimAngle,
            };
          }

          updateFighterPhysics(f, input, arena, dt);
          if (connectedClient?.input?.switchWeapon) {
            connectedClient.input.switchWeapon = undefined;
          }

          // Handle weapon firing
          if (input.fire && f.activeWeapon && f.weaponCooldown <= 0 && !f.isDead && !f.isBlocking) {
            const fired = fireFighterWeapon(f, room.projectiles, fighters, extraHits, extraExplosions);
            if (fired) {
              this.broadcastToRoom(room.roomId, {
                type: 'weapon_fire_event',
                playerId: f.id,
                weaponType: f.activeWeapon,
                x: f.x,
                y: f.y,
                aimAngle: f.aimAngle,
              });
            }
          }
        }

        // 4. Update Projectiles & Check Collisions
        const projResult = updateProjectiles(room.projectiles, fighters, arena, dt);
        room.projectiles = projResult.activeProjectiles;

        // Update Burning Ground
        if (!room.burningGround) room.burningGround = [];
        if (projResult.burningGround.length > 0) {
          room.burningGround.push(...projResult.burningGround);
        }
        for (let i = room.burningGround.length - 1; i >= 0; i--) {
          const bg = room.burningGround[i];
          bg.life -= dt;
          if (bg.life <= 0) {
            room.burningGround.splice(i, 1);
            continue;
          }
          for (const f of fighters) {
            if (!f.isDead && Math.abs(f.x - bg.x) < bg.width / 2 && Math.abs(f.y - bg.y) < 35) {
              f.burningTimer = 1.5;
            }
          }
        }

        const allExplosions = [...projResult.explosions, ...extraExplosions];
        // Broadcast explosions
        for (const exp of allExplosions) {
          this.broadcastToRoom(room.roomId, {
            type: 'explosion_event',
            x: exp.x,
            y: exp.y,
            radius: exp.radius,
            color: exp.color,
          });
        }

        // 5. Check Melee Attack Collisions
        const meleeHits = checkAttackCollisions(fighters, arena);
        const allHits = [...meleeHits, ...projResult.hits, ...extraHits];
        const pops: ComicPop[] = [];

        for (const hit of allHits) {
          const pop: ComicPop = {
            id: 'pop_' + Math.random().toString(36).substring(2, 7),
            text: hit.popText,
            x: hit.x,
            y: hit.y,
            color: hit.blocked ? '#38BDF8' : hit.isHeavy ? '#EF4444' : '#F59E0B',
            bgHex: hit.blocked ? '#FFFFFF' : '#FEF08A',
            size: hit.isHeavy ? 28 : 22,
            rotation: (Math.random() - 0.5) * 0.4,
            createdAt: now,
            duration: 700,
          };
          pops.push(pop);

          this.broadcastToRoom(room.roomId, {
            type: 'hit_event',
            attackerId: hit.attackerId,
            targetId: hit.targetId,
            damage: hit.damage,
            x: hit.x,
            y: hit.y,
            isHeavy: hit.isHeavy,
            popText: hit.popText,
          });
        }

        // 6. Exact Scoring & Death Handling
        for (const f of fighters) {
          if (!f.isDead && (f.hp <= 0 || f.y > arena.height + 80)) {
            f.isDead = true;
            f.hp = 0;
            f.state = 'dead';
            f.deaths += 1;
            f.respawnTimer = 2.0;

            if (f.lastAttackerId && room.players[f.lastAttackerId] && f.lastAttackerId !== f.id) {
              const killer = room.players[f.lastAttackerId];
              killer.kills += 1;
              killer.score = (killer.kills * 2) - killer.deaths;
            }
            f.score = (f.kills * 2) - f.deaths;
            f.lastAttackerId = null;
          }
        }

        if (room.mode === 'ffa') {
          // Timed FFA Mode Respawn
          for (const f of fighters) {
            if (f.isDead) {
              f.respawnTimer = Math.max(0, f.respawnTimer - dt);
              if (f.respawnTimer <= 0 && room.status === 'in_game') {
                const livingFighters = fighters.filter((other) => other.id !== f.id && !other.isDead);
                let bestSpawn = arena.spawnPoints[0];
                let maxMinDist = -1;

                for (const sp of arena.spawnPoints) {
                  let minDist = Infinity;
                  for (const other of livingFighters) {
                    const d = Math.hypot(other.x - sp.x, other.y - sp.y);
                    if (d < minDist) minDist = d;
                  }
                  if (minDist > maxMinDist) {
                    maxMinDist = minDist;
                    bestSpawn = sp;
                  }
                }

                f.x = bestSpawn.x;
                f.y = bestSpawn.y;
                f.vx = 0;
                f.vy = 0;
                f.hp = 100;
                f.shield = 100;
                f.isDead = false;
                f.state = 'idle';
                f.invincibleTimer = 1.5;
                f.burningTimer = 0;
                f.facing = f.x < arena.width / 2 ? 1 : -1;
                f.weapons = {};
                f.activeWeapon = null;
                f.weaponCooldown = 0;
              }
            }
          }

          if (room.matchDuration > 0 && room.matchTimeRemaining <= 0) {
            room.status = 'round_end';
            const sorted = Object.values(room.players).sort(
              (a, b) => (b.score || 0) - (a.score || 0) || (b.kills || 0) - (a.kills || 0) || (a.deaths || 0) - (b.deaths || 0)
            );
            room.winnerId = sorted[0]?.id || null;
            room.finalLeaderboard = sorted.map((p, idx) => ({
              id: p.id,
              name: p.name,
              color: p.color,
              kills: p.kills || 0,
              deaths: p.deaths || 0,
              score: p.score || 0,
              rank: idx + 1,
            }));

            this.broadcastToRoom(room.roomId, {
              type: 'game_over',
              winnerId: room.winnerId || 'nobody',
              winnerName: sorted[0]?.name || 'Draw',
              room,
            });
          }
        } else {
          // Duel Mode
          const livingFighters = fighters.filter((f) => !f.isDead);
          const roundEnded = (fighters.length >= 2 && livingFighters.length <= 1) || (room.matchDuration > 0 && room.matchTimeRemaining <= 0);

          if (roundEnded) {
            const roundWinner = livingFighters[0] || fighters.slice().sort((a, b) => b.hp - a.hp)[0] || null;
            room.duelRoundWinner = roundWinner?.id || null;

            const scoresMap: Record<string, number> = {};
            for (const f of fighters) {
              scoresMap[f.id] = f.score;
            }

            room.duelRoundHistory.push({
              round: room.currentDuelRound,
              winnerId: roundWinner?.id || null,
              winnerName: roundWinner?.name || 'Draw',
              scores: scoresMap,
            });

            if (room.currentDuelRound < room.duelRoundsTotal) {
              room.currentDuelRound += 1;
              room.status = 'countdown';
              countdownTimer = 3;
              room.countdown = 3;

              room.projectiles = [];
              room.weaponSpawns = (arena.weaponSpawns || []).map((sp) => ({
                id: sp.id,
                weaponType: sp.weaponType,
                x: sp.x,
                y: sp.y,
                isAvailable: true,
                respawnTimer: 0,
              }));

              let spIdx = 0;
              for (const f of fighters) {
                const spawn = arena.spawnPoints[spIdx % arena.spawnPoints.length];
                f.x = spawn.x;
                f.y = spawn.y;
                f.vx = 0;
                f.vy = 0;
                f.hp = 100;
                f.shield = 100;
                f.isDead = false;
                f.state = 'idle';
                f.invincibleTimer = 1.5;
                f.facing = f.x < arena.width / 2 ? 1 : -1;
                f.weapons = {};
                f.activeWeapon = null;
                f.weaponCooldown = 0;
                spIdx++;
              }
            } else {
              room.status = 'round_end';
              const sorted = Object.values(room.players).sort(
                (a, b) => (b.score || 0) - (a.score || 0) || (b.kills || 0) - (a.kills || 0) || (a.deaths || 0) - (b.deaths || 0)
              );
              room.winnerId = sorted[0]?.id || null;
              room.finalLeaderboard = sorted.map((p, idx) => ({
                id: p.id,
                name: p.name,
                color: p.color,
                kills: p.kills || 0,
                deaths: p.deaths || 0,
                score: p.score || 0,
                rank: idx + 1,
              }));

              this.broadcastToRoom(room.roomId, {
                type: 'game_over',
                winnerId: room.winnerId || 'nobody',
                winnerName: sorted[0]?.name || 'Draw',
                room,
              });
            }
          }
        }
      }

      // Broadcast game tick at ~45hz
      this.broadcastToRoom(room.roomId, {
        type: 'game_tick',
        room,
      });
    }, 1000 / 45);

    this.roomLoops.set(room.roomId, interval);
  }

  private stopRoomLoop(roomId: string) {
    const loop = this.roomLoops.get(roomId);
    if (loop) {
      clearInterval(loop);
      this.roomLoops.delete(roomId);
    }
  }

  private handleChat(client: ConnectedClient, message: string) {
    if (!client.roomId || !message.trim()) return;
    const cleanMsg = message.trim().slice(0, 100);

    this.broadcastToRoom(client.roomId, {
      type: 'chat_broadcast',
      senderId: client.id,
      senderName: client.customization.name,
      message: cleanMsg,
      color: client.customization.color,
    });
  }

  private send(client: ConnectedClient, msg: ServerMessage) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(msg));
    }
  }

  private broadcastRoom(room: RoomState) {
    this.broadcastToRoom(room.roomId, { type: 'room_state', room });
  }

  private broadcastToRoom(roomId: string, msg: ServerMessage) {
    const payload = JSON.stringify(msg);
    for (const client of this.clients.values()) {
      if (client.roomId === roomId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(payload);
      }
    }
  }

  private cleanupDeadRooms() {
    for (const [roomId, room] of this.rooms.entries()) {
      const activePlayers = Object.keys(room.players).filter((id) => this.clients.has(id));
      if (activePlayers.length === 0) {
        this.stopRoomLoop(roomId);
        this.rooms.delete(roomId);
      }
    }
  }
}
