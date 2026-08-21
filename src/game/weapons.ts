export type WeaponType =
  | 'pebble_blaster'
  | 'pistol'
  | 'burst_smg'
  | 'shotgun'
  | 'rifle'
  | 'flame_gun'
  | 'grenade_launcher'
  | 'heavy_cannon'
  | 'rocket_launcher'
  | 'railgun';

export interface WeaponConfig {
  id: WeaponType;
  name: string;
  category: 'light' | 'medium' | 'heavy' | 'special';
  tier: number; // 1 to 10
  damage: number; // Base direct hit damage
  pellets?: number; // For shotgun
  burstCount?: number; // For burst SMG
  burstDelay?: number; // Delay between burst shots (s)
  fireRate: number; // Cooldown between shots in seconds
  chargeTime?: number; // For railgun charge-up in seconds
  projectileSpeed: number; // Pixels per second / tick velocity
  projectileLife: number; // Max lifetime in seconds
  range: number; // Effective travel distance (pixels)
  ammoCapacity: number; // Default ammo per pickup = 10
  recoil: number; // Impulse applied backwards to shooter
  knockback: number; // Impulse applied to target
  respawnTime: number; // Seconds to respawn on map
  explosionRadius?: number; // For grenade / rocket
  hasGravity?: boolean; // For grenades
  isFlame?: boolean; // For flame gun continuous flow
  isBeam?: boolean; // For railgun instantaneous line
  color: string;
  bulletColor: string;
  icon: string; // Emoji or short symbol
  description: string;
}

/**
 * Central Configuration for all 10 Weapons in Stick Fighters.
 * Easy to rebalance damage, cooldowns, ammo, recoil, and respawn timers.
 */
