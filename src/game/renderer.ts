import { ActiveWeaponSpawn, Arena, ComicPop, FighterState, Particle, ProjectileState } from '../types/game';
import { WEAPONS_CONFIG, WeaponType } from './weapons';

export interface CameraState {
  x: number;
  y: number;
  zoom: number;
  shakeTime: number;
  shakeIntensity: number;
}

// Camera Tuning Constants - Configured for optimal combat visibility & smoothness
export const CAMERA_CONFIG = {
  NEARBY_RADIUS_X: 440,       // Max horizontal distance to consider an opponent "nearby"
  NEARBY_RADIUS_Y: 280,       // Max vertical distance to consider an opponent "nearby"
  NEARBY_MAX_EUCLIDEAN: 480,  // Max Euclidean radius around the local player

  SOLO_ZOOM: 1.12,            // Default zoom level when local player is alone or far from enemies
  MIN_ZOOM: 0.84,             // Minimum allowed zoom (maximum zoom out limit, even with 10+ fighters)
  MAX_ZOOM: 1.18,             // Maximum allowed zoom in

  POS_LERP: 0.12,             // Positional follow responsiveness
  ZOOM_LERP: 0.05,            // Gradual, cinematic zoom interpolation

  TARGET_OFFSET_Y: -28,       // Center camera at upper torso/head height
  LOOK_AHEAD_X: 18,           // Subtle peek in the direction the local player is facing
};

export class GameRenderer {
  private ctx: CanvasRenderingContext2D;
  private width: number = 1000;
  private height: number = 600;
  private initialized: boolean = false;
  public camera: CameraState = {
    x: 700,
    y: 450,
    zoom: 1.0,
    shakeTime: 0,
    shakeIntensity: 0,
  };

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  public setDimensions(w: number, h: number) {
    this.width = w;
    this.height = h;
  }

  public triggerShake(intensity: number = 8, duration: number = 0.25) {
    this.camera.shakeIntensity = intensity;
    this.camera.shakeTime = duration;
  }

  /**
   * Updates camera position and zoom: Anchored to Local Player.
   */
  public updateCamera(
    fighters: FighterState[],
    arena: Arena,
    localPlayerId?: string,
    dt: number = 1 / 60
  ) {
    if (this.camera.shakeTime > 0) {
      this.camera.shakeTime -= dt;
    }

    if (fighters.length === 0) return;

    let localPlayer = localPlayerId ? fighters.find((f) => f.id === localPlayerId) : undefined;
    if (!localPlayer) {
      localPlayer = fighters.find((f) => !f.isBot && !f.isDead) || fighters.find((f) => !f.isDead) || fighters[0];
    }

    let targetX: number;
    let targetY: number;

    if (localPlayer) {
      const facing = localPlayer.facing || 1;
      targetX = localPlayer.x + facing * CAMERA_CONFIG.LOOK_AHEAD_X;
      targetY = localPlayer.y + CAMERA_CONFIG.TARGET_OFFSET_Y;
    } else {
      targetX = arena.width / 2;
      targetY = arena.height / 2;
    }

    let desiredZoom = CAMERA_CONFIG.SOLO_ZOOM;

    if (localPlayer && !localPlayer.isDead) {
      const px = localPlayer.x;
      const py = localPlayer.y;

      const nearbyOpponents = fighters.filter((f) => {
        if (f.id === localPlayer!.id || f.isDead) return false;
        const dx = Math.abs(f.x - px);
        const dy = Math.abs(f.y - py);
        const distSq = dx * dx + dy * dy;
        return (
          dx <= CAMERA_CONFIG.NEARBY_RADIUS_X &&
          dy <= CAMERA_CONFIG.NEARBY_RADIUS_Y &&
          distSq <= CAMERA_CONFIG.NEARBY_MAX_EUCLIDEAN * CAMERA_CONFIG.NEARBY_MAX_EUCLIDEAN
        );
      });

      if (nearbyOpponents.length > 0) {
        let maxDx = 140;
        let maxDy = 100;

        for (const op of nearbyOpponents) {
          maxDx = Math.max(maxDx, Math.abs(op.x - px));
          maxDy = Math.max(maxDy, Math.abs(op.y - py));
        }

        const paddingX = 240;
        const paddingY = 180;
        const requiredSpanX = maxDx * 2 + paddingX;
        const requiredSpanY = maxDy * 2 + paddingY;

        const fitZoomX = this.width / Math.max(480, requiredSpanX);
        const fitZoomY = this.height / Math.max(360, requiredSpanY);
        desiredZoom = Math.min(fitZoomX, fitZoomY);
      } else {
        desiredZoom = CAMERA_CONFIG.SOLO_ZOOM;
      }
    }

    desiredZoom = Math.max(CAMERA_CONFIG.MIN_ZOOM, Math.min(CAMERA_CONFIG.MAX_ZOOM, desiredZoom));

    const clampedDt = Math.min(0.1, Math.max(0.001, dt));
    const posFactor = 1 - Math.pow(1 - CAMERA_CONFIG.POS_LERP, clampedDt * 60);
    const zoomFactor = 1 - Math.pow(1 - CAMERA_CONFIG.ZOOM_LERP, clampedDt * 60);

    if (!this.initialized) {
      this.camera.x = targetX;
      this.camera.y = targetY;
      this.camera.zoom = desiredZoom;
      this.initialized = true;
    } else {
      const distSq = (targetX - this.camera.x) ** 2 + (targetY - this.camera.y) ** 2;
      if (distSq > 1500 * 1500) {
        this.camera.x = targetX;
        this.camera.y = targetY;
      } else {
        this.camera.x += (targetX - this.camera.x) * posFactor;
        this.camera.y += (targetY - this.camera.y) * posFactor;
      }

      this.camera.zoom += (desiredZoom - this.camera.zoom) * zoomFactor;
    }

    const halfViewW = this.width / 2 / this.camera.zoom;
    const halfViewH = this.height / 2 / this.camera.zoom;

    if (arena.width > halfViewW * 2) {
      this.camera.x = Math.max(halfViewW, Math.min(arena.width - halfViewW, this.camera.x));
    } else {
      this.camera.x = arena.width / 2;
    }

    if (arena.height > halfViewH * 2) {
      this.camera.y = Math.max(halfViewH, Math.min(arena.height - halfViewH, this.camera.y));
    } else {
      this.camera.y = arena.height / 2;
    }
  }

