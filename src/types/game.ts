import { WeaponType } from '../game/weapons';

export type Gender = 'male' | 'female';

export type HatType = 
  | 'none'
  | 'headband'
  | 'cowboy'
  | 'cap'
  | 'crown'
  | 'ninja'
  | 'ribbon'
  | 'horns'
  | 'boxing';

export type FighterActionState =
  | 'idle'
  | 'run'
  | 'jump'
  | 'fall'
  | 'fast_attack'
  | 'heavy_attack'
  | 'block'
  | 'hit'
  | 'knocked'
  | 'dead'
  | 'victory';

export interface PlayerInput {
  left: boolean;
  right: boolean;
  up: boolean; // Jump
  down: boolean; // Drop through platforms
  fastAttack: boolean;
  heavyAttack: boolean;
  block: boolean;
  // Weapon & Aim Controls
  fire?: boolean;
  aimAngle?: number; // radians
  switchWeapon?: 'next' | 'prev' | WeaponType;
}

export interface FighterCustomization {
  name: string;
  gender: Gender;
  color: string;
  hat: HatType;
}

export interface FighterState {
  id: string;
  name: string;
  gender: Gender;
  color: string;
  hat: HatType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1; // 1 = right, -1 = left
  hp: number;
  maxHp: number;
  shield: number; // 0 to 100
  isGrounded: boolean;
  isBlocking: boolean;
  canDoubleJump: boolean;
  state: FighterActionState;
  stateTimer: number; // in seconds or frames
  attackCooldown: number;
  comboStep: number;
  invincibleTimer: number;
  hitStunTimer: number;
  isDead: boolean;
  isReady: boolean;
  isBot: boolean;
  kills: number;
  deaths: number;
  score: number; // (kills * 2) - (deaths * 1)
  respawnTimer: number; // countdown in seconds when dead
  lastAttackerId: string | null;
  ping?: number;
  // Weapon & Inventory State
  weapons: Record<string, number>; // weaponType -> current ammo (max 10)
  activeWeapon: WeaponType | null; // null = unarmed
  aimAngle: number; // in radians
  weaponCooldown: number; // fire cooldown timer
  chargeTimer: number; // for railgun charge up
}

export interface Platform {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  isPassableDown?: boolean; // Can drop through by pressing down + jump
  type?: 'ground' | 'wood' | 'stone' | 'cloud' | 'bounce';
}

export interface WeaponSpawnPoint {
  id: string;
  weaponType: WeaponType;
  x: number;
  y: number;
  respawnTime: number;
}

export interface ActiveWeaponSpawn {
  id: string;
  weaponType: WeaponType;
  x: number;
  y: number;
  isAvailable: boolean;
  respawnTimer: number;
}

export interface ProjectileState {
  id: string;
  shooterId: string;
  weaponType: WeaponType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  damage: number;
  knockback: number;
  hasGravity?: boolean;
  explosionRadius?: number;
  isFlame?: boolean;
  isBeam?: boolean;
  color: string;
  createdAt: number;
}

export type ArenaTheme = 'park' | 'town' | 'island' | 'castle' | 'dojo' | 'volcano' | 'cyber' | 'forest' | 'ruins' | 'canyon' | 'metropolis' | 'mystery_sky' | 'mystery_depths' | 'mystery_void';
export type MapSize = 'small' | 'medium' | 'large' | 'xlarge' | 'mystery';

export interface Arena {
  id: string;
  name: string;
  description: string;
  theme: ArenaTheme;
  size: MapSize;
  width: number;
  height: number;
  spawnPoints: { x: number; y: number }[];
  weaponSpawns: WeaponSpawnPoint[];
  platforms: Platform[];
  bgColor: string;
  features?: string[];
}

export interface ComicPop {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  bgHex: string;
  size: number;
  rotation: number;
  createdAt: number;
  duration: number; // ms
}

export interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  shape: 'circle' | 'star' | 'dust' | 'line' | 'spark';
  rotation?: number;
}