export const WEAPONS_CONFIG: Record<WeaponType, WeaponConfig> = {
  // 1. Pebble Blaster (Tier 1 - Weakest, fast & light)
  pebble_blaster: {
    id: 'pebble_blaster',
    name: 'Pebble Blaster',
    category: 'light',
    tier: 1,
    damage: 7,
    fireRate: 0.16,
    projectileSpeed: 20,
    projectileLife: 0.85,
    range: 520,
    ammoCapacity: 10,
    recoil: 1.2,
    knockback: 3.5,
    respawnTime: 5,
    color: '#9CA3AF',
    bulletColor: '#6B7280',
    icon: '🪨',
    description: 'Fires high-speed little pebble stones. Low damage but rapid-fire.',
  },

  // 2. Pistol (Tier 2 - Standard reliable sidearm)
  pistol: {
    id: 'pistol',
    name: 'Pistol',
    category: 'light',
    tier: 2,
    damage: 16,
    fireRate: 0.32,
    projectileSpeed: 25,
    projectileLife: 1.1,
    range: 720,
    ammoCapacity: 10,
    recoil: 2.2,
    knockback: 6.0,
    respawnTime: 7,
    color: '#475569',
    bulletColor: '#F59E0B',
    icon: '🔫',
    description: 'Crisp semi-automatic sidearm. Accurate with dependable medium range.',
  },

  // 3. Burst SMG (Tier 3 - 3-round burst close combat)
  burst_smg: {
    id: 'burst_smg',
    name: 'Burst SMG',
    category: 'light',
    tier: 3,
    damage: 10,
    burstCount: 3,
    burstDelay: 0.07,
    fireRate: 0.44,
    projectileSpeed: 23,
    projectileLife: 0.9,
    range: 580,
    ammoCapacity: 10,
    recoil: 3.2,
    knockback: 4.5,
    respawnTime: 8,
    color: '#0284C7',
    bulletColor: '#38BDF8',
    icon: '⚡',
    description: 'Fires rapid 3-round bursts in quick succession.',
  },

  // 4. Shotgun (Tier 4 - Multi-pellet devastating close-range blast)
  shotgun: {
    id: 'shotgun',
    name: 'Shotgun',
    category: 'medium',
    tier: 4,
    damage: 8, // per pellet
    pellets: 5, // 5 x 8 = 40 max point-blank
    fireRate: 0.72,
    projectileSpeed: 22,
    projectileLife: 0.65,
    range: 420,
    ammoCapacity: 10,
    recoil: 7.5,
    knockback: 11.0,
    respawnTime: 12,
    color: '#B45309',
    bulletColor: '#F97316',
    icon: '💥',
    description: 'Wide 5-pellet buckshot spread. Extremely lethal in close quarters.',
  },

  // 5. Rifle (Tier 5 - High velocity long-range marksman rifle)
  rifle: {
    id: 'rifle',
    name: 'Rifle',
    category: 'medium',
    tier: 5,
    damage: 32,
    fireRate: 0.52,
    projectileSpeed: 34,
    projectileLife: 1.5,
    range: 1200,
    ammoCapacity: 10,
    recoil: 4.8,
    knockback: 9.0,
    respawnTime: 15,
    color: '#15803D',
    bulletColor: '#84CC16',
    icon: '🎯',
    description: 'High-velocity precision rifle built for medium and long-distance marksmen.',
  },

  // 6. Flame Gun (Tier 6 - Continuous fiery stream & area denial)
  flame_gun: {
    id: 'flame_gun',
    name: 'Flame Gun',
    category: 'medium',
    tier: 6,
    damage: 5, // per tick
    isFlame: true,
    fireRate: 0.08,
    projectileSpeed: 14,
    projectileLife: 0.55,
    range: 360,
    ammoCapacity: 10,
    recoil: 1.0,
    knockback: 2.0,
    respawnTime: 18,
    color: '#EA580C',
    bulletColor: '#EF4444',
    icon: '🔥',
    description: 'Sprays continuous licking flames that roast enemies in a short cone.',
  },

  // 7. Grenade Launcher (Tier 7 - Arcing bouncing explosive grenade)
  grenade_launcher: {
    id: 'grenade_launcher',
    name: 'Grenade Launcher',
    category: 'heavy',
    tier: 7,
    damage: 48,
    hasGravity: true,
    explosionRadius: 85,
    fireRate: 0.85,
    projectileSpeed: 16,
    projectileLife: 1.6,
    range: 650,
    ammoCapacity: 10,
    recoil: 6.0,
    knockback: 14.0,
    respawnTime: 22,
    color: '#4D7C0F',
    bulletColor: '#65A30D',
    icon: '💣',
    description: 'Launches bouncing explosive canisters that detonate on impact or timer.',
  },

  // 8. Heavy Cannon (Tier 8 - Massive slow iron cannonball with heavy knockback)
  heavy_cannon: {
    id: 'heavy_cannon',
    name: 'Heavy Cannon',
    category: 'heavy',
    tier: 8,
    damage: 58,
    fireRate: 1.15,
    projectileSpeed: 13,
    projectileLife: 1.4,
    range: 800,
    ammoCapacity: 10,
    recoil: 9.5,
    knockback: 20.0,
    respawnTime: 25,
    color: '#334155',
    bulletColor: '#0F172A',
    icon: '⚙️',
    description: 'Shoots a gigantic crushing solid iron ball that hurls opponents across the arena.',
  },

  // 9. Rocket Launcher (Tier 9 - Fast rocket with smoke trail and giant explosion)
  rocket_launcher: {
    id: 'rocket_launcher',
    name: 'Rocket Launcher',
    category: 'heavy',
    tier: 9,
    damage: 68,
    explosionRadius: 115,
    fireRate: 1.3,
    projectileSpeed: 21,
    projectileLife: 1.8,
    range: 1300,
    ammoCapacity: 10,
    recoil: 9.0,
    knockback: 18.0,
    respawnTime: 30,
    color: '#DC2626',
    bulletColor: '#F43F5E',
    icon: '🚀',
    description: 'High-speed propelled warhead creating massive fiery shockwaves.',
  },

  // 10. Railgun (Tier 10 - Charged hyper-beam sniper of doom)
  railgun: {
    id: 'railgun',
    name: 'Railgun',
    category: 'special',
    tier: 10,
    damage: 88,
    isBeam: true,
    chargeTime: 0.5,
    fireRate: 1.6,
    projectileSpeed: 55,
    projectileLife: 0.35,
    range: 1800,
    ammoCapacity: 10,
    recoil: 12.0,
    knockback: 22.0,
    respawnTime: 45,
    color: '#7C3AED',
    bulletColor: '#A855F7',
    icon: '🔮',
    description: 'High-voltage accelerator beam. Requires charging but instantly annihilates on hit.',
  },
};

export const ORDERED_WEAPON_KEYS: WeaponType[] = [
  'pebble_blaster',
  'pistol',
  'burst_smg',
  'shotgun',
  'rifle',
  'flame_gun',
  'grenade_launcher',
  'heavy_cannon',
  'rocket_launcher',
  'railgun',
];
