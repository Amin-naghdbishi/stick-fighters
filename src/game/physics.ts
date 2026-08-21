import { ActiveWeaponSpawn, Arena, BotDifficultyLevel, ComicPop, FighterActionState, FighterState, Platform, PlayerInput, ProjectileState } from '../types/game';
import { WEAPONS_CONFIG, WeaponType, ORDERED_WEAPON_KEYS } from './weapons';
import { computeBotAction } from './botDifficulty';

// Constants
export const GRAVITY = 0.58;
export const MAX_FALL_SPEED = 15;
export const MOVE_SPEED = 7.2;
export const JUMP_VELOCITY = -13.5;
export const DOUBLE_JUMP_VELOCITY = -12.0;
export const BOUNCE_PAD_VELOCITY = -18.5;
export const FRICTION_GROUND = 0.82;
export const FRICTION_AIR = 0.94;

export const FIGHTER_WIDTH = 36;
export const FIGHTER_HEIGHT = 74;

// Unarmed Attack specs (Weakened as weapons are the primary combat powerhouse)
export const ATTACK_FAST_DAMAGE = 4;
export const ATTACK_FAST_DURATION = 0.20; // seconds
export const ATTACK_FAST_COOLDOWN = 0.25;
export const ATTACK_FAST_RANGE_X = 50;
export const ATTACK_FAST_RANGE_Y = 38;
export const ATTACK_FAST_KNOCKBACK_X = 4.0;
export const ATTACK_FAST_KNOCKBACK_Y = -2.5;

export const ATTACK_HEAVY_DAMAGE = 9;
export const ATTACK_HEAVY_DURATION = 0.35; // seconds
export const ATTACK_HEAVY_COOLDOWN = 0.60;
export const ATTACK_HEAVY_RANGE_X = 68;
export const ATTACK_HEAVY_RANGE_Y = 46;
export const ATTACK_HEAVY_KNOCKBACK_X = 8.5;
export const ATTACK_HEAVY_KNOCKBACK_Y = -4.5;

export interface HitResult {
  attackerId: string;
  targetId: string;
  damage: number;
  isHeavy: boolean;
  x: number;
  y: number;
  popText: string;
  blocked: boolean;
}

const COMIC_WORDS_FAST = ['POW!', 'BAM!', 'SMACK!', 'WHACK!', 'POP!', 'ZAP!', 'PEW!'];
const COMIC_WORDS_HEAVY = ['BOOM!', 'CRUNCH!', 'KABOOM!', 'CLANG!', 'K.O.!', 'SMASH!', 'BLAST!'];
const COMIC_WORDS_BLOCKED = ['CLINK!', 'BLOCKED!', 'SHIELD!', 'NOPE!'];

export function getRandomComicWord(isHeavy: boolean, blocked: boolean): string {
  if (blocked) {
    return COMIC_WORDS_BLOCKED[Math.floor(Math.random() * COMIC_WORDS_BLOCKED.length)];
  }
  if (isHeavy) {
    return COMIC_WORDS_HEAVY[Math.floor(Math.random() * COMIC_WORDS_HEAVY.length)];
  }
  return COMIC_WORDS_FAST[Math.floor(Math.random() * COMIC_WORDS_FAST.length)];
}

export function createInitialFighter(
  id: string,
  name: string,
  gender: 'male' | 'female',
  color: string,
  hat: any,
  x: number,
  y: number,
  isBot: boolean = false
): FighterState {
  return {
    id,
    name: name || (isBot ? `Bot-${id.slice(0, 4)}` : 'Fighter'),
    gender: gender || 'male',
    color: color || '#FF5733',
    hat: hat || 'none',
    x,
    y,
    vx: 0,
    vy: 0,
    facing: x < 700 ? 1 : -1,
    hp: 100,
    maxHp: 100,
    shield: 100,
    isGrounded: false,
    isBlocking: false,
    canDoubleJump: true,
    state: 'idle',
    stateTimer: 0,
    attackCooldown: 0,
    comboStep: 0,
    invincibleTimer: 0,
    hitStunTimer: 0,
    isDead: false,
    isReady: true,
    isBot,
    kills: 0,
    deaths: 0,
    score: 0,
    respawnTimer: 0,
    lastAttackerId: null,
    // Weapon & Inventory
    weapons: {},
    activeWeapon: null,
    aimAngle: 0,
    weaponCooldown: 0,
    chargeTimer: 0,
  };
}

