import { WeaponType, WEAPONS_CONFIG } from './weapons';
import { Arena, FighterState, PlayerInput, ProjectileState, ActiveWeaponSpawn, BotDifficultyLevel } from '../types/game';

export interface BotDifficultyConfig {
  level: BotDifficultyLevel;
  name: string;
  nameFa: string;
  badgeColor: string;
  reactionTimeMinMs: number;
  reactionTimeMaxMs: number;
  aimDispersionRad: number; // Angular error in radians
  leadTargetVelocity: boolean; // Predictively lead moving enemies
  leadPredictionFactor: number; // 0 (none) to 1.0 (full accurate lead)
  dodgeProjectileChance: number; // Chance to jump/duck when projectile incoming
  blockAttackChance: number; // Chance to raise shield when enemy attacks
  counterAttackAggression: number; // Tendency to chain combos (0.0 to 1.0)
  weaponSeekPreference: number; // Likelihood to prioritize picking up weapon vs melee
  favoredWeaponsPriority: WeaponType[]; // Weapons preferred if available
  optimalWeaponDistanceRatio: number; // How strictly it respects firing range
  jumpFrequency: number;
  dropThroughPlatformChance: number;
  weaponSwitchTactics: boolean; // Dynamically switch between owned weapons based on distance
}

export const BOT_DIFFICULTY_CONFIGS: Record<BotDifficultyLevel, BotDifficultyConfig> = {
  1: {
    level: 1,
    name: 'Very Easy',
    nameFa: 'خیلی آسان',
    badgeColor: '#10B981', // Green
    reactionTimeMinMs: 450,
    reactionTimeMaxMs: 650,
    aimDispersionRad: 0.52, // ~30 degrees error
    leadTargetVelocity: false,
    leadPredictionFactor: 0,
    dodgeProjectileChance: 0.05,
    blockAttackChance: 0.08,
    counterAttackAggression: 0.25,
    weaponSeekPreference: 0.4,
    favoredWeaponsPriority: ['pebble_blaster', 'pistol'],
    optimalWeaponDistanceRatio: 0.4,
    jumpFrequency: 0.1,
    dropThroughPlatformChance: 0.05,
    weaponSwitchTactics: false,
  },
  2: {
    level: 2,
    name: 'Easy',
    nameFa: 'آسان',
    badgeColor: '#3B82F6', // Blue
    reactionTimeMinMs: 300,
    reactionTimeMaxMs: 420,
    aimDispersionRad: 0.32, // ~18 degrees error
    leadTargetVelocity: false,
    leadPredictionFactor: 0,
    dodgeProjectileChance: 0.2,
    blockAttackChance: 0.25,
    counterAttackAggression: 0.45,
    weaponSeekPreference: 0.65,
    favoredWeaponsPriority: ['pistol', 'burst_smg', 'shotgun'],
    optimalWeaponDistanceRatio: 0.6,
    jumpFrequency: 0.2,
    dropThroughPlatformChance: 0.15,
    weaponSwitchTactics: false,
  },
  3: {
    level: 3,
    name: 'Normal',
    nameFa: 'متوسط',
    badgeColor: '#F59E0B', // Amber
    reactionTimeMinMs: 160,
    reactionTimeMaxMs: 240,
    aimDispersionRad: 0.16, // ~9 degrees error
    leadTargetVelocity: true,
    leadPredictionFactor: 0.45,
    dodgeProjectileChance: 0.5,
    blockAttackChance: 0.55,
    counterAttackAggression: 0.65,
    weaponSeekPreference: 0.85,
    favoredWeaponsPriority: ['rifle', 'burst_smg', 'shotgun', 'grenade_launcher'],
    optimalWeaponDistanceRatio: 0.8,
    jumpFrequency: 0.32,
    dropThroughPlatformChance: 0.3,
    weaponSwitchTactics: true,
  },
  4: {
    level: 4,
    name: 'Hard',
    nameFa: 'سخت',
    badgeColor: '#EF4444', // Red
    reactionTimeMinMs: 80,
    reactionTimeMaxMs: 130,
    aimDispersionRad: 0.06, // ~3.5 degrees error
    leadTargetVelocity: true,
    leadPredictionFactor: 0.8,
    dodgeProjectileChance: 0.75,
    blockAttackChance: 0.8,
    counterAttackAggression: 0.85,
    weaponSeekPreference: 0.95,
    favoredWeaponsPriority: ['railgun', 'heavy_cannon', 'rocket_launcher', 'rifle', 'shotgun'],
    optimalWeaponDistanceRatio: 0.95,
    jumpFrequency: 0.45,
    dropThroughPlatformChance: 0.45,
    weaponSwitchTactics: true,
  },
  5: {
    level: 5,
    name: 'Master (Very Hard)',
    nameFa: 'استاد (خیلی سخت)',
    badgeColor: '#8B5CF6', // Purple
    reactionTimeMinMs: 25,
    reactionTimeMaxMs: 50,
    aimDispersionRad: 0.015, // ~0.8 degrees (sharp and humanly precise)
    leadTargetVelocity: true,
    leadPredictionFactor: 1.0, // Accurately leads shots based on projectile speed
    dodgeProjectileChance: 0.9,
    blockAttackChance: 0.9,
    counterAttackAggression: 0.95,
    weaponSeekPreference: 1.0,
    favoredWeaponsPriority: ['railgun', 'heavy_cannon', 'rocket_launcher', 'flame_gun', 'rifle', 'shotgun'],
    optimalWeaponDistanceRatio: 1.0,
    jumpFrequency: 0.55,
    dropThroughPlatformChance: 0.55,
    weaponSwitchTactics: true,
  },
};