  public render(
    arena: Arena,
    fighters: FighterState[],
    particles: Particle[],
    comicPops: ComicPop[],
    time: number,
    weaponSpawns: ActiveWeaponSpawn[] = [],
    projectiles: ProjectileState[] = []
  ) {
    const ctx = this.ctx;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    // 1. HARD RESET matrix and wipe the entire physical canvas buffer to completely eliminate any ghost trails/unrendered pixels
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = arena.bgColor || '#BAE6FD';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // 2. Set DPR matrix for crisp rendering
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // 3. Apply Camera Transform safely inside try ... finally
    ctx.save();
    try {
      let shakeX = 0;
      let shakeY = 0;
      if (this.camera.shakeTime > 0) {
        const s = this.camera.shakeIntensity;
        shakeX = (Math.random() - 0.5) * s * 2;
        shakeY = (Math.random() - 0.5) * s * 2;
      }

      ctx.translate(this.width / 2 + shakeX, this.height / 2 + shakeY);
      ctx.scale(this.camera.zoom, this.camera.zoom);
      ctx.translate(-this.camera.x, -this.camera.y);

      // 1. Draw Arena Background & Scenery
      this.drawArenaBackdrop(arena, time);

      // 2. Draw Arena Platforms
      this.drawPlatforms(arena);

      // 3. Draw Weapon Spawns
      this.drawWeaponSpawns(weaponSpawns, time);

      // 4. Draw Projectiles
      this.drawProjectiles(projectiles, time);

      // 5. Draw Particles (dust, speed lines, sparks)
      this.drawParticles(particles);

      // 6. Draw Fighters (with Aim-rotated arms & weapons)
      for (const f of fighters) {
        this.drawFighter(f, time);
      }

      // 7. Draw Comic Pops ("POW!", "BAM!", "KABOOM!")
      this.drawComicPops(comicPops);
    } finally {
      ctx.restore();
    }
  }

  private drawArenaBackdrop(arena: Arena, time: number) {
    const ctx = this.ctx;

    // Sun / Cartoon Light
    ctx.save();
    ctx.beginPath();
    ctx.arc(1150, 140, 65, 0, Math.PI * 2);
    ctx.fillStyle = '#FFE57F';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#333333';
    ctx.stroke();

    ctx.strokeStyle = '#FFE082';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([8, 8]);
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
      ctx.beginPath();
      ctx.moveTo(1150 + Math.cos(a) * 75, 140 + Math.sin(a) * 75);
      ctx.lineTo(1150 + Math.cos(a) * 110, 140 + Math.sin(a) * 110);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();

    this.drawComicCloud(240 + Math.sin(time * 0.0005) * 30, 120, 70);
    this.drawComicCloud(680 + Math.cos(time * 0.0004) * 40, 90, 85);
    this.drawComicCloud(1180 + Math.sin(time * 0.0006) * 25, 180, 60);

    if (arena.theme === 'park') {
      ctx.fillStyle = '#A3E048';
      ctx.strokeStyle = '#2D3748';
      ctx.lineWidth = 3;

      ctx.beginPath();
      ctx.moveTo(-100, 750);
      ctx.quadraticCurveTo(350, 480, 700, 680);
      ctx.quadraticCurveTo(1100, 520, 1600, 750);
      ctx.lineTo(1600, 950);
      ctx.lineTo(-100, 950);
      ctx.fill();
      ctx.stroke();

      this.drawCartoonTree(150, 560, 55);
      this.drawCartoonTree(1250, 560, 60);
      this.drawCartoonTree(700, 640, 45);
    } else if (arena.theme === 'town') {
      ctx.fillStyle = '#FFD8A8';
      ctx.strokeStyle = '#2D3748';
      ctx.lineWidth = 3;

      ctx.fillRect(80, 360, 160, 400);
      ctx.strokeRect(80, 360, 160, 400);
      ctx.beginPath();
      ctx.moveTo(60, 360);
      ctx.lineTo(160, 260);
      ctx.lineTo(260, 360);
      ctx.closePath();
      ctx.fillStyle = '#E8590C';
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#D0EBFF';
      ctx.fillRect(1160, 340, 180, 450);
      ctx.strokeRect(1160, 340, 180, 450);
      ctx.beginPath();
      ctx.moveTo(1140, 340);
      ctx.lineTo(1250, 240);
      ctx.lineTo(1360, 340);
      ctx.closePath();
      ctx.fillStyle = '#1971C2';
      ctx.fill();
      ctx.stroke();

      this.drawBunting(350, 380, 850, 410, time);
    } else if (arena.theme === 'island') {
      this.drawRainbow(700, 550, 450);
      this.drawFloatingMiniRock(180, 280, 60, time);
      this.drawFloatingMiniRock(1220, 240, 70, time + 2);
    } else if (arena.theme === 'castle') {
      ctx.fillStyle = '#D1C4E9';
      ctx.strokeStyle = '#2D3748';
      ctx.lineWidth = 3;

      ctx.fillRect(520, 200, 360, 550);
      ctx.strokeRect(520, 200, 360, 550);
      for (let bx = 520; bx < 880; bx += 60) {
        ctx.fillRect(bx, 170, 35, 30);
        ctx.strokeRect(bx, 170, 35, 30);
      }
      this.drawFlag(700, 120, '#E53935', time);
    } else if (arena.theme === 'dojo') {
      ctx.fillStyle = '#FEF3C7';
      ctx.strokeStyle = '#78350F';
      ctx.lineWidth = 3;
      for (let sx = 100; sx < arena.width - 100; sx += 200) {
        ctx.strokeRect(sx, 180, 180, 400);
        ctx.strokeRect(sx + 10, 190, 75, 180);
        ctx.strokeRect(sx + 95, 190, 75, 180);
        ctx.strokeRect(sx + 10, 380, 75, 180);
        ctx.strokeRect(sx + 95, 380, 75, 180);
      }
      for (let lx = 250; lx < arena.width; lx += 350) {
        ctx.beginPath();
        ctx.moveTo(lx, 0);
        ctx.lineTo(lx, 140);
        ctx.strokeStyle = '#1F2937';
        ctx.stroke();
        ctx.fillStyle = '#DC2626';
        ctx.strokeStyle = '#7F1D1D';
        ctx.beginPath();
        ctx.arc(lx, 160, 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    } else if (arena.theme === 'cyber') {
      ctx.strokeStyle = '#93C5FD';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      for (let gy = 100; gy < arena.height; gy += 80) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(arena.width, gy);
        ctx.stroke();
      }
      for (let gx = 100; gx < arena.width; gx += 120) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, arena.height);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    } else if (arena.theme === 'volcano') {
      ctx.fillStyle = '#FED7AA';
      ctx.strokeStyle = '#9A3412';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(arena.width / 2, arena.height + 200, 500, 0, Math.PI, true);
      ctx.fill();
      ctx.stroke();
    } else if (arena.theme === 'forest') {
      ctx.fillStyle = '#C8E6C9';
      ctx.strokeStyle = '#2E7D32';
      ctx.lineWidth = 3;

      ctx.beginPath();
      ctx.moveTo(0, arena.height - 300);
      for (let hx = 0; hx <= arena.width; hx += 400) {
        ctx.quadraticCurveTo(hx + 200, arena.height - 500, hx + 400, arena.height - 300);
      }
      ctx.lineTo(arena.width, arena.height);
      ctx.lineTo(0, arena.height);
      ctx.fill();
      ctx.stroke();

      for (let tx = 200; tx < arena.width; tx += 450) {
        ctx.fillStyle = '#8D6E63';
        ctx.strokeStyle = '#4E342E';
        ctx.fillRect(tx, 200, 70, arena.height - 200);
        ctx.strokeRect(tx, 200, 70, arena.height - 200);
        this.drawCartoonTree(tx + 35, 200, 110);
      }
    } else if (arena.theme === 'ruins') {
      ctx.fillStyle = '#FFF9C4';
      ctx.strokeStyle = '#8D6E63';
      ctx.lineWidth = 3;

      for (let rx = 250; rx < arena.width - 200; rx += 500) {
        ctx.strokeRect(rx, 350, 160, 450);
        ctx.beginPath();
        ctx.arc(rx + 80, 350, 80, Math.PI, 0);
        ctx.stroke();
        for (let px = rx + 25; px < rx + 140; px += 30) {
          ctx.beginPath();
          ctx.moveTo(px, 350);
          ctx.lineTo(px, 800);
          ctx.stroke();
        }
      }
    } else if (arena.theme === 'canyon') {
      ctx.fillStyle = '#FFCCBC';
      ctx.strokeStyle = '#BF360C';
      ctx.lineWidth = 3;

      ctx.beginPath();
      ctx.moveTo(0, arena.height - 400);
      for (let cx = 0; cx <= arena.width; cx += 500) {
        ctx.lineTo(cx + 150, arena.height - 650);
        ctx.lineTo(cx + 350, arena.height - 650);
        ctx.lineTo(cx + 500, arena.height - 400);
      }
      ctx.lineTo(arena.width, arena.height);
      ctx.lineTo(0, arena.height);
      ctx.fill();
      ctx.stroke();
    } else if (arena.theme === 'metropolis') {
      ctx.strokeStyle = '#37474F';
      ctx.lineWidth = 3;

      for (let mx = 100; mx < arena.width; mx += 260) {
        const h = 400 + ((mx * 13) % 350);
        ctx.fillStyle = mx % 520 === 0 ? '#CFD8DC' : '#ECEFF1';
        ctx.fillRect(mx, arena.height - h, 200, h);
        ctx.strokeRect(mx, arena.height - h, 200, h);

        ctx.fillStyle = '#FFE082';
        for (let wy = arena.height - h + 30; wy < arena.height - 100; wy += 45) {
          for (let wx = mx + 20; wx < mx + 180; wx += 35) {
            if ((wx + wy) % 3 !== 0) {
              ctx.fillRect(wx, wy, 16, 20);
            }
          }
        }
      }
    }
  }