export function updateFighterPhysics(
  fighter: FighterState,
  input: PlayerInput,
  arena: Arena,
  dt: number = 1 / 60
): void {
  if (fighter.isDead) {
    fighter.vx *= 0.85;
    fighter.vy += GRAVITY;
    fighter.x += fighter.vx;
    fighter.y += fighter.vy;
    return;
  }

  // Update aim angle from input if provided
  if (typeof input.aimAngle === 'number' && !isNaN(input.aimAngle)) {
    fighter.aimAngle = input.aimAngle;
  }

  // Handle weapon switching
  if (input.switchWeapon) {
    handleWeaponSwitch(fighter, input.switchWeapon);
  }

  // Update timers
  if (fighter.stateTimer > 0) fighter.stateTimer -= dt;
  if (fighter.attackCooldown > 0) fighter.attackCooldown -= dt;
  if (fighter.weaponCooldown > 0) fighter.weaponCooldown -= dt;
  if (fighter.invincibleTimer > 0) fighter.invincibleTimer -= dt;
  if (fighter.hitStunTimer > 0) {
    fighter.hitStunTimer -= dt;
    fighter.state = 'hit';
  }

  // Auto-switch to next available weapon if current weapon is out of ammo
  if (fighter.activeWeapon && (fighter.weapons[fighter.activeWeapon] || 0) <= 0) {
    autoSwitchToNextAvailableWeapon(fighter);
  }

  // Shield regeneration / drain
  if (input.block && fighter.isGrounded && fighter.shield > 5 && fighter.hitStunTimer <= 0 && fighter.state !== 'fast_attack' && fighter.state !== 'heavy_attack') {
    fighter.isBlocking = true;
    fighter.state = 'block';
    fighter.shield = Math.max(0, fighter.shield - dt * 25);
    fighter.vx *= 0.7; // slow down while blocking
  } else {
    fighter.isBlocking = false;
    fighter.shield = Math.min(100, fighter.shield + dt * 18);
  }

  // Hit Stun / Knocked behavior
  if (fighter.hitStunTimer > 0) {
    fighter.vy += GRAVITY;
    fighter.vx *= fighter.isGrounded ? FRICTION_GROUND : FRICTION_AIR;
    fighter.x += fighter.vx;
    fighter.y += fighter.vy;
    resolvePlatformCollisions(fighter, arena.platforms, input.down);
    return;
  }

  // Unarmed Attack Execution (if requested and not blocking)
  const canAttack = fighter.attackCooldown <= 0 && !fighter.isBlocking && fighter.hitStunTimer <= 0;

  if (canAttack && input.heavyAttack) {
    fighter.state = 'heavy_attack';
    fighter.stateTimer = ATTACK_HEAVY_DURATION;
    fighter.attackCooldown = ATTACK_HEAVY_COOLDOWN;
    fighter.vx = fighter.facing * (fighter.isGrounded ? 8.5 : 9.5);
    if (!fighter.isGrounded) fighter.vy = Math.min(fighter.vy, -2);
  } else if (canAttack && input.fastAttack) {
    fighter.state = 'fast_attack';
    fighter.stateTimer = ATTACK_FAST_DURATION;
    fighter.attackCooldown = ATTACK_FAST_COOLDOWN;
    fighter.comboStep = (fighter.comboStep + 1) % 3;
    fighter.vx += fighter.facing * (fighter.isGrounded ? 3.5 : 4.0);
  }

  const isAttacking = (fighter.state === 'fast_attack' || fighter.state === 'heavy_attack') && fighter.stateTimer > 0;

  // Movement Controls
  if (!fighter.isBlocking && (!isAttacking || fighter.state === 'fast_attack')) {
    if (input.left && !input.right) {
      fighter.vx = Math.max(fighter.vx - 1.8, -MOVE_SPEED);
      fighter.facing = -1;
    } else if (input.right && !input.left) {
      fighter.vx = Math.min(fighter.vx + 1.8, MOVE_SPEED);
      fighter.facing = 1;
    } else {
      fighter.vx *= fighter.isGrounded ? FRICTION_GROUND : FRICTION_AIR;
    }
  } else if (isAttacking && fighter.state === 'heavy_attack') {
    fighter.vx *= 0.94;
  }

  // Jump Handling
  if (input.up && !fighter.isBlocking && !isAttacking) {
    if (fighter.isGrounded) {
      fighter.vy = JUMP_VELOCITY;
      fighter.isGrounded = false;
      fighter.canDoubleJump = true;
      fighter.state = 'jump';
    } else if (fighter.canDoubleJump && fighter.vy > -5) {
      fighter.vy = DOUBLE_JUMP_VELOCITY;
      fighter.canDoubleJump = false;
      fighter.state = 'jump';
    }
  }

  // Apply Gravity
  fighter.vy = Math.min(fighter.vy + GRAVITY, MAX_FALL_SPEED);

  // Apply Velocities
  fighter.x += fighter.vx;
  fighter.y += fighter.vy;

  // Resolve Arena Platform Collisions
  fighter.isGrounded = false;
  resolvePlatformCollisions(fighter, arena.platforms, input.down);

  // Reset double jump on landing
  if (fighter.isGrounded) {
    fighter.canDoubleJump = true;
  }

  // State Updates & Facing Alignment for Weapons
  if (fighter.activeWeapon && typeof fighter.aimAngle === 'number') {
    // If stationary or firing, face towards aim angle
    if ((!input.left && !input.right) || input.fire) {
      fighter.facing = Math.cos(fighter.aimAngle) >= 0 ? 1 : -1;
    }
  }

  if (!isAttacking && !fighter.isBlocking && fighter.hitStunTimer <= 0) {
    if (!fighter.isGrounded) {
      fighter.state = fighter.vy < 0 ? 'jump' : 'fall';
    } else if (Math.abs(fighter.vx) > 0.8) {
      fighter.state = 'run';
    } else {
      fighter.state = 'idle';
    }
  }

  // Arena Boundary Limits
  const leftBound = 40;
  const rightBound = arena.width - 40;
  if (fighter.x < leftBound) {
    fighter.x = leftBound;
    fighter.vx = Math.abs(fighter.vx) * 0.5;
  } else if (fighter.x > rightBound) {
    fighter.x = rightBound;
    fighter.vx = -Math.abs(fighter.vx) * 0.5;
  }

  // Bottom Pit Check (Ring Out)
  if (fighter.y > arena.height + 80) {
    fighter.hp = 0;
  }
}

