import { WeaponType } from '../game/weapons';

export type Gender = 'male' | 'female';

export type SkinType =
  | 'classic'
  | 'light'
  | 'tan'
  | 'dark'
  | 'shadow'
  | 'alien'
  | 'cyber'
  | 'golden'
  | 'neon'
  | 'cartoon';

export type HairType =
  | 'none'
  | 'short'
  | 'long'
  | 'spiky'
  | 'messy'
  | 'curly'
  | 'mohawk'
  | 'ponytail'
  | 'anime'
  | 'military'
  | 'wild'
  | 'large_cartoon'
  | 'afro'
  | 'dreads'
  | 'bob';

export type HeadwearType =
  | 'none'
  | 'cap'
  | 'military_helmet'
  | 'army_hat'
  | 'jungle_hat'
  | 'cowboy'
  | 'wizard'
  | 'cone'
  | 'helmet'
  | 'space_helmet'
  | 'crown'
  | 'pirate'
  | 'beanie'
  | 'samurai'
  | 'ninja_headband'
  | 'cat_ears'
  | 'rabbit_ears'
  | 'devil_horns'
  | 'angel_halo'
  | 'robot_antennas'
  | 'headband'
  | 'horns'
  | 'ribbon'
  | 'boxing'
  | 'ninja';

export type HatType = HeadwearType;

export type FaceType =
  | 'none'
  | 'sunglasses'
  | 'round_glasses'
  | 'pilot_glasses'
  | 'eye_patch'
  | 'ninja_mask'
  | 'bandit_mask'
  | 'gas_mask'
  | 'samurai_mask'
  | 'face_mask'
  | 'cute_blush'
  | 'scar';

export type OutfitType =
  | 'none'
  | 'cute_tshirt'
  | 'cute_hoodie'
  | 'cartoon'
  | 'animal'
  | 'colorful'
  | 'combat'
  | 'heavy_jacket'
  | 'tactical'
  | 'dark_warrior'
  | 'soldier'
  | 'military_jacket'
  | 'hoodie'
  | 'tshirt'
  | 'jacket'
  | 'coat'
  | 'sports'
  | 'winter'
  | 'ninja'
  | 'samurai'
  | 'pirate'
  | 'space_suit'
  | 'explorer'
  | 'royal'
  | 'wizard'
  | 'robot';

export type CapeBackType =
  | 'none'
  | 'short_cape'
  | 'long_cape'
  | 'torn_cape'
  | 'royal_cape'
  | 'ninja_cape'
  | 'superhero_cape'
  | 'small_backpack'
  | 'large_backpack'
  | 'military_backpack'
  | 'jetpack'
  | 'angel_wings'
  | 'demon_wings'
  | 'small_wings'
  | 'large_wings';

export type ShoeType =
  | 'none'
  | 'sneakers'
  | 'boots'
  | 'military_boots'
  | 'ninja_shoes'
  | 'samurai_sandals'
  | 'cartoon_shoes'
  | 'sport_shoes'
  | 'winter_boots'
  | 'casual'
  | 'cute_shoes'
  | 'futuristic';

export type AccessoryType =
  | 'none'
  | 'earrings'
  | 'piercings'
  | 'necklace'
  | 'bracelet'
  | 'watch'
  | 'chain'
  | 'tie'
  | 'scarf'
  | 'neck_band'
  | 'shoulder_pad'
  | 'badge'
  | 'flower'
  | 'ammo_belt'
  | 'pins';

export type EffectType =
  | 'none'
  | 'hearts'
  | 'stars'
  | 'electric'
  | 'smoke'
  | 'sparkles'
  | 'aura'
  | 'cute_particles'
  | 'dark_smoke'
  | 'light_glow';

export interface FighterCustomization {
  name: string;
  gender: Gender;
  color: string;
  secondaryColor?: string;
  accentColor?: string;
  skin?: SkinType;
  hair?: HairType;
  hairColor?: string;
  hat?: HeadwearType;
  hatColor?: string;
  face?: FaceType;
  outfit?: OutfitType;
  outfitColor?: string;
  cape?: CapeBackType;
  capeColor?: string;
  shoes?: ShoeType;
  shoeColor?: string;
  accessory?: AccessoryType;
  effect?: EffectType;
}

export interface FighterState extends FighterCustomization {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1; // 1 = right, -1 = left
  hp: number;
  maxHp: number;
  shield: number;
  isGrounded: boolean;
  isBlocking: boolean;
  canDoubleJump: boolean;
  state: FighterActionState;
  stateTimer: number;
  attackCooldown: number;
  comboStep: number;
  invincibleTimer: number;
  hitStunTimer: number;
  isDead: boolean;
  isReady?: boolean;
  isBot?: boolean;
  kills: number;
  deaths: number;
  score: number;
  respawnTimer: number;
  lastAttackerId: string | null;
  // Weapon & Inventory
  weapons: { [key in WeaponType]?: number }; // Map of owned weapons -> ammo count
  activeWeapon: WeaponType | null;
  aimAngle: number; // radians
  weaponCooldown: number;
  chargeTimer: number;
  superWeaponTimer?: number;
  burningTimer?: number;
}

