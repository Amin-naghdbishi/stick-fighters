import { ARENAS } from './arenas';
import {
  checkAttackCollisions,
  checkWeaponPickups,
  createInitialFighter,
  fireFighterWeapon,
  updateBotAI,
  updateFighterPhysics,
  updateProjectiles,
} from './physics';
import {
  ActiveWeaponSpawn,
  BotDifficultyLevel,
  ComicPop,
  FighterCustomization,
  FighterState,
  GameMode,
  PlayerInput,
  ProjectileState,
  RoomState,
} from '../types/game';
import { WEAPONS_CONFIG } from './weapons';

import { generateRandomBotCustomization } from './customizationCatalog';

export class LocalGameEngine {
  public room: RoomState;
  public comicPops: ComicPop[] = [];
  public hits: { x: number; y: number; isHeavy: boolean; damage: number; targetId: string; attackerId: string; popText: string }[] = [];
  private lastTime: number = Date.now();
  private countdownTimer: number = 3;

  constructor(
    playerCust: FighterCustomization,
    mode: GameMode = 'duel',
    mapId: string = 'park',
    botCount: number = 1,
    botDifficulty: BotDifficultyLevel = 3
  ) {
    const arena = ARENAS[mapId] || ARENAS.park;
    const p1Spawn = arena.spawnPoints[0];

    const p1 = createInitialFighter(
      'local_player',
      playerCust,
      p1Spawn.x as any,
      p1Spawn.y as any,
      false as any
    );

    const players: Record<string, FighterState> = {
      local_player: p1,
    };

    const botNames = ['Rival Tintin', 'Captain Boxer', 'Ninja Snowy', 'Speedy Spike', 'Brawler Betty', 'Titan', 'Viper', 'Echo', 'Blaze'];

    const count = Math.max(0, Math.min(9, botCount));
    for (let i = 0; i < count; i++) {
      const bId = `bot_${i + 1}`;
      const spawn = arena.spawnPoints[(i + 1) % arena.spawnPoints.length];
      const botCust = generateRandomBotCustomization(botNames[i % botNames.length]);
      players[bId] = createInitialFighter(
        bId,
        botCust,
        spawn.x as any,
        spawn.y as any,
        true as any
      );
    }

    const isPreview = count === 0;
    const defaultDuration = isPreview ? 0 : 300; // 5 mins default

    const initialWeaponSpawns: ActiveWeaponSpawn[] = (arena.weaponSpawns || []).map((sp) => ({
      id: sp.id,
      weaponType: sp.weaponType,
      x: sp.x,
      y: sp.y,
      isAvailable: true,
      respawnTimer: 0,
    }));

    this.room = {
      roomId: 'local_practice',
      roomName: isPreview ? 'Map Solo Exploration' : 'Practice Ring',
      mode,
      maxPlayers: Math.max(2, count + 1),
      status: isPreview ? 'in_game' : 'countdown', // If solo map preview, start immediately without countdown
      hostId: 'local_player',
      mapId,
      countdown: isPreview ? 0 : 3,
      roundTimer: defaultDuration > 0 ? defaultDuration : 999,
      matchDuration: defaultDuration,
      matchTimeRemaining: defaultDuration > 0 ? defaultDuration : 999,
      duelRoundsTotal: 5,
      currentDuelRound: 1,
      duelRoundWinner: null,
      duelRoundHistory: [],
      finalLeaderboard: [],
      winnerId: null,
      players,
      fillWithBots: count > 0,
      botCount: count,
      botDifficulty,
      weaponSpawns: initialWeaponSpawns,
      projectiles: [],
      burningGround: [],
    };
    if (isPreview) {
      this.countdownTimer = 0;
    }
  }