// Helper for swept AABB collision detection (prevents high-speed tunneling)
function lineIntersectsBox(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  bx: number,
  by: number,
  bw: number,
  bh: number
): boolean {
  // Check if either endpoint is directly inside
  if (x1 >= bx && x1 <= bx + bw && y1 >= by && y1 <= by + bh) return true;
  if (x2 >= bx && x2 <= bx + bw && y2 >= by && y2 <= by + bh) return true;

  const dx = x2 - x1;
  const dy = y2 - y1;

  let tmin = 0;
  let tmax = 1;

  // X slab
  if (Math.abs(dx) > 1e-6) {
    let t1 = (bx - x1) / dx;
    let t2 = (bx + bw - x1) / dx;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  } else {
    if (x1 < bx || x1 > bx + bw) return false;
  }

  // Y slab
  if (Math.abs(dy) > 1e-6) {
    let t1 = (by - y1) / dy;
    let t2 = (by + bh - y1) / dy;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  } else {
    if (y1 < by || y1 > by + bh) return false;
  }

  return tmax >= 0 && tmin <= 1;
}

export function handleWeaponSwitch(fighter: FighterState, switchCmd: 'next' | 'prev' | WeaponType): void {
  const owned = ORDERED_WEAPON_KEYS.filter((k) => (fighter.weapons[k] || 0) > 0);
  if (owned.length === 0) {
    fighter.activeWeapon = null;
    return;
  }

  if (switchCmd === 'next' || switchCmd === 'prev') {
    if (!fighter.activeWeapon) {
      fighter.activeWeapon = owned[0];
      return;
    }
    const curIdx = owned.indexOf(fighter.activeWeapon);
    if (curIdx === -1) {
      fighter.activeWeapon = owned[0];
      return;
    }
    const delta = switchCmd === 'next' ? 1 : -1;
    const nextIdx = (curIdx + delta + owned.length) % owned.length;
    fighter.activeWeapon = owned[nextIdx];
  } else if (ORDERED_WEAPON_KEYS.includes(switchCmd)) {
    if ((fighter.weapons[switchCmd] || 0) > 0) {
      fighter.activeWeapon = switchCmd;
    }
  }
}