const FIGHTER_HEIGHT = 65;
const FIGHTER_WIDTH = 26;

/**
 * Intelligent Bot AI Decision Maker with 5 difficulty levels.
 * NO CHEATS: All bots adhere strictly to standard ammo, cooldowns, jump counts, and physics limits.
 */
export function computeBotAction(
  bot: FighterState,
  fighters: FighterState[],
  arena: Arena,
  weaponSpawns: ActiveWeaponSpawn[] = [],
  projectiles: ProjectileState[] = [],
  difficultyLevel: BotDifficultyLevel = 3
): PlayerInput {
  const config = BOT_DIFFICULTY_CONFIGS[difficultyLevel] || BOT_DIFFICULTY_CONFIGS[3];

  const input: PlayerInput = {
    left: false,
    right: false,
    up: false,
    down: false,
    fastAttack: false,
    heavyAttack: false,
    block: false,
    fire: false,
    aimAngle: bot.aimAngle || 0,
  };

  if (bot.isDead) return input;

  const hasWeapon = bot.activeWeapon && (bot.weapons[bot.activeWeapon] || 0) > 0;
  const currentWeaponConfig = bot.activeWeapon ? WEAPONS_CONFIG[bot.activeWeapon] : null;

  // 1. Find Closest Living Target
  let closestEnemy: FighterState | null = null;
  let minDist = Infinity;
  for (const f of fighters) {
    if (f.id === bot.id || f.isDead) continue;
    const dist = Math.hypot(f.x - bot.x, f.y - bot.y);
    if (dist < minDist) {
      minDist = dist;
      closestEnemy = f;
    }
  }

  // 2. Intelligent Weapon Switching for Higher Levels (Level 3+)
  if (config.weaponSwitchTactics && closestEnemy) {
    const ownedWeapons = (Object.keys(bot.weapons) as WeaponType[]).filter(
      (w) => (bot.weapons[w] || 0) > 0
    );

    if (ownedWeapons.length > 1) {
      // Pick best weapon based on distance
      let bestWpn: WeaponType = ownedWeapons[0];
      if (minDist < 120 && ownedWeapons.includes('shotgun')) {
        bestWpn = 'shotgun';
      } else if (minDist < 160 && ownedWeapons.includes('flame_gun')) {
        bestWpn = 'flame_gun';
      } else if (minDist > 320 && ownedWeapons.includes('railgun')) {
        bestWpn = 'railgun';
      } else if (minDist > 250 && ownedWeapons.includes('rifle')) {
        bestWpn = 'rifle';
      } else if (minDist > 200 && ownedWeapons.includes('rocket_launcher')) {
        bestWpn = 'rocket_launcher';
      }

      if (bestWpn !== bot.activeWeapon) {
        input.switchWeapon = bestWpn;
      }
    }
  }

  // 3. Projectile Evasion / Defensive Reflexes
  if (projectiles.length > 0 && Math.random() < config.dodgeProjectileChance) {
    for (const p of projectiles) {
      if (p.shooterId === bot.id) continue;
      const pDist = Math.hypot(p.x - bot.x, p.y - bot.y);
      if (pDist < 220) {
        // Check if projectile is moving towards bot
        const toBotX = bot.x - p.x;
        const toBotY = bot.y - p.y;
        const dot = (p.vx * toBotX + p.vy * toBotY);
        if (dot > 0) {
          // Projectile approaching!
          if (bot.isGrounded && Math.random() < 0.6) {
            input.up = true; // Jump over projectile
          } else if (bot.shield > 25 && Math.random() < 0.7) {
            input.block = true; // Raise shield
          } else {
            // Dodge laterally
            if (p.vx > 0) input.right = true;
            else input.left = true;
          }
          break;
        }
      }
    }
  }

  // 4. Weapon Seeking Behavior
  let targetWeapon: ActiveWeaponSpawn | null = null;
  if (!hasWeapon || (bot.activeWeapon && (bot.weapons[bot.activeWeapon] || 0) <= 2)) {
    if (Math.random() < config.weaponSeekPreference) {
      let minWpnDist = config.level >= 3 ? 900 : 450;
      for (const w of weaponSpawns) {
        if (!w.isAvailable) continue;
        const d = Math.hypot(w.x - bot.x, w.y - bot.y);
        // Prioritize favorite weapons for higher difficulties
        const isFav = config.favoredWeaponsPriority.includes(w.weaponType);
        const effectiveDist = isFav ? d * 0.7 : d;

        if (effectiveDist < minWpnDist) {
          minWpnDist = effectiveDist;
          targetWeapon = w;
        }
      }
    }
  }

  if (targetWeapon) {
    const wx = targetWeapon.x - bot.x;
    const wy = targetWeapon.y - bot.y;
    if (wx > 15) input.right = true;
    else if (wx < -15) input.left = true;

    if (wy < -40 && (bot.isGrounded || Math.random() < config.jumpFrequency)) {
      input.up = true;
    }
    if (wy > 45 && Math.random() < config.dropThroughPlatformChance) {
      input.down = true;
    }
  }

  // 5. Combat & Targeting
  if (!closestEnemy) {
    if (Math.random() < 0.04) bot.facing = bot.facing === 1 ? -1 : 1;
    return input;
  }

  const dx = closestEnemy.x - bot.x;
  const dy = closestEnemy.y - bot.y;
  const absDx = Math.abs(dx);

  // Calculate Base Aim Angle towards Enemy Center
  const enemyCenterY = closestEnemy.y - FIGHTER_HEIGHT * 0.5;
  const botCenterY = bot.y - FIGHTER_HEIGHT * 0.5;

  let aimTargetX = closestEnemy.x;
  let aimTargetY = enemyCenterY;

  // Level 3+ Lead Prediction
  if (config.leadTargetVelocity && currentWeaponConfig) {
    const pSpeed = currentWeaponConfig.projectileSpeed || 18;
    const travelTime = minDist / (pSpeed * 60); // approx seconds
    const leadTime = travelTime * config.leadPredictionFactor;
    aimTargetX += closestEnemy.vx * 60 * leadTime;
    aimTargetY += closestEnemy.vy * 60 * leadTime;
  }

  // Calculate Angle
  let rawAngle = Math.atan2(aimTargetY - botCenterY, aimTargetX - bot.x);

  // Apply Skill-based Dispersion
  if (config.aimDispersionRad > 0) {
    const error = (Math.random() - 0.5) * 2 * config.aimDispersionRad;
    rawAngle += error;
  }

  input.aimAngle = rawAngle;

  // Movement & Spacing
  if (!targetWeapon) {
    let idealDist = 45;
    if (hasWeapon && currentWeaponConfig) {
      if (currentWeaponConfig.id === 'shotgun' || currentWeaponConfig.id === 'flame_gun') {
        idealDist = 120;
      } else if (currentWeaponConfig.id === 'railgun' || currentWeaponConfig.id === 'rifle') {
        idealDist = 360;
      } else {
        idealDist = 240;
      }
    }

    // Approach or Back Off
    if (absDx > idealDist + 35) {
      if (dx > 0) input.right = true;
      else input.left = true;
    } else if (absDx < idealDist - 30 && hasWeapon) {
      // Tactical kiting / backing away
      if (dx > 0) input.left = true;
      else input.right = true;
    }

    // Jump & Platform Dropping
    if (dy < -50 && Math.random() < config.jumpFrequency) {
      input.up = true;
    } else if (bot.y > arena.height - 180 && Math.random() < 0.4) {
      input.up = true; // Recover from low pits
    }

    if (dy > 70 && Math.random() < config.dropThroughPlatformChance) {
      input.down = true;
    }
  }

  // Offensive Execution
  if (hasWeapon) {
    const maxEffectiveRange = currentWeaponConfig?.range || 800;
    if (minDist < maxEffectiveRange) {
      // Fire if cooldown ready
      if (bot.weaponCooldown <= 0 && Math.random() < config.counterAttackAggression) {
        input.fire = true;
      }
    }
  } else {
    // Unarmed Melee Combat
    if (absDx < 75 && Math.abs(dy) < 55) {
      const isEnemyAttacking =
        closestEnemy.state === 'heavy_attack' || closestEnemy.state === 'fast_attack';

      if (isEnemyAttacking && Math.random() < config.blockAttackChance) {
        input.block = true;
      } else {
        const roll = Math.random();
        if (roll < 0.55 * config.counterAttackAggression) {
          input.fastAttack = true;
        } else if (roll < 0.9 * config.counterAttackAggression) {
          input.heavyAttack = true;
        } else {
          input.block = true;
        }
      }
    }
  }

  return input;
}