export interface BurningGroundState {
  id: string;
  x: number;
  y: number;
  width: number;
  life: number;
  maxLife: number;
  shooterId: string;
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

export type ArenaTheme =
  | 'park'
  | 'town'
  | 'island'
  | 'castle'
  | 'dojo'
  | 'volcano'
  | 'cyber'
  | 'forest'
  | 'ruins'
  | 'canyon'
  | 'metropolis'
  | 'mystery_sky'
  | 'mystery_depths'
  | 'mystery_void'
  | 'mystery_mountain'
  | 'mystery_jungle'
  | 'mystery_volcanic'
  | 'bamboo'
  | 'arcade'
  | 'glacier'
  | 'desert'
  | 'pirate'
  | 'circus'
  | 'steampunk'
  | 'space'
  | 'temple'
  | 'atlantis'
  | 'cyber_megacity'
  | 'dragon_valley'
  | 'mystery_crystal'
  | 'mystery_celestial'
  | 'mystery_chrono';
export type MapSize = 'small' | 'medium' | 'large' | 'xlarge' | 'mystery' | 'custom';

export type DecorationType =
  | 'tree'
  | 'pine_tree'
  | 'palm_tree'
  | 'cloud'
  | 'rock'
  | 'torii_gate'
  | 'ancient_column'
  | 'crystal_cluster'
  | 'lantern_post'
  | 'gear'
  | 'balloon'
  | 'rect'
  | 'circle'
  | 'triangle'
  | 'star';

export interface CustomDecoration {
  id: string;
  type: DecorationType;
  x: number;
  y: number;
  width?: number;
  height?: number;
  scale?: number;
  rotation?: number;
  color?: string;
  color2?: string;
  color3?: string;
  layer?: 'background' | 'gameplay' | 'foreground';
  flipH?: boolean;
  flipV?: boolean;
}

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
  decorations?: CustomDecoration[];
  isCustom?: boolean;
  author?: string;
  createdAt?: number;
  updatedAt?: number;
  version?: number;
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
  burningGround?: BurningGroundState[];
  customArena?: Arena;
}

export interface TickFighterDelta {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  hp: number;
  shield: number;
  state: FighterActionState;
  isGrounded?: boolean;
  isBlocking?: boolean;
  isDead?: boolean;
  activeWeapon: WeaponType | null;
  aimAngle?: number;
  weaponCooldown?: number;
  invincibleTimer?: number;
  burningTimer?: number;
  respawnTimer?: number;
  kills?: number;
  deaths?: number;
  score?: number;
  weapons?: Record<string, number>;
}

export interface TickSnapshot {
  roomId: string;
  status: RoomStatus;
  countdown?: number;
  roundTimer: number;
  matchTimeRemaining: number;
  currentDuelRound?: number;
  fighters: TickFighterDelta[];
  projectiles?: ProjectileState[];
  burningGround?: BurningGroundState[];
  weaponSpawns?: ActiveWeaponSpawn[];
}

// Client to Server Messages
export type ClientMessage =
  | { type: 'join_room'; roomId: string; player: FighterCustomization; sessionToken?: string; reconnectId?: string; mode?: GameMode; mapId?: string; customArena?: Arena; fillWithBots?: boolean; botCount?: number; botDifficulty?: BotDifficultyLevel; matchDuration?: number; duelRoundsTotal?: number }
  | { type: 'quick_match'; player: FighterCustomization; mode: GameMode }
  | { type: 'create_room'; player: FighterCustomization; mode: GameMode; mapId: string; customArena?: Arena; fillWithBots: boolean; maxPlayers: number; botCount?: number; botDifficulty?: BotDifficultyLevel; roomName?: string; matchDuration?: number; duelRoundsTotal?: number }
  | { type: 'leave_room' }
  | { type: 'set_ready'; isReady: boolean }
  | { type: 'update_customization'; customization: FighterCustomization }
  | { type: 'update_room_settings'; mapId?: string; customArena?: Arena; mode?: GameMode; fillWithBots?: boolean; botCount?: number; botDifficulty?: BotDifficultyLevel; maxPlayers?: number; matchDuration?: number; duelRoundsTotal?: number }
  | { type: 'start_game' }
  | { type: 'input'; input: PlayerInput }
  | { type: 'chat'; message: string }
  | { type: 'ping'; timestamp: number }
  | { type: 'restart_match' }
  | { type: 'return_to_lobby' };

// Server to Client Messages
export type ServerMessage =
  | { type: 'room_joined'; room: RoomState; yourId: string; sessionToken?: string }
  | { type: 'room_state'; room: RoomState }
  | { type: 'game_started'; room: RoomState }
  | { type: 'game_tick'; tick: TickSnapshot; room?: RoomState; comicPops?: ComicPop[]; hits?: { x: number; y: number; heavy: boolean }[] }
  | { type: 'hit_event'; attackerId: string; targetId: string; damage: number; x: number; y: number; isHeavy: boolean; popText: string }
  | { type: 'weapon_pickup_event'; playerId: string; weaponType: WeaponType; x: number; y: number }
  | { type: 'weapon_fire_event'; playerId: string; weaponType: WeaponType; x: number; y: number; aimAngle: number }
  | { type: 'explosion_event'; x: number; y: number; radius: number; color: string }
  | { type: 'game_over'; winnerId: string; winnerName: string; room: RoomState }
  | { type: 'chat_broadcast'; senderId: string; senderName: string; message: string; color: string }
  | { type: 'pong'; timestamp: number; serverTime: number }
  | { type: 'error'; message: string };