export function autoSwitchToNextAvailableWeapon(fighter: FighterState): void {
  const owned = ORDERED_WEAPON_KEYS.filter((k) => (fighter.weapons[k] || 0) > 0);
  if (owned.length > 0) {
    fighter.activeWeapon = owned[0];
  } else {
    fighter.activeWeapon = null;
  }
}

export function resolvePlatformCollisions(
  fighter: FighterState,
  platforms: Platform[],
  droppingDown: boolean
): void {
  const fBottom = fighter.y;
  const fTop = fighter.y - FIGHTER_HEIGHT;
  const fLeft = fighter.x - FIGHTER_WIDTH / 2;
  const fRight = fighter.x + FIGHTER_WIDTH / 2;

  for (const plat of platforms) {
    const pLeft = plat.x;
    const pRight = plat.x + plat.width;
    const pTop = plat.y;
    const pBottom = plat.y + plat.height;

    // Check horizontal overlap
    if (fRight > pLeft && fLeft < pRight) {
      // 1. One-way / Passable platform
      if (plat.isPassableDown) {
        if (droppingDown) continue; // Player intends to drop through

        const prevBottom = fBottom - fighter.vy;
        if (fighter.vy >= 0 && prevBottom <= pTop + 14 && fBottom >= pTop) {
          fighter.y = pTop;
          if (plat.type === 'bounce') {
            fighter.vy = BOUNCE_PAD_VELOCITY;
            fighter.isGrounded = false;
            fighter.canDoubleJump = true;
          } else {
            fighter.vy = 0;
            fighter.isGrounded = true;
          }
        }
      } else {
        // 2. Solid platform (ground or walls)
        const prevBottom = fBottom - fighter.vy;
        if (fighter.vy >= 0 && prevBottom <= pTop + 16 && fBottom >= pTop) {
          fighter.y = pTop;
          fighter.vy = 0;
          fighter.isGrounded = true;
        } else if (fighter.vy < 0 && fTop < pBottom && fTop > pTop) {
          fighter.y = pBottom + FIGHTER_HEIGHT;
          fighter.vy = 0;
        }
      }
    }
  }
}

/**
 * Checks and collects nearby available weapon spawns
 */
export function checkWeaponPickups(
  fighters: FighterState[],
  weaponSpawns: ActiveWeaponSpawn[]
): { playerId: string; weaponType: WeaponType; x: number; y: number }[] {
  const pickups: { playerId: string; weaponType: WeaponType; x: number; y: number }[] = [];

  for (const f of fighters) {
    if (f.isDead) continue;
    for (const spawn of weaponSpawns) {
      if (!spawn.isAvailable) continue;

      const dist = Math.hypot(f.x - spawn.x, (f.y - FIGHTER_HEIGHT / 2) - spawn.y);
      if (dist < 52) {
        // Picked up!
        spawn.isAvailable = false;
        const config = WEAPONS_CONFIG[spawn.weaponType];
        spawn.respawnTimer = config ? config.respawnTime : 10;

        // Add ammo with a generous cap
        const ammoToAdd = config ? config.ammoCapacity : 10;
        f.weapons[spawn.weaponType] = Math.min(30, (f.weapons[spawn.weaponType] || 0) + ammoToAdd);

        if (!f.activeWeapon || (f.weapons[f.activeWeapon] || 0) <= 0) {
          f.activeWeapon = spawn.weaponType;
        }

        pickups.push({
          playerId: f.id,
          weaponType: spawn.weaponType,
          x: spawn.x,
          y: spawn.y,
        });
      }
    }
  }

  return pickups;
}

/**
 * Fire active weapon from fighter
 */