  public tick(playerInput: PlayerInput): { room: RoomState; hits: any[]; pops: ComicPop[] } {
    const now = Date.now();
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;

    const arena = ARENAS[this.room.mapId] || ARENAS.park;
    const fighters = Object.values(this.room.players);
    const newHits: any[] = [];

    // Ensure weaponSpawns and projectiles array exist
    if (!this.room.weaponSpawns) {
      this.room.weaponSpawns = (arena.weaponSpawns || []).map((sp) => ({
        id: sp.id,
        weaponType: sp.weaponType,
        x: sp.x,
        y: sp.y,
        isAvailable: true,
        respawnTimer: 0,
      }));
    }
    if (!this.room.projectiles) {
      this.room.projectiles = [];
    }

    if (this.room.status === 'countdown') {
      this.countdownTimer -= dt;
      this.room.countdown = Math.max(0, Math.ceil(this.countdownTimer));
      if (this.countdownTimer <= 0) {
        this.room.status = 'in_game';
      }
    } else if (this.room.status === 'in_game') {
      if (this.room.matchDuration > 0) {
        this.room.matchTimeRemaining = Math.max(0, this.room.matchTimeRemaining - dt);
        this.room.roundTimer = this.room.matchTimeRemaining;
      } else {
        this.room.roundTimer = 999;
      }

      // Update Weapon Spawns Respawn Timers
      for (const sp of this.room.weaponSpawns) {
        if (!sp.isAvailable) {
          sp.respawnTimer = Math.max(0, sp.respawnTimer - dt);
          if (sp.respawnTimer <= 0) {
            sp.isAvailable = true;
          }
        }
      }

      // Check Weapon Pickups
      const pickups = checkWeaponPickups(fighters, this.room.weaponSpawns);
      for (const pk of pickups) {
        const weaponCfg = WEAPONS_CONFIG[pk.weaponType];
        this.comicPops.push({
          id: 'pop_pickup_' + Math.random().toString(36).substring(2, 7),
          text: weaponCfg ? `GET ${weaponCfg.name.toUpperCase()}!` : 'WEAPON!',
          x: pk.x,
          y: pk.y - 30,
          color: '#10B981',
          bgHex: '#ECFDF5',
          size: 20,
          rotation: (Math.random() - 0.5) * 0.3,
          createdAt: now,
          duration: 800,
        });
      }

      // Update Player & Bots
      const extraHits: any[] = [];
      const extraExplosions: any[] = [];

      for (const f of fighters) {
        let input: PlayerInput;
        if (f.isBot) {
          input = updateBotAI(f, fighters, arena, this.room.weaponSpawns, this.room.projectiles, this.room.botDifficulty || 3);
        } else {
          input = playerInput;
        }
        updateFighterPhysics(f, input, arena, dt);

        // Firing weapon
        if (input.fire && f.activeWeapon && f.weaponCooldown <= 0 && !f.isDead && !f.isBlocking) {
          fireFighterWeapon(f, this.room.projectiles, fighters, extraHits, extraExplosions);
        }
      }

      if (playerInput.switchWeapon) {
        playerInput.switchWeapon = undefined;
      }

      // Update Projectiles & collisions
      const projResult = updateProjectiles(this.room.projectiles, fighters, arena, dt);
      this.room.projectiles = projResult.activeProjectiles;

      // Update Burning Ground
      if (!this.room.burningGround) this.room.burningGround = [];
      if (projResult.burningGround.length > 0) {
        this.room.burningGround.push(...projResult.burningGround);
      }
      for (let i = this.room.burningGround.length - 1; i >= 0; i--) {
        const bg = this.room.burningGround[i];
        bg.life -= dt;
        if (bg.life <= 0) {
          this.room.burningGround.splice(i, 1);
          continue;
        }
        for (const f of fighters) {
          if (!f.isDead && Math.abs(f.x - bg.x) < bg.width / 2 && Math.abs(f.y - bg.y) < 35) {
            f.burningTimer = 1.5;
          }
        }
      }

      const allHitsCombined = [...projResult.hits, ...extraHits];

      // Hits
      for (const hit of allHitsCombined) {
        const pop: ComicPop = {
          id: 'pop_' + Math.random().toString(36).substring(2, 7),
          text: hit.popText,
          x: hit.x,
          y: hit.y,
          color: hit.blocked ? '#38BDF8' : hit.isHeavy ? '#EF4444' : '#F59E0B',
          bgHex: hit.blocked ? '#FFFFFF' : '#FEF08A',
          size: hit.isHeavy ? 30 : 22,
          rotation: (Math.random() - 0.5) * 0.4,
          createdAt: now,
          duration: 700,
        };
        this.comicPops.push(pop);
        newHits.push(hit);
      }

      const allExplosionsCombined = [...projResult.explosions, ...extraExplosions];

      // Explosions
      for (const exp of allExplosionsCombined) {
        this.comicPops.push({
          id: 'pop_boom_' + Math.random().toString(36).substring(2, 7),
          text: 'BOOOM!',
          x: exp.x,
          y: exp.y - 20,
          color: '#DC2626',
          bgHex: '#FEF08A',
          size: 34,
          rotation: (Math.random() - 0.5) * 0.4,
          createdAt: now,
          duration: 800,
        });
      }

      // Check Unarmed Melee Hits
      const hits = checkAttackCollisions(fighters, arena);
      for (const hit of hits) {
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
        this.comicPops.push(pop);
        newHits.push(hit);
      }

      // Exact Scoring & Death Handling: Kill = +2, Death = -1
      for (const f of fighters) {
        if (!f.isDead && (f.hp <= 0 || f.y > arena.height + 80)) {
          f.isDead = true;
          f.hp = 0;
          f.state = 'dead';
          f.deaths += 1;
          f.respawnTimer = 2.0;

          if (f.lastAttackerId && this.room.players[f.lastAttackerId] && f.lastAttackerId !== f.id) {
            const killer = this.room.players[f.lastAttackerId];
            killer.kills += 1;
            killer.score = (killer.kills * 2) - killer.deaths;
          }
          f.score = (f.kills * 2) - f.deaths;
          f.lastAttackerId = null;
        }
      }

      if (this.room.mode === 'ffa' && fighters.length > 1) {
        // Respawn for Timed FFA Matches
        for (const f of fighters) {
          if (f.isDead) {
            f.respawnTimer = Math.max(0, f.respawnTimer - dt);
            if (f.respawnTimer <= 0 && this.room.status === 'in_game') {
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

        // Match Time Finished
        if (this.room.matchDuration > 0 && this.room.matchTimeRemaining <= 0) {
          this.room.status = 'round_end';
          const sorted = Object.values(this.room.players).sort(
            (a, b) => (b.score || 0) - (a.score || 0) || (b.kills || 0) - (a.kills || 0) || (a.deaths || 0) - (b.deaths || 0)
          );
          this.room.winnerId = sorted[0]?.id || null;
          this.room.finalLeaderboard = sorted.map((p, idx) => ({
            id: p.id,
            name: p.name,
            color: p.color,
            kills: p.kills || 0,
            deaths: p.deaths || 0,
            score: p.score || 0,
            rank: idx + 1,
          }));
        }
      } else if (this.room.mode === 'duel' && fighters.length >= 2) {
        // Duel mode round check
        const living = fighters.filter((f) => !f.isDead);
        const roundEnded = living.length <= 1 || (this.room.matchDuration > 0 && this.room.matchTimeRemaining <= 0);

        if (roundEnded) {
          const roundWinner = living[0] || fighters.slice().sort((a, b) => b.hp - a.hp)[0] || null;
          this.room.duelRoundWinner = roundWinner?.id || null;

          const scoresMap: Record<string, number> = {};
          for (const f of fighters) {
            scoresMap[f.id] = f.score;
          }

          this.room.duelRoundHistory.push({
            round: this.room.currentDuelRound,
            winnerId: roundWinner?.id || null,
            winnerName: roundWinner?.name || 'Draw',
            scores: scoresMap,
          });

          if (this.room.currentDuelRound < this.room.duelRoundsTotal) {
            this.room.currentDuelRound += 1;
            this.room.status = 'countdown';
            this.countdownTimer = 3;
            this.room.countdown = 3;

            this.room.projectiles = [];
            this.room.weaponSpawns = (arena.weaponSpawns || []).map((sp) => ({
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
            // Duel Complete
            this.room.status = 'round_end';
            const sorted = Object.values(this.room.players).sort(
              (a, b) => (b.score || 0) - (a.score || 0) || (b.kills || 0) - (a.kills || 0) || (a.deaths || 0) - (b.deaths || 0)
            );
            this.room.winnerId = sorted[0]?.id || null;
            this.room.finalLeaderboard = sorted.map((p, idx) => ({
              id: p.id,
              name: p.name,
              color: p.color,
              kills: p.kills || 0,
              deaths: p.deaths || 0,
              score: p.score || 0,
              rank: idx + 1,
            }));
          }
        }
      }
    }

    // Clean expired pops
    this.comicPops = this.comicPops.filter((p) => now - p.createdAt < p.duration);

    return {
      room: this.room,
      hits: newHits,
      pops: this.comicPops,
    };
  }

  public restart(playerCust: FighterCustomization) {
    const arena = ARENAS[this.room.mapId] || ARENAS.park;
    let idx = 0;
    for (const f of Object.values(this.room.players)) {
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
      if (f.id === 'local_player') {
        f.name = playerCust.name;
        f.gender = playerCust.gender;
        f.color = playerCust.color;
        f.hat = playerCust.hat;
      }
      idx++;
    }
    const isPreview = Object.keys(this.room.players).length <= 1;
    const dur = isPreview ? 0 : 300;
    this.room.status = isPreview ? 'in_game' : 'countdown';
    this.countdownTimer = isPreview ? 0 : 3;
    this.room.countdown = isPreview ? 0 : 3;
    this.room.roundTimer = dur > 0 ? dur : 999;
    this.room.matchTimeRemaining = dur > 0 ? dur : 999;
    this.room.currentDuelRound = 1;
    this.room.duelRoundWinner = null;
    this.room.duelRoundHistory = [];
    this.room.finalLeaderboard = [];
    this.room.winnerId = null;
    this.comicPops = [];
  }
}