export type GameMode = 'duel' | 'ffa';
export type RoomStatus = 'lobby' | 'countdown' | 'in_game' | 'round_end';

export interface DuelRoundRecord {
  round: number;
  winnerId: string | null;
  winnerName: string;
  scores: Record<string, number>; // playerId -> score in this round
}

export interface FinalLeaderboardEntry {
  id: string;
  name: string;
  color: string;
  kills: number;
  deaths: number;
  score: number;
  rank: number;
}

export type BotDifficultyLevel = 1 | 2 | 3 | 4 | 5;

export interface RoomState {
  roomId: string;
  roomName: string;
  mode: GameMode;
  maxPlayers: number; // 1 to 10
  status: RoomStatus;
  hostId: string;
  mapId: string;
  countdown: number;
  roundTimer: number;
  matchDuration: number; // in seconds: 300 (5m), 600 (10m), 900 (15m), 0 (unlimited)
  matchTimeRemaining: number; // in seconds
  duelRoundsTotal: number; // 1, 3, 5, 7, 10
  currentDuelRound: number; // 1 to duelRoundsTotal
  duelRoundWinner: string | null;
  duelRoundHistory: DuelRoundRecord[];
  finalLeaderboard: FinalLeaderboardEntry[];
  winnerId: string | null;
  players: Record<string, FighterState>;
  fillWithBots: boolean;
  botCount: number; // Optional exact bot count configured by user (default 0)
  botDifficulty?: BotDifficultyLevel; // 1 (Very Easy) to 5 (Master)
  weaponSpawns?: ActiveWeaponSpawn[];
  projectiles?: ProjectileState[];
}

// Client to Server Messages
export type ClientMessage =
  | { type: 'join_room'; roomId: string; player: FighterCustomization; mode?: GameMode; mapId?: string; fillWithBots?: boolean; botCount?: number; botDifficulty?: BotDifficultyLevel; matchDuration?: number; duelRoundsTotal?: number }
  | { type: 'quick_match'; player: FighterCustomization; mode: GameMode }
  | { type: 'create_room'; player: FighterCustomization; mode: GameMode; mapId: string; fillWithBots: boolean; maxPlayers: number; botCount?: number; botDifficulty?: BotDifficultyLevel; roomName?: string; matchDuration?: number; duelRoundsTotal?: number }
  | { type: 'leave_room' }
  | { type: 'set_ready'; isReady: boolean }
  | { type: 'update_customization'; customization: FighterCustomization }
  | { type: 'update_room_settings'; mapId?: string; mode?: GameMode; fillWithBots?: boolean; botCount?: number; botDifficulty?: BotDifficultyLevel; maxPlayers?: number; matchDuration?: number; duelRoundsTotal?: number }
  | { type: 'start_game' }
  | { type: 'input'; input: PlayerInput }
  | { type: 'chat'; message: string }
  | { type: 'ping'; timestamp: number }
  | { type: 'restart_match' }
  | { type: 'return_to_lobby' };

// Server to Client Messages
export type ServerMessage =
  | { type: 'room_joined'; room: RoomState; yourId: string }
  | { type: 'room_state'; room: RoomState }
  | { type: 'game_started'; room: RoomState }
  | { type: 'game_tick'; room: RoomState; comicPops?: ComicPop[]; hits?: { x: number; y: number; heavy: boolean }[] }
  | { type: 'hit_event'; attackerId: string; targetId: string; damage: number; x: number; y: number; isHeavy: boolean; popText: string }
  | { type: 'weapon_pickup_event'; playerId: string; weaponType: WeaponType; x: number; y: number }
  | { type: 'weapon_fire_event'; playerId: string; weaponType: WeaponType; x: number; y: number; aimAngle: number }
  | { type: 'explosion_event'; x: number; y: number; radius: number; color: string }
  | { type: 'game_over'; winnerId: string; winnerName: string; room: RoomState }
  | { type: 'chat_broadcast'; senderId: string; senderName: string; message: string; color: string }
  | { type: 'pong'; timestamp: number; serverTime: number }
  | { type: 'error'; message: string };