export function fireFighterWeapon(
  fighter: FighterState,
  projectiles: ProjectileState[]
): boolean {
  if (fighter.isDead || !fighter.activeWeapon || fighter.weaponCooldown > 0) {
    return false;
  }

  const currentAmmo = fighter.weapons[fighter.activeWeapon] || 0;
  if (currentAmmo <= 0) {
    delete fighter.weapons[fighter.activeWeapon];
    autoSwitchToNextAvailableWeapon(fighter);
    return false;
  }

  const config = WEAPONS_CONFIG[fighter.activeWeapon];
  if (!config) return false;

  // Deduct 1 ammo
  const remainingAmmo = currentAmmo - 1;
  if (remainingAmmo <= 0) {
    delete fighter.weapons[fighter.activeWeapon];
  } else {
    fighter.weapons[fighter.activeWeapon] = remainingAmmo;
  }
  fighter.weaponCooldown = config.fireRate;

  // Muzzle position (torso/hand level)
  const muzzleDist = 32;
  const muzzleX = fighter.x + Math.cos(fighter.aimAngle) * muzzleDist;
  const muzzleY = (fighter.y - FIGHTER_HEIGHT * 0.55) + Math.sin(fighter.aimAngle) * muzzleDist;

  // Apply recoil impulse
  fighter.vx -= Math.cos(fighter.aimAngle) * config.recoil;
  fighter.vy -= Math.sin(fighter.aimAngle) * (config.recoil * 0.5);

  const now = Date.now();

  if (config.pellets && config.pellets > 1) {
    // Shotgun spread
    const spreadAngle = 0.38; // ~22 degrees total cone
    for (let i = 0; i < config.pellets; i++) {
      const angleOffset = (i / (config.pellets - 1) - 0.5) * spreadAngle + (Math.random() - 0.5) * 0.05;
      const finalAngle = fighter.aimAngle + angleOffset;
      const speed = config.projectileSpeed * (0.9 + Math.random() * 0.2);

      projectiles.push({
        id: `proj_${fighter.id}_${now}_${i}`,
        shooterId: fighter.id,
        weaponType: config.id,
        x: muzzleX,
        y: muzzleY,
        vx: Math.cos(finalAngle) * speed,
        vy: Math.sin(finalAngle) * speed,
        life: config.projectileLife,
        maxLife: config.projectileLife,
        damage: config.damage,
        knockback: config.knockback,
        color: config.bulletColor,
        createdAt: now,
      });
    }
  } else if (config.burstCount && config.burstCount > 1) {
    // Burst SMG (primary bullet immediately, others chained or spread slightly)
    for (let i = 0; i < config.burstCount; i++) {
      const angleOffset = (Math.random() - 0.5) * 0.08;
      const finalAngle = fighter.aimAngle + angleOffset;
      const speed = config.projectileSpeed;
      const offsetDist = i * -12; // staggered trail

      projectiles.push({
        id: `proj_${fighter.id}_${now}_${i}`,
        shooterId: fighter.id,
        weaponType: config.id,
        x: muzzleX + Math.cos(finalAngle) * offsetDist,
        y: muzzleY + Math.sin(finalAngle) * offsetDist,
        vx: Math.cos(finalAngle) * speed,
        vy: Math.sin(finalAngle) * speed,
        life: config.projectileLife + i * 0.05,
        maxLife: config.projectileLife + i * 0.05,
        damage: config.damage,
        knockback: config.knockback,
        color: config.bulletColor,
        createdAt: now,
      });
    }
  } else {
    // Single projectile / Beam / Rocket / Flame
    const speed = config.projectileSpeed;
    projectiles.push({
      id: `proj_${fighter.id}_${now}`,
      shooterId: fighter.id,
      weaponType: config.id,
      x: muzzleX,
      y: muzzleY,
      vx: Math.cos(fighter.aimAngle) * speed,
      vy: Math.sin(fighter.aimAngle) * speed,
      life: config.projectileLife,
      maxLife: config.projectileLife,
      damage: config.damage,
      knockback: config.knockback,
      hasGravity: config.hasGravity,
      explosionRadius: config.explosionRadius,
      isFlame: config.isFlame,
      isBeam: config.isBeam,
      color: config.bulletColor,
      createdAt: now,
    });
  }

  // If last ammo was used, switch to next available
  if (remainingAmmo <= 0) {
    autoSwitchToNextAvailableWeapon(fighter);
  }

  return true;
}

/**
 * Update active projectiles, resolve collisions with platforms and fighters
 */