  private drawPlatforms(arena: Arena) {
    const ctx = this.ctx;
    ctx.save();
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#1E293B';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const plat of arena.platforms) {
      const px = plat.x;
      const py = plat.y;
      const pw = plat.width;
      const ph = plat.height;

      if (plat.type === 'bounce') {
        ctx.fillStyle = '#FF5252';
        this.roundRect(ctx, px, py, pw, ph, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.moveTo(px + pw / 2 - 14, py + ph / 2 + 5);
        ctx.lineTo(px + pw / 2, py + ph / 2 - 7);
        ctx.lineTo(px + pw / 2 + 14, py + ph / 2 + 5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (plat.isPassableDown) {
        ctx.fillStyle = plat.color || '#E5A65D';
        this.roundRect(ctx, px, py, pw, ph, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.globalAlpha = 0.35;
        this.roundRect(ctx, px + 4, py + 3, pw - 8, 4, 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
      } else {
        ctx.fillStyle = '#8D6E63';
        ctx.fillRect(px, py + 16, pw, ph - 16);
        ctx.strokeRect(px, py + 16, pw, ph - 16);

        ctx.fillStyle = plat.color || '#66BB6A';
        this.roundRect(ctx, px - 4, py, pw + 8, 24, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#43A047';
        for (let gx = px + 20; gx < px + pw - 20; gx += 35) {
          ctx.beginPath();
          ctx.moveTo(gx, py + 24);
          ctx.lineTo(gx + 6, py + 32);
          ctx.lineTo(gx + 12, py + 24);
          ctx.fill();
        }
      }
    }

    ctx.restore();
  }

  /**
   * Draw glowing weapon spawn pads on the map
   * - Available: Only weapon sprite + subtle halo glow (NO LABELS / NO TEXT)
   * - Picked Up: Completely empty (NO SPRITE, NO INACTIVE SILHOUETTE, NO TEXT)
   */
  private drawWeaponSpawns(spawns: ActiveWeaponSpawn[], time: number) {
    const ctx = this.ctx;
    ctx.save();

    for (const sp of spawns) {
      const config = WEAPONS_CONFIG[sp.weaponType];
      if (!config) continue;

      const sx = sp.x;
      const sy = sp.y;

      // 1. Sleek comic-style floor spawn marker
      ctx.fillStyle = '#1E293B';
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 2.5;
      this.roundRect(ctx, sx - 24, sy + 10, 48, 8, 4);
      ctx.fill();
      ctx.stroke();

      if (sp.isAvailable) {
        // Floating Halo Glow
        const bob = Math.sin(time * 0.005 + sx) * 6;
        const floatY = sy - 8 + bob;

        ctx.fillStyle = config.color;
        ctx.globalAlpha = 0.25 + Math.sin(time * 0.008) * 0.1;
        ctx.beginPath();
        ctx.arc(sx, floatY, 24, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;

        // Weapon Model hovering (ONLY the weapon sprite, absolutely NO text/name tags)
        ctx.save();
        ctx.translate(sx, floatY);
        this.drawWeaponSprite(ctx, sp.weaponType, 1.25);
        ctx.restore();
      }
      // When picked up: completely empty pad (no sprite, no icon, no text)
    }

    ctx.restore();
  }

  /**
   * Draw active projectiles
   */
  private drawProjectiles(projectiles: ProjectileState[], time: number) {
    const ctx = this.ctx;
    ctx.save();

    for (const p of projectiles) {
      const angle = Math.atan2(p.vy, p.vx);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(angle);

      if (p.weaponType === 'pebble_blaster') {
        ctx.fillStyle = '#64748B';
        ctx.strokeStyle = '#1E293B';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (p.weaponType === 'pistol') {
        ctx.fillStyle = '#F59E0B';
        ctx.strokeStyle = '#B45309';
        ctx.lineWidth = 1.5;
        ctx.fillRect(-7, -2.5, 14, 5);
        ctx.strokeRect(-7, -2.5, 14, 5);
      } else if (p.weaponType === 'burst_smg') {
        ctx.fillStyle = '#38BDF8';
        ctx.strokeStyle = '#0284C7';
        ctx.lineWidth = 1.5;
        ctx.fillRect(-8, -2, 16, 4);
        ctx.strokeRect(-8, -2, 16, 4);
      } else if (p.weaponType === 'shotgun') {
        ctx.fillStyle = '#F97316';
        ctx.beginPath();
        ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.weaponType === 'rifle') {
        ctx.fillStyle = '#84CC16';
        ctx.strokeStyle = '#4D7C0F';
        ctx.lineWidth = 1.5;
        ctx.fillRect(-14, -2.5, 28, 5);
        ctx.strokeRect(-14, -2.5, 28, 5);
      } else if (p.weaponType === 'flame_gun') {
        const flameSize = 8 + (1 - p.life / p.maxLife) * 12;
        ctx.fillStyle = Math.random() < 0.5 ? '#EF4444' : '#F97316';
        ctx.beginPath();
        ctx.arc(0, 0, flameSize, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.weaponType === 'grenade_launcher') {
        ctx.fillStyle = '#4D7C0F';
        ctx.strokeStyle = '#1E293B';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 7.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // Pin/cap
        ctx.fillStyle = '#F59E0B';
        ctx.fillRect(-3, -9, 6, 3);
      } else if (p.weaponType === 'heavy_cannon') {
        ctx.fillStyle = '#0F172A';
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // Highlight glint
        ctx.fillStyle = '#94A3B8';
        ctx.beginPath();
        ctx.arc(-3, -3, 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.weaponType === 'rocket_launcher') {
        // Rocket body
        ctx.fillStyle = '#DC2626';
        ctx.strokeStyle = '#1E293B';
        ctx.lineWidth = 2;
        ctx.fillRect(-14, -5, 22, 10);
        ctx.strokeRect(-14, -5, 22, 10);
        // Nosecone
        ctx.beginPath();
        ctx.moveTo(8, -5);
        ctx.lineTo(16, 0);
        ctx.lineTo(8, 5);
        ctx.closePath();
        ctx.fillStyle = '#FACC15';
        ctx.fill();
        ctx.stroke();
        // Exhaust fire
        ctx.fillStyle = '#F97316';
        ctx.beginPath();
        ctx.moveTo(-14, -3);
        ctx.lineTo(-24, 0);
        ctx.lineTo(-14, 3);
        ctx.closePath();
        ctx.fill();
      } else if (p.weaponType === 'railgun') {
        // Electric hyper beam
        ctx.fillStyle = '#C084FC';
        ctx.strokeStyle = '#7E22CE';
        ctx.lineWidth = 2.5;
        ctx.fillRect(-22, -4, 44, 8);
        ctx.strokeRect(-22, -4, 44, 8);
        // Core glow
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(-20, -1.5, 40, 3);
      }

      ctx.restore();
    }

    ctx.restore();
  }

  private drawFighter(f: FighterState, time: number) {
    const ctx = this.ctx;
    ctx.save();

    if (f.invincibleTimer > 0 && Math.floor(time * 0.03) % 2 === 0) {
      ctx.globalAlpha = 0.45;
    }

    const cx = f.x;
    const cy = f.y;
    const facing = f.facing;

    // 1. Draw Name Badge & Health Bar above head
    this.drawFighterHUD(f, cx, cy);

    // 2. Shield Bubble
    if (f.isBlocking) {
      this.drawShieldBubble(cx, cy - 38, f.shield, time);
    }

    // 3. Stunned Comic Stars
    if (f.hitStunTimer > 0 && !f.isDead) {
      this.drawStunStars(cx, cy - 96, time);
    }

    // 4. Transform for stickman pose
    ctx.translate(cx, cy);
    ctx.scale(facing, 1);

    ctx.lineWidth = f.gender === 'male' ? 4.2 : 3.6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1E293B';
    ctx.fillStyle = f.color;

    let headX = 0;
    let headY = -62;
    let neckX = 0;
    let neckY = -52;
    let hipX = 0;
    let hipY = -28;

    let leftArmAngle = 0.2;
    let rightArmAngle = -0.3;
    let leftLegAngle = 0.1;
    let rightLegAngle = -0.1;

    let punchExtension = 0;
    let kickExtension = 0;

    if (f.state === 'run') {
      const runCycle = Math.sin(time * 0.015);
      headY += Math.abs(runCycle) * 3;
      neckY += Math.abs(runCycle) * 2;
      hipY += Math.abs(runCycle) * 2;

      leftLegAngle = runCycle * 0.75;
      rightLegAngle = -runCycle * 0.75;
      leftArmAngle = -runCycle * 0.65;
      rightArmAngle = runCycle * 0.65;
    } else if (f.state === 'jump') {
      headY -= 4;
      hipY -= 4;
      leftLegAngle = 0.5;
      rightLegAngle = -0.3;
      leftArmAngle = -1.1;
      rightArmAngle = -0.8;
    } else if (f.state === 'fall') {
      leftLegAngle = -0.4;
      rightLegAngle = 0.4;
      leftArmAngle = -1.4;
      rightArmAngle = -1.4;
    } else if (f.state === 'fast_attack') {
      punchExtension = Math.sin((1 - f.stateTimer / 0.22) * Math.PI) * 28;
      headX += 4;
      hipX += 3;
      rightArmAngle = 0.1;
      leftArmAngle = -0.4;
      rightLegAngle = -0.3;
      leftLegAngle = 0.4;
    } else if (f.state === 'heavy_attack') {
      const progress = 1 - f.stateTimer / 0.38;
      kickExtension = Math.sin(progress * Math.PI) * 34;
      headX -= 6;
      headY += 8;
      hipX += 8;
      leftLegAngle = -1.2;
      rightLegAngle = 1.3;
      leftArmAngle = -1.2;
      rightArmAngle = -1.5;
    } else if (f.state === 'block') {
      headY += 6;
      neckY += 5;
      hipY += 4;
      leftArmAngle = -0.9;
      rightArmAngle = -1.2;
      leftLegAngle = 0.35;
      rightLegAngle = -0.35;
    } else if (f.state === 'hit') {
      headX -= 8;
      headY -= 2;
      hipX -= 6;
      leftArmAngle = -1.4;
      rightArmAngle = 0.6;
      leftLegAngle = -0.5;
      rightLegAngle = 0.7;
    } else if (f.state === 'dead') {
      headX = -35;
      headY = -8;
      neckX = -22;
      neckY = -6;
      hipX = 0;
      hipY = -4;
      leftArmAngle = -0.8;
      rightArmAngle = 0.8;
      leftLegAngle = 0.3;
      rightLegAngle = -0.3;
    } else if (f.state === 'victory') {
      const bounce = Math.abs(Math.sin(time * 0.008)) * 14;
      headY -= bounce;
      neckY -= bounce;
      hipY -= bounce;
      leftArmAngle = -2.2;
      rightArmAngle = -2.2;
    }

    // --- DRAW LIMBS ---

    // 1. Legs
    const legLen = 25;
    const lKneeX = hipX - 5 + Math.sin(leftLegAngle) * (legLen * 0.6);
    const lKneeY = hipY + Math.cos(leftLegAngle) * (legLen * 0.6);
    const lFootX = lKneeX + Math.sin(leftLegAngle * 1.2) * (legLen * 0.6);
    const lFootY = Math.min(0, lKneeY + Math.cos(leftLegAngle * 1.2) * (legLen * 0.6));

    ctx.beginPath();
    ctx.moveTo(hipX - 3, hipY);
    ctx.lineTo(lKneeX, lKneeY);
    ctx.lineTo(lFootX, lFootY);
    ctx.stroke();

    const rKneeX = hipX + 4 + Math.sin(rightLegAngle) * (legLen * 0.6) + kickExtension * 0.4;
    const rKneeY = hipY + Math.cos(rightLegAngle) * (legLen * 0.6) - kickExtension * 0.3;
    const rFootX = rKneeX + Math.sin(rightLegAngle * 1.2) * (legLen * 0.6) + kickExtension * 0.6;
    const rFootY = Math.min(0, rKneeY + Math.cos(rightLegAngle * 1.2) * (legLen * 0.6) - kickExtension * 0.4);

    ctx.beginPath();
    ctx.moveTo(hipX + 3, hipY);
    ctx.lineTo(rKneeX, rKneeY);
    ctx.lineTo(rFootX, rFootY);
    ctx.stroke();

    // 2. Torso
    ctx.beginPath();
    ctx.moveTo(neckX, neckY);
    ctx.lineTo(hipX, hipY);
    ctx.stroke();

    // 3. Arms & Weapon
    const armLen = 22;
    const hasWeapon = !!f.activeWeapon && !f.isDead;

    // Convert world aim angle to local character facing angle
    // In local transformed coordinate space, 0 is straight right (character's forward)
    let localAimAngle = 0;
    if (typeof f.aimAngle === 'number') {
      localAimAngle = facing === 1 ? f.aimAngle : Math.PI - f.aimAngle;
    }

    if (hasWeapon) {
      // Back Arm supports weapon
      const backArmAngle = localAimAngle * 0.5 - 0.2;
      const lElbowX = neckX - 4 + Math.cos(backArmAngle) * (armLen * 0.5);
      const lElbowY = neckY + 4 + Math.sin(backArmAngle) * (armLen * 0.5);
      const lHandX = neckX + Math.cos(localAimAngle) * (armLen * 0.75);
      const lHandY = neckY + Math.sin(localAimAngle) * (armLen * 0.75);

      ctx.beginPath();
      ctx.moveTo(neckX - 2, neckY + 4);
      ctx.lineTo(lElbowX, lElbowY);
      ctx.lineTo(lHandX, lHandY);
      ctx.stroke();

      // Front Arm points directly along local aim angle
      const rShoulderX = neckX + 2;
      const rShoulderY = neckY + 4;
      const rHandX = rShoulderX + Math.cos(localAimAngle) * armLen;
      const rHandY = rShoulderY + Math.sin(localAimAngle) * armLen;

      ctx.beginPath();
      ctx.moveTo(rShoulderX, rShoulderY);
      ctx.lineTo(rHandX, rHandY);
      ctx.stroke();

      // Draw Equipped Weapon attached to Hand
      ctx.save();
      ctx.translate(rHandX, rHandY);
      ctx.rotate(localAimAngle);
      this.drawWeaponSprite(ctx, f.activeWeapon!, 1.0);
      ctx.restore();
    } else {
      // Standard Unarmed Arms
      const lElbowX = neckX - 4 + Math.sin(leftArmAngle) * (armLen * 0.5);
      const lElbowY = neckY + 4 + Math.cos(leftArmAngle) * (armLen * 0.5);
      const lHandX = lElbowX + Math.sin(leftArmAngle * 1.2) * (armLen * 0.5);
      const lHandY = lElbowY + Math.cos(leftArmAngle * 1.2) * (armLen * 0.5);

      ctx.beginPath();
      ctx.moveTo(neckX - 2, neckY + 4);
      ctx.lineTo(lElbowX, lElbowY);
      ctx.lineTo(lHandX, lHandY);
      ctx.stroke();

      const rElbowX = neckX + 4 + Math.sin(rightArmAngle) * (armLen * 0.5) + punchExtension * 0.5;
      const rElbowY = neckY + 4 + Math.cos(rightArmAngle) * (armLen * 0.5) - punchExtension * 0.1;
      const rHandX = rElbowX + Math.sin(rightArmAngle * 1.2) * (armLen * 0.5) + punchExtension * 0.5;
      const rHandY = rElbowY + Math.cos(rightArmAngle * 1.2) * (armLen * 0.5);

      ctx.beginPath();
      ctx.moveTo(neckX + 2, neckY + 4);
      ctx.lineTo(rElbowX, rElbowY);
      ctx.lineTo(rHandX, rHandY);
      ctx.stroke();

      // Punch Glove / Clenched Fist
      ctx.fillStyle = f.hat === 'boxing' ? '#EF4444' : f.color;
      ctx.beginPath();
      ctx.arc(rHandX, rHandY, f.hat === 'boxing' ? 6.5 : 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // 4. Head
    const headRadius = f.gender === 'female' ? 12 : 13;
    ctx.fillStyle = f.color;
    ctx.beginPath();
    ctx.arc(headX, headY, headRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 5. Expressive Eyes
    this.drawFighterFace(ctx, headX, headY, f, time);

    // 6. Hats / Hair
    this.drawFighterAccessories(ctx, headX, headY, f, time);

    ctx.restore();
  }

  /**
   * Draw distinctive weapon sprites for all 10 weapons
   */
  private drawWeaponSprite(ctx: CanvasRenderingContext2D, weaponType: WeaponType, scale: number = 1.0) {
    ctx.save();
    ctx.scale(scale, scale);
    ctx.lineWidth = 2.0;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    switch (weaponType) {
      case 'pebble_blaster':
        // Wooden Slingshot Blaster
        ctx.fillStyle = '#92400E';
        ctx.strokeStyle = '#451A03';
        ctx.fillRect(-4, -3, 10, 6);
        ctx.strokeRect(-4, -3, 10, 6);
        // Fork
        ctx.beginPath();
        ctx.moveTo(6, -5);
        ctx.lineTo(12, -8);
        ctx.moveTo(6, 5);
        ctx.lineTo(12, 8);
        ctx.stroke();
        break;

      case 'pistol':
        // Clean Semi-auto Pistol
        ctx.fillStyle = '#475569';
        ctx.strokeStyle = '#0F172A';
        // Barrel & Slide
        ctx.fillRect(-2, -4, 16, 7);
        ctx.strokeRect(-2, -4, 16, 7);
        // Grip
        ctx.fillStyle = '#1E293B';
        ctx.fillRect(-3, 3, 5, 8);
        ctx.strokeRect(-3, 3, 5, 8);
        break;

      case 'burst_smg':
        // Compact Submachine Gun
        ctx.fillStyle = '#0284C7';
        ctx.strokeStyle = '#0F172A';
        // Main Body
        ctx.fillRect(-4, -5, 20, 8);
        ctx.strokeRect(-4, -5, 20, 8);
        // Magazine
        ctx.fillStyle = '#38BDF8';
        ctx.fillRect(4, 3, 5, 10);
        ctx.strokeRect(4, 3, 5, 10);
        // Grip
        ctx.fillStyle = '#1E293B';
        ctx.fillRect(-4, 3, 5, 7);
        ctx.strokeRect(-4, 3, 5, 7);
        break;

      case 'shotgun':
        // Double-barrel Shotgun
        ctx.fillStyle = '#78350F';
        ctx.strokeStyle = '#451A03';
        // Stock
        ctx.fillRect(-10, -1, 10, 7);
        ctx.strokeRect(-10, -1, 10, 7);
        // Twin Barrels
        ctx.fillStyle = '#64748B';
        ctx.strokeStyle = '#0F172A';
        ctx.fillRect(0, -5, 24, 8);
        ctx.strokeRect(0, -5, 24, 8);
        break;

      case 'rifle':
        // Precision Marksman Rifle
        ctx.fillStyle = '#15803D';
        ctx.strokeStyle = '#0F172A';
        // Long Barrel
        ctx.fillRect(-8, -3, 32, 6);
        ctx.strokeRect(-8, -3, 32, 6);
        // Scope
        ctx.fillStyle = '#1E293B';
        ctx.fillRect(2, -8, 12, 4);
        ctx.strokeRect(2, -8, 12, 4);
        // Stock
        ctx.fillRect(-14, 0, 7, 8);
        ctx.strokeRect(-14, 0, 7, 8);
        break;

      case 'flame_gun':
        // Canister Flamethrower
        ctx.fillStyle = '#EA580C';
        ctx.strokeStyle = '#0F172A';
        // Barrel Nozzle
        ctx.fillRect(-2, -4, 20, 8);
        ctx.strokeRect(-2, -4, 8, 8);
        // Fuel Tank
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.arc(3, 7, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;

      case 'grenade_launcher':
        // Revolving Grenade Launcher
        ctx.fillStyle = '#4D7C0F';
        ctx.strokeStyle = '#0F172A';
        // Fat Barrel
        ctx.fillRect(4, -6, 16, 11);
        ctx.strokeRect(4, -6, 16, 11);
        // Revolving Cylinder
        ctx.fillStyle = '#65A30D';
        ctx.beginPath();
        ctx.arc(-2, 0, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;

      case 'heavy_cannon':
        // Heavy Steampunk Cannon
        ctx.fillStyle = '#334155';
        ctx.strokeStyle = '#0F172A';
        // Cannon Bell
        ctx.beginPath();
        ctx.moveTo(-6, -8);
        ctx.lineTo(20, -10);
        ctx.lineTo(20, 10);
        ctx.lineTo(-6, 8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Brass Ring
        ctx.fillStyle = '#F59E0B';
        ctx.fillRect(8, -10, 4, 20);
        ctx.strokeRect(8, -10, 4, 20);
        break;

      case 'rocket_launcher':
        // Shoulder Rocket Tube
        ctx.fillStyle = '#DC2626';
        ctx.strokeStyle = '#0F172A';
        // Tube
        ctx.fillRect(-12, -7, 30, 13);
        ctx.strokeRect(-12, -7, 30, 13);
        // Warhead Tip
        ctx.fillStyle = '#FACC15';
        ctx.beginPath();
        ctx.moveTo(18, -6);
        ctx.lineTo(26, 0);
        ctx.lineTo(18, 6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;

      case 'railgun':
        // High-voltage Plasma Accelerator
        ctx.fillStyle = '#7C3AED';
        ctx.strokeStyle = '#0F172A';
        // Accelerator Prongs
        ctx.fillRect(-6, -7, 28, 4);
        ctx.strokeRect(-6, -7, 28, 4);
        ctx.fillRect(-6, 3, 28, 4);
        ctx.strokeRect(-6, 3, 28, 4);
        // Glowing Core
        ctx.fillStyle = '#C084FC';
        ctx.beginPath();
        ctx.arc(3, 0, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;
    }

    ctx.restore();
  }

  private drawFighterHUD(f: FighterState, cx: number, cy: number) {
    const ctx = this.ctx;
    ctx.save();

    // 1. Name Tag Badge
    ctx.font = '700 12px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const nameMetrics = ctx.measureText(f.name);
    const badgeW = Math.max(56, nameMetrics.width + 20);
    const badgeH = 18;
    const nameY = cy - 122;

    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    this.roundRect(ctx, cx - badgeW / 2, nameY, badgeW, badgeH, 5);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = f.color;
    ctx.beginPath();
    ctx.arc(cx - badgeW / 2 + 9, nameY + badgeH / 2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#000000';
    ctx.fillText(f.name, cx + 4, nameY + badgeH / 2 + 0.5);

    // 2. Health Bar
    const hpBarW = 62;
    const hpBarH = 7;
    const hpY = cy - 101;

    ctx.fillStyle = '#1E293B';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    this.roundRect(ctx, cx - hpBarW / 2, hpY, hpBarW, hpBarH, 3);
    ctx.fill();
    ctx.stroke();

    const hpPct = Math.max(0, Math.min(1, f.hp / f.maxHp));
    if (hpPct > 0) {
      ctx.fillStyle = hpPct > 0.5 ? '#22C55E' : hpPct > 0.25 ? '#F59E0B' : '#EF4444';
      this.roundRect(ctx, cx - hpBarW / 2 + 1, hpY + 1, (hpBarW - 2) * hpPct, hpBarH - 2, 2);
      ctx.fill();
    }

    if (f.shield > 0 && f.shield < 100) {
      const shieldW = hpBarW * (f.shield / 100);
      ctx.fillStyle = '#38BDF8';
      ctx.fillRect(cx - hpBarW / 2, hpY + hpBarH + 1, shieldW, 2);
    }

    ctx.restore();
  }

  private drawFighterFace(
    ctx: CanvasRenderingContext2D,
    hx: number,
    hy: number,
    f: FighterState,
    time: number
  ) {
    ctx.save();
    const isBlinking = !f.isDead && f.state !== 'hit' && Math.sin(time * 0.003 + parseInt(f.id, 36) || 0) > 0.96;

    if (f.isDead) {
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 2.5;

      ctx.beginPath();
      ctx.moveTo(hx + 1, hy - 4);
      ctx.lineTo(hx + 7, hy + 2);
      ctx.moveTo(hx + 7, hy - 4);
      ctx.lineTo(hx + 1, hy + 2);
      ctx.stroke();
    } else if (f.state === 'hit') {
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(hx + 4, hy - 1, 4, 0, Math.PI * 1.6);
      ctx.stroke();
    } else if (isBlinking) {
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(hx + 2, hy - 1);
      ctx.lineTo(hx + 7, hy - 1);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 1.8;

      ctx.beginPath();
      ctx.ellipse(hx + 4.5, hy - 1.5, 4, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(hx + 6, hy - 1.5, 2, 0, Math.PI * 2);
      ctx.fill();

      if (f.state === 'fast_attack' || f.state === 'heavy_attack' || f.state === 'block') {
        ctx.strokeStyle = '#0F172A';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(hx + 2, hy - 7);
        ctx.lineTo(hx + 8, hy - 5);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  private drawFighterAccessories(
    ctx: CanvasRenderingContext2D,
    hx: number,
    hy: number,
    f: FighterState,
    time: number
  ) {
    ctx.save();
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 2.5;

    if (f.gender === 'female') {
      const ponytailSway = Math.sin(time * 0.01 + f.vx * 0.2) * 5;
      ctx.fillStyle = '#FB7185';
      ctx.beginPath();
      ctx.moveTo(hx - 8, hy - 2);
      ctx.quadraticCurveTo(hx - 18, hy - 6 + ponytailSway, hx - 22, hy + 8 + ponytailSway);
      ctx.quadraticCurveTo(hx - 14, hy + 2, hx - 8, hy + 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#F43F5E';
      ctx.beginPath();
      ctx.arc(hx - 9, hy - 1, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    const hat = f.hat;

    if (hat === 'headband') {
      ctx.fillStyle = '#EF4444';
      ctx.fillRect(hx - 13, hy - 6, 26, 5);
      ctx.strokeRect(hx - 13, hy - 6, 26, 5);

      const tailWave = Math.sin(time * 0.015) * 4;
      ctx.beginPath();
      ctx.moveTo(hx - 12, hy - 3);
      ctx.quadraticCurveTo(hx - 22, hy - 8 + tailWave, hx - 28, hy - 2 + tailWave);
      ctx.lineTo(hx - 24, hy + 4);
      ctx.lineTo(hx - 12, hy);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (hat === 'cowboy') {
      ctx.fillStyle = '#92400E';
      ctx.beginPath();
      ctx.ellipse(hx, hy - 12, 18, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.roundRect(hx - 9, hy - 24, 18, 14, 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#FBBF24';
      ctx.fillRect(hx - 9, hy - 15, 18, 3);
    } else if (hat === 'cap') {
      ctx.fillStyle = '#0284C7';
      ctx.beginPath();
      ctx.roundRect(hx - 11, hy - 18, 22, 10, 4);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(hx + 4, hy - 10);
      ctx.lineTo(hx + 18, hy - 8);
      ctx.lineTo(hx + 10, hy - 13);
      ctx.closePath();
      ctx.fillStyle = '#0369A1';
      ctx.fill();
      ctx.stroke();
    } else if (hat === 'crown') {
      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.moveTo(hx - 11, hy - 11);
      ctx.lineTo(hx - 11, hy - 22);
      ctx.lineTo(hx - 5, hy - 16);
      ctx.lineTo(hx, hy - 24);
      ctx.lineTo(hx + 5, hy - 16);
      ctx.lineTo(hx + 11, hy - 22);
      ctx.lineTo(hx + 11, hy - 11);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.arc(hx, hy - 15, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (hat === 'ninja') {
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(hx - 13, hy - 1, 26, 12);
      ctx.strokeRect(hx - 13, hy - 1, 26, 12);
    } else if (hat === 'horns') {
      ctx.fillStyle = '#DC2626';
      ctx.beginPath();
      ctx.moveTo(hx - 6, hy - 11);
      ctx.quadraticCurveTo(hx - 14, hy - 22, hx - 12, hy - 25);
      ctx.quadraticCurveTo(hx - 5, hy - 18, hx - 2, hy - 12);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(hx + 6, hy - 11);
      ctx.quadraticCurveTo(hx + 14, hy - 22, hx + 12, hy - 25);
      ctx.quadraticCurveTo(hx + 5, hy - 18, hx + 2, hy - 12);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (hat === 'ribbon') {
      ctx.fillStyle = '#EC4899';
      ctx.beginPath();
      ctx.moveTo(hx, hy - 12);
      ctx.lineTo(hx - 10, hy - 20);
      ctx.lineTo(hx - 9, hy - 11);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(hx, hy - 12);
      ctx.lineTo(hx + 10, hy - 20);
      ctx.lineTo(hx + 9, hy - 11);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(hx, hy - 12, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawShieldBubble(cx: number, cy: number, shieldPower: number, time: number) {
    const ctx = this.ctx;
    ctx.save();
    const alpha = (shieldPower / 100) * 0.45 + Math.sin(time * 0.01) * 0.1;
    ctx.fillStyle = '#38BDF8';
    ctx.globalAlpha = Math.max(0.1, alpha);
    ctx.strokeStyle = '#0284C7';
    ctx.lineWidth = 3.5;

    ctx.beginPath();
    ctx.arc(cx, cy, 48, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  private drawStunStars(cx: number, cy: number, time: number) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = '#FACC15';
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 1.8;

    for (let i = 0; i < 3; i++) {
      const angle = time * 0.008 + (i * Math.PI * 2) / 3;
      const sx = cx + Math.cos(angle) * 22;
      const sy = cy + Math.sin(angle) * 8;
      this.drawStar(ctx, sx, sy, 4, 7, 3);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawStar(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    spikes: number,
    outerRadius: number,
    innerRadius: number
  ) {
    let rot = (Math.PI / 2) * 3;
    let x = cx;
    let y = cy;
    const step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
      x = cx + Math.cos(rot) * outerRadius;
      y = cy + Math.sin(rot) * outerRadius;
      ctx.lineTo(x, y);
      rot += step;

      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      ctx.lineTo(x, y);
      rot += step;
    }
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
  }

  private drawParticles(particles: Particle[]) {
    const ctx = this.ctx;
    ctx.save();

    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.alpha);

      if (p.shape === 'dust') {
        ctx.fillStyle = '#CBD5E1';
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (p.shape === 'star') {
        ctx.fillStyle = p.color || '#FBBF24';
        ctx.strokeStyle = '#1E293B';
        ctx.lineWidth = 2;
        this.drawStar(ctx, p.x, p.y, 4, p.size, p.size * 0.4);
        ctx.fill();
        ctx.stroke();
      } else if (p.shape === 'spark') {
        ctx.strokeStyle = p.color || '#F59E0B';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + p.vx * 3, p.y + p.vy * 3);
        ctx.stroke();
      } else if (p.shape === 'line') {
        ctx.strokeStyle = '#0284C7';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(p.x - 20, p.y);
        ctx.lineTo(p.x + 20, p.y);
        ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  private drawComicPops(pops: ComicPop[]) {
    const ctx = this.ctx;

    for (const pop of pops) {
      const now = Date.now();
      const elapsed = now - pop.createdAt;
      if (elapsed > pop.duration) continue;

      const progress = elapsed / pop.duration;
      const scale = progress < 0.2 ? (progress / 0.2) * 1.25 : Math.max(0.8, 1.25 - (progress - 0.2) * 0.4);
      const floatY = pop.y - progress * 40;
      const alpha = progress > 0.75 ? (1 - progress) / 0.25 : 1;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(pop.x, floatY);
      ctx.rotate(pop.rotation);
      ctx.scale(scale, scale);

      this.drawStarburst(ctx, 0, 0, 42, 24, 12, pop.bgHex || '#FDE047');

      ctx.font = '900 24px "Plus Jakarta Sans", Impact, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 5;
      ctx.strokeText(pop.text, 0, 0);

      ctx.fillStyle = pop.color || '#EF4444';
      ctx.fillText(pop.text, 0, 0);

      ctx.restore();
    }
  }

  private drawStarburst(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    outerR: number,
    innerR: number,
    points: number,
    fillColor: string
  ) {
    let rot = (Math.PI / 2) * 3;
    const step = Math.PI / points;

    ctx.fillStyle = fillColor;
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerR);
    for (let i = 0; i < points; i++) {
      let x = cx + Math.cos(rot) * outerR;
      let y = cy + Math.sin(rot) * outerR;
      ctx.lineTo(x, y);
      rot += step;

      x = cx + Math.cos(rot) * innerR;
      y = cy + Math.sin(rot) * innerR;
      ctx.lineTo(x, y);
      rot += step;
    }
    ctx.lineTo(cx, cy - outerR);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  private drawComicCloud(x: number, y: number, r: number) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#2D3748';
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.arc(x, y, r * 0.6, 0, Math.PI * 2);
    ctx.arc(x + r * 0.5, y - r * 0.2, r * 0.7, 0, Math.PI * 2);
    ctx.arc(x + r * 1.1, y, r * 0.55, 0, Math.PI * 2);
    ctx.arc(x + r * 0.5, y + r * 0.2, r * 0.6, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#E2E8F0';
    ctx.beginPath();
    ctx.arc(x + r * 0.5, y + r * 0.2, r * 0.45, 0, Math.PI);
    ctx.fill();

    ctx.restore();
  }

  private drawCartoonTree(x: number, y: number, size: number) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = '#8D6E63';
    ctx.strokeStyle = '#2D3748';
    ctx.lineWidth = 3;
    ctx.fillRect(x - 10, y, 20, 80);
    ctx.strokeRect(x - 10, y, 20, 80);

    ctx.fillStyle = '#4CAF50';
    ctx.beginPath();
    ctx.arc(x, y - 20, size, 0, Math.PI * 2);
    ctx.arc(x - size * 0.5, y, size * 0.7, 0, Math.PI * 2);
    ctx.arc(x + size * 0.5, y, size * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#FF3B30';
    ctx.beginPath();
    ctx.arc(x - 15, y - 25, 6, 0, Math.PI * 2);
    ctx.arc(x + 18, y - 10, 6, 0, Math.PI * 2);
    ctx.arc(x, y + 10, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  private drawBunting(x1: number, y1: number, x2: number, y2: number, time: number) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = '#4A5568';
    ctx.lineWidth = 2.5;

    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2 + 35;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(midX, midY, x2, y2);
    ctx.stroke();

    const colors = ['#FF4081', '#FFD54F', '#00E676', '#00B0FF', '#7C4DFF'];
    const steps = 9;
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const fx = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * midX + t * t * x2;
      const fy = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * midY + t * t * y2;
      const sway = Math.sin(time * 0.003 + i) * 4;

      ctx.fillStyle = colors[i % colors.length];
      ctx.strokeStyle = '#2D3748';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(fx - 10, fy);
      ctx.lineTo(fx + 10, fy);
      ctx.lineTo(fx + sway, fy + 22);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawRainbow(cx: number, cy: number, radius: number) {
    const ctx = this.ctx;
    const bands = ['#FF8A80', '#FFD180', '#FFFF8D', '#CCFF90', '#80D8FF', '#B388FF'];
    ctx.save();
    ctx.globalAlpha = 0.55;
    bands.forEach((color, i) => {
      ctx.beginPath();
      ctx.arc(cx, cy, radius + i * 9, Math.PI, 0);
      ctx.strokeStyle = color;
      ctx.lineWidth = 9;
      ctx.stroke();
    });
    ctx.restore();
  }

  private drawFloatingMiniRock(x: number, y: number, size: number, time: number) {
    const ctx = this.ctx;
    const floatY = y + Math.sin(time * 0.002) * 12;
    ctx.save();
    ctx.fillStyle = '#8D6E63';
    ctx.strokeStyle = '#2D3748';
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.moveTo(x - size, floatY);
    ctx.lineTo(x + size, floatY);
    ctx.lineTo(x, floatY + size * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  private drawFlag(x: number, y: number, color: string, time: number) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = '#1F2937';
    ctx.fillRect(x - 2, y, 4, 60);

    const wave = Math.sin(time * 0.01) * 8;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x + 2, y);
    ctx.quadraticCurveTo(x + 20, y - 5 + wave, x + 35, y + 5 + wave);
    ctx.lineTo(x + 2, y + 20);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  }
}