export function updateProjectiles(
  projectiles: ProjectileState[],
  fighters: FighterState[],
  arena: Arena,
  dt: number = 1 / 60
): {
  activeProjectiles: ProjectileState[];
  hits: HitResult[];
  explosions: { x: number; y: number; radius: number; color: string }[];
} {
  const active: ProjectileState[] = [];
  const hits: HitResult[] = [];
  const explosions: { x: number; y: number; radius: number; color: string }[] = [];

  for (const p of projectiles) {
    p.life -= dt;
    if (p.life <= 0) {
      if (p.explosionRadius && p.explosionRadius > 0) {
        explosions.push({ x: p.x, y: p.y, radius: p.explosionRadius, color: p.color });
        applyExplosionDamage(p.x, p.y, p.explosionRadius, p.damage, p.shooterId, fighters, hits);
      }
      continue;
    }

    if (p.hasGravity) {
      p.vy += GRAVITY * 0.65;
    }

    const prevX = p.x;
    const prevY = p.y;

    p.x += p.vx;
    p.y += p.vy;

    // Check platform collision using continuous ray segment
    let hitPlatform = false;
    for (const plat of arena.platforms) {
      if (plat.isPassableDown) continue; // standard bullets pass through soft platforms
      if (lineIntersectsBox(prevX, prevY, p.x, p.y, plat.x, plat.y, plat.width, plat.height)) {
        hitPlatform = true;
        break;
      }
    }

    if (hitPlatform) {
      if (p.explosionRadius && p.explosionRadius > 0) {
        explosions.push({ x: p.x, y: p.y, radius: p.explosionRadius, color: p.color });
        applyExplosionDamage(p.x, p.y, p.explosionRadius, p.damage, p.shooterId, fighters, hits);
      }
      continue; // Projectile destroyed
    }

    // Check fighter collision using continuous ray segment
    let hitFighter: FighterState | null = null;
    for (const f of fighters) {
      if (f.id === p.shooterId || f.isDead || f.invincibleTimer > 0) continue;

      const fLeft = f.x - FIGHTER_WIDTH / 2;
      const fTop = f.y - FIGHTER_HEIGHT;

      if (lineIntersectsBox(prevX, prevY, p.x, p.y, fLeft, fTop, FIGHTER_WIDTH, FIGHTER_HEIGHT)) {
        hitFighter = f;
        break;
      }
    }

    if (hitFighter) {
      const isBlocked = hitFighter.isBlocking && hitFighter.shield > 10;
      const damage = isBlocked ? Math.round(p.damage * 0.25) : p.damage;
      hitFighter.hp = Math.max(0, hitFighter.hp - damage);
      hitFighter.lastAttackerId = p.shooterId;
      hitFighter.invincibleTimer = 0.08;

      const isHeavyHit = p.damage >= 25;
      const popText = getRandomComicWord(isHeavyHit, isBlocked);

      if (isBlocked) {
        hitFighter.shield = Math.max(0, hitFighter.shield - p.damage * 0.8);
      } else {
        hitFighter.hitStunTimer = isHeavyHit ? 0.28 : 0.14;
        const normVx = p.vx !== 0 ? Math.sign(p.vx) : 1;
        hitFighter.vx += normVx * p.knockback;
        hitFighter.vy = Math.min(hitFighter.vy, -p.knockback * 0.4);
        hitFighter.state = 'hit';
      }

      hits.push({
        attackerId: p.shooterId,
        targetId: hitFighter.id,
        damage,
        isHeavy: isHeavyHit,
        x: p.x,
        y: p.y,
        popText,
        blocked: isBlocked,
      });

      if (p.explosionRadius && p.explosionRadius > 0) {
        explosions.push({ x: p.x, y: p.y, radius: p.explosionRadius, color: p.color });
        applyExplosionDamage(p.x, p.y, p.explosionRadius, p.damage * 0.6, p.shooterId, fighters, hits, hitFighter.id);
      }

      // If flame gun, don't immediately destroy the flame particle
      if (p.isFlame) {
        p.life -= 0.1;
        active.push(p);
      }
      continue;
    }

    active.push(p);
  }

  return { activeProjectiles: active, hits, explosions };
}

function applyExplosionDamage(
  x: number,
  y: number,
  radius: number,
  maxDamage: number,
  shooterId: string,
  fighters: FighterState[],
  hits: HitResult[],
  excludeTargetId?: string
): void {
  for (const f of fighters) {
    if (f.isDead || f.invincibleTimer > 0 || f.id === excludeTargetId) continue;
    const dist = Math.hypot(f.x - x, (f.y - FIGHTER_HEIGHT / 2) - y);
    if (dist < radius) {
      const falloff = 1 - dist / radius;
      const damage = Math.max(5, Math.round(maxDamage * falloff));
      const isBlocked = f.isBlocking && f.shield > 10;
      const finalDamage = isBlocked ? Math.round(damage * 0.3) : damage;

      f.hp = Math.max(0, f.hp - finalDamage);
      f.lastAttackerId = shooterId;

      const angle = Math.atan2((f.y - FIGHTER_HEIGHT / 2) - y, f.x - x);
      const knock = 14 * falloff;
      f.vx += Math.cos(angle) * knock;
      f.vy += Math.sin(angle) * knock - 4;
      f.hitStunTimer = 0.3;
      f.state = 'hit';

      hits.push({
        attackerId: shooterId,
        targetId: f.id,
        damage: finalDamage,
        isHeavy: true,
        x: f.x,
        y: f.y - FIGHTER_HEIGHT / 2,
        popText: 'KABOOM!',
        blocked: isBlocked,
      });
    }
  }
}

export function checkAttackCollisions(
  fighters: FighterState[],
  arena: Arena
): HitResult[] {
  const hits: HitResult[] = [];

  for (const attacker of fighters) {
    if (attacker.isDead) continue;
    const isFast = attacker.state === 'fast_attack' && attacker.stateTimer > 0.08 && attacker.stateTimer < 0.18;
    const isHeavy = attacker.state === 'heavy_attack' && attacker.stateTimer > 0.15 && attacker.stateTimer < 0.32;

    if (!isFast && !isHeavy) continue;

    const rangeX = isHeavy ? ATTACK_HEAVY_RANGE_X : ATTACK_FAST_RANGE_X;
    const rangeY = isHeavy ? ATTACK_HEAVY_RANGE_Y : ATTACK_FAST_RANGE_Y;
    const hitBoxX = attacker.x + (attacker.facing * rangeX) / 2;
    const hitBoxY = attacker.y - FIGHTER_HEIGHT / 2;

    for (const target of fighters) {
      if (target.id === attacker.id || target.isDead || target.invincibleTimer > 0) continue;

      const targetBoxX = target.x;
      const targetBoxY = target.y - FIGHTER_HEIGHT / 2;

      const dx = Math.abs(hitBoxX - targetBoxX);
      const dy = Math.abs(hitBoxY - targetBoxY);

      if (dx < rangeX / 2 + FIGHTER_WIDTH / 2 && dy < rangeY / 2 + FIGHTER_HEIGHT / 2) {
        const isBlocked = target.isBlocking && target.shield > 10 && (target.facing === -attacker.facing);
        const baseDamage = isHeavy ? ATTACK_HEAVY_DAMAGE : ATTACK_FAST_DAMAGE;
        const damage = isBlocked ? Math.round(baseDamage * 0.2) : baseDamage;

        target.hp = Math.max(0, target.hp - damage);
        target.invincibleTimer = isHeavy ? 0.25 : 0.15;
        target.lastAttackerId = attacker.id;

        const pop = getRandomComicWord(isHeavy, isBlocked);

        if (isBlocked) {
          target.shield = Math.max(0, target.shield - (isHeavy ? 35 : 15));
          target.vx = attacker.facing * (isHeavy ? 4.5 : 2.0);
        } else {
          target.hitStunTimer = isHeavy ? 0.35 : 0.2;
          target.vx = attacker.facing * (isHeavy ? ATTACK_HEAVY_KNOCKBACK_X : ATTACK_FAST_KNOCKBACK_X);
          target.vy = isHeavy ? ATTACK_HEAVY_KNOCKBACK_Y : ATTACK_FAST_KNOCKBACK_Y;
          target.state = 'hit';
        }

        if (target.hp <= 0) {
          target.hp = 0;
        }

        hits.push({
          attackerId: attacker.id,
          targetId: target.id,
          damage,
          isHeavy,
          x: (attacker.x + target.x) / 2,
          y: target.y - FIGHTER_HEIGHT / 2 - 10,
          popText: pop,
          blocked: isBlocked,
        });
      }
    }
  }

  return hits;
}

// Bot AI Decision Engine with 5 balanced difficulty levels & weapon dynamics
export function updateBotAI(
  bot: FighterState,
  fighters: FighterState[],
  arena: Arena,
  weaponSpawns: ActiveWeaponSpawn[] = [],
  projectiles: ProjectileState[] = [],
  difficultyLevel: BotDifficultyLevel = 3
): PlayerInput {
  return computeBotAction(bot, fighters, arena, weaponSpawns, projectiles, difficultyLevel);
}
