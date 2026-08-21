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
  private lastRenderTime: number = 0;
  private textWidthCache: Map<string, number> = new Map();
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

  private isInView(x: number, y: number, w: number, h: number, margin: number = 100): boolean {
    const halfW = (this.width / 2) / this.camera.zoom + margin;
    const halfH = (this.height / 2) / this.camera.zoom + margin;
    return !(x + w < this.camera.x - halfW || x > this.camera.x + halfW ||
             y + h < this.camera.y - halfH || y > this.camera.y + halfH);
  }

  public triggerShake(intensity: number = 8, duration: number = 0.25) {
    this.camera.shakeIntensity = intensity;
    this.camera.shakeTime = duration;
  }

  private electricScreenTimer: number = 0;
  private fireScreenTimer: number = 0;

  public triggerElectricPulse(duration: number = 0.15) {
    this.electricScreenTimer = duration;
  }

  public triggerFirePulse(duration: number = 0.12) {
    this.fireScreenTimer = duration;
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
    projectiles: ProjectileState[] = [],
    burningGround: any[] = []
  ) {
    const ctx = this.ctx;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let dt = this.lastRenderTime ? (time - this.lastRenderTime) / 1000 : 1 / 60;
    if (dt <= 0 || dt > 0.1) dt = 1 / 60;
    this.lastRenderTime = time;

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

      // 3. Draw Burning Ground Flames
      if (burningGround && burningGround.length > 0) {
        this.drawBurningGround(burningGround, time);
      }

      // 4. Draw Weapon Spawns
      this.drawWeaponSpawns(weaponSpawns, time);

      // 5. Draw Projectiles
      this.drawProjectiles(projectiles, time);

      // 6. Draw Particles (dust, speed lines, sparks)
      this.drawParticles(particles);

      // 7. Draw Fighters (with Aim-rotated arms & weapons)
      for (const f of fighters) {
        this.drawFighter(f, time);
      }

      // 8. Draw Comic Pops ("POW!", "BAM!", "KABOOM!")
      this.drawComicPops(comicPops);
    } finally {
      ctx.restore();
    }

    // Screen Flash Overlay Effects (Controlled short pulses)
    if (this.electricScreenTimer > 0) {
      this.electricScreenTimer -= dt;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#38BDF8';
      ctx.globalAlpha = Math.min(0.28, (this.electricScreenTimer / 0.15) * 0.28);
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.restore();
    }

    if (this.fireScreenTimer > 0) {
      this.fireScreenTimer -= dt;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#EF4444';
      ctx.globalAlpha = Math.min(0.24, (this.fireScreenTimer / 0.12) * 0.24);
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.restore();
    }
  }

  private drawBurningGround(burningGround: any[], time: number) {
    const ctx = this.ctx;
    ctx.save();

    for (const bg of burningGround) {
      if (!this.isInView(bg.x - bg.width / 2, bg.y - 20, bg.width, 24)) continue;
      const alpha = Math.min(1, bg.life / 0.5);
      ctx.globalAlpha = alpha;

      ctx.fillStyle = '#EF4444';
      ctx.fillRect(bg.x - bg.width / 2, bg.y - 4, bg.width, 8);

      ctx.fillStyle = Math.random() < 0.5 ? '#F97316' : '#FACC15';
      for (let fx = bg.x - bg.width / 2 + 6; fx <= bg.x + bg.width / 2 - 6; fx += 14) {
        const flameH = 16 + Math.sin(time * 0.02 + fx) * 8;
        ctx.beginPath();
        ctx.moveTo(fx - 6, bg.y);
        ctx.lineTo(fx, bg.y - flameH);
        ctx.lineTo(fx + 6, bg.y);
        ctx.closePath();
        ctx.fill();
      }
    }

    ctx.restore();
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
      ctx.closePath();
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
      ctx.closePath();
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
      ctx.closePath();
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
      ctx.closePath();
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
    } else if (arena.theme === 'mystery_mountain' || arena.theme === 'mystery_sky') {
      // Stormpeak Mountain Backdrop: Light slate alpine peaks, storm clouds, bright atmosphere
      ctx.fillStyle = '#CBD5E1';
      ctx.strokeStyle = '#64748B';
      ctx.lineWidth = 4;

      ctx.beginPath();
      ctx.moveTo(0, arena.height - 800);
      for (let mx = 0; mx <= arena.width; mx += 800) {
        ctx.lineTo(mx + 400, arena.height - 1800);
        ctx.lineTo(mx + 800, arena.height - 800);
      }
      ctx.lineTo(arena.width, arena.height);
      ctx.lineTo(0, arena.height);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      for (let cx = 350; cx < arena.width; cx += 700) {
        this.drawComicCloud(cx, 400 + Math.sin(cx * 0.01 + time * 0.0005) * 60, 120);
      }
    } else if (arena.theme === 'mystery_jungle' || arena.theme === 'mystery_depths') {
      // Primordial Jungle Backdrop: Lush rainforest canopy, ancient stone ruins, vibrant foliage
      ctx.fillStyle = '#16A34A';
      ctx.strokeStyle = '#15803D';
      ctx.lineWidth = 4;

      ctx.beginPath();
      ctx.moveTo(0, arena.height - 700);
      for (let jx = 0; jx <= arena.width; jx += 600) {
        ctx.quadraticCurveTo(jx + 300, arena.height - 1100, jx + 600, arena.height - 700);
      }
      ctx.lineTo(arena.width, arena.height);
      ctx.lineTo(0, arena.height);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      for (let tx = 400; tx < arena.width; tx += 650) {
        ctx.fillStyle = '#854D0E';
        ctx.strokeStyle = '#543007';
        ctx.fillRect(tx, 300, 90, arena.height - 300);
        ctx.strokeRect(tx, 300, 90, arena.height - 300);
        this.drawCartoonTree(tx + 45, 260, 140);
      }
    } else if (arena.theme === 'mystery_volcanic' || arena.theme === 'mystery_void') {
      // Obsidian Volcanic Rift Backdrop: Warm terracotta rock cliffs, glowing orange lava pools
      ctx.fillStyle = '#D97706';
      ctx.strokeStyle = '#92400E';
      ctx.lineWidth = 4;

      ctx.beginPath();
      ctx.moveTo(0, arena.height - 500);
      for (let vx = 0; vx <= arena.width; vx += 700) {
        ctx.lineTo(vx + 350, arena.height - 1200);
        ctx.lineTo(vx + 700, arena.height - 500);
      }
      ctx.lineTo(arena.width, arena.height);
      ctx.lineTo(0, arena.height);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Bubbling Lava Floor Pool at bottom of volcanic rift
      ctx.fillStyle = '#F97316';
      ctx.strokeStyle = '#EF4444';
      ctx.fillRect(0, arena.height - 160, arena.width, 160);
      ctx.strokeRect(0, arena.height - 160, arena.width, 160);

      ctx.fillStyle = '#FDE047';
      for (let lx = 100; lx < arena.width; lx += 220) {
        const bubble = Math.sin(time * 0.004 + lx) * 10;
        ctx.beginPath();
        ctx.arc(lx, arena.height - 140 + bubble, 18, 0, Math.PI * 2);
        ctx.fill();
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

      if (!this.isInView(px, py, pw, ph)) continue;

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
   * Draw weapon spawns on the map
   * - Available: Only weapon sprite + subtle halo glow (NO MARKERS, NO LINES, NO TEXT)
   * - Picked Up: Completely empty (NO SPRITE, NO MARKER, NO SILHOUETTE, NO TEXT)
   */
  private drawWeaponSpawns(spawns: ActiveWeaponSpawn[], time: number) {
    const ctx = this.ctx;
    ctx.save();

    for (const sp of spawns) {
      if (!sp.isAvailable) continue; // When picked up / during cooldown: COMPLETELY EMPTY!
      if (!this.isInView(sp.x - 24, sp.y - 24, 48, 48)) continue;

      const config = WEAPONS_CONFIG[sp.weaponType];
      if (!config) continue;

      const sx = sp.x;
      const sy = sp.y;

      // Floating Halo Glow
      const bob = Math.sin(time * 0.005 + sx) * 6;
      const floatY = sy - 8 + bob;

      ctx.fillStyle = config.color;
      ctx.globalAlpha = 0.25 + Math.sin(time * 0.008) * 0.1;
      ctx.beginPath();
      ctx.arc(sx, floatY, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1.0;

      // Weapon Model hovering (ONLY the weapon sprite, absolutely NO floor lines / text / markers)
      ctx.save();
      ctx.translate(sx, floatY);
      const spawnScale = config.spawnScale || (config.isSuper ? 0.7 : 1.25);
      this.drawWeaponSprite(ctx, sp.weaponType, spawnScale);
      ctx.restore();
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
      if (!this.isInView(p.x - 20, p.y - 20, 40, 40)) continue;
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
      } else if (p.weaponType === 'infinite_gun') {
        // Massive Heavy Rotary Armor-Piercing Tracer Bullet
        ctx.fillStyle = '#F59E0B';
        ctx.strokeStyle = '#B45309';
        ctx.lineWidth = 2.5;
        ctx.fillRect(-14, -4, 28, 8);
        ctx.strokeRect(-14, -4, 28, 8);
        // Bright white core & outer glow
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(-10, -2, 20, 4);
      } else if (p.weaponType === 'inferno_cannon' || p.isFlame) {
        // Massive Dragonhead Flame Stream
        const flameSize = 14 + (1 - p.life / p.maxLife) * 22;
        ctx.fillStyle = Math.random() < 0.5 ? '#EF4444' : Math.random() < 0.5 ? '#F97316' : '#FACC15';
        ctx.beginPath();
        ctx.arc(0, 0, flameSize, 0, Math.PI * 2);
        ctx.fill();

        // Outer fire sparks
        ctx.fillStyle = '#FACC15';
        ctx.beginPath();
        ctx.arc(-flameSize * 0.4, (Math.random() - 0.5) * 10, flameSize * 0.4, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.weaponType === 'thunder_sword') {
        // Thunder Lightning Bolt Arc
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(-40, 0);
        for (let lx = -30; lx <= 40; lx += 15) {
          ctx.lineTo(lx, (Math.random() - 0.5) * 18);
        }
        ctx.stroke();

        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();
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

    // 1.5 Cosmetic Effects (Auras/Trails)
    this.drawFighterCosmeticEffects(cx, cy, f, time);

    // 2. Shield Bubble
    if (f.isBlocking) {
      this.drawShieldBubble(cx, cy - 38, f.shield, time);
    }

    // 3. Stunned Comic Stars
    if (f.hitStunTimer > 0 && !f.isDead) {
      this.drawStunStars(cx, cy - 96, time);
    }

    // 4. Burning Flame Aura (Inferno Cannon hit)
    if (f.burningTimer && f.burningTimer > 0 && !f.isDead) {
      ctx.save();
      ctx.fillStyle = Math.random() < 0.5 ? '#EF4444' : '#F97316';
      for (let fi = 0; fi < 5; fi++) {
        const fx = cx + (Math.random() - 0.5) * 32;
        const fy = cy - Math.random() * 60;
        const fr = Math.random() * 7 + 4;
        ctx.beginPath();
        ctx.arc(fx, fy, fr, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 4. Transform for stickman pose
    ctx.translate(cx, cy);
    ctx.scale(facing, 1);

    // Color Setup (Support skin tones and custom primary/secondary colors)
    let bodyColor = f.color || '#FF5733';
    if (f.skin === 'light') bodyColor = '#FDE047';
    else if (f.skin === 'tan') bodyColor = '#EAB308';
    else if (f.skin === 'dark') bodyColor = '#8D6E63';
    else if (f.skin === 'shadow') bodyColor = '#0F172A';
    else if (f.skin === 'alien') bodyColor = '#22C55E';
    else if (f.skin === 'cyber') bodyColor = '#94A3B8';
    else if (f.skin === 'golden') bodyColor = '#FACC15';
    else if (f.skin === 'neon') bodyColor = '#06B6D4';

    ctx.lineWidth = f.gender === 'male' ? 4.2 : 3.6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = f.skin === 'shadow' ? '#38BDF8' : '#1E293B';
    ctx.fillStyle = bodyColor;

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
      const runCycle = Math.sin(time * 0.012);
      const verticalBob = (1 - Math.cos(time * 0.024)) * 1.5;
      headY += verticalBob;
      neckY += verticalBob * 0.7;
      hipY += verticalBob * 0.7;

      leftLegAngle = runCycle * 0.65;
      rightLegAngle = -runCycle * 0.65;
      leftArmAngle = -runCycle * 0.55;
      rightArmAngle = runCycle * 0.55;
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

    // --- COSMETIC LAYER 1: Back Items (Capes, Backpacks, Wings, Jetpacks) ---
    this.drawFighterBackCosmetics(ctx, neckX, neckY, f, time);

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

    // --- COSMETIC LAYER 2: Shoes ---
    this.drawFighterShoes(ctx, lFootX, lFootY, rFootX, rFootY, f);

    // 2. Torso
    ctx.beginPath();
    ctx.moveTo(neckX, neckY);
    ctx.lineTo(hipX, hipY);
    ctx.stroke();

    // --- COSMETIC LAYER 3: Outfit / Clothes ---
    this.drawFighterOutfit(ctx, neckX, neckY, hipX, hipY, f);

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
      const weaponCfg = WEAPONS_CONFIG[f.activeWeapon!];
      const heldScale = weaponCfg?.heldScale || (weaponCfg?.isSuper ? 2.4 : 1.0);
      this.drawWeaponSprite(ctx, f.activeWeapon!, heldScale);

      // Super weapon held visual electric/fire effects
      if (weaponCfg?.id === 'thunder_sword') {
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let i = 0; i < 4; i++) {
          const rx = (Math.random() - 0.5) * 45;
          const ry = (Math.random() - 0.5) * 45;
          ctx.moveTo(rx, ry);
          ctx.lineTo(rx + (Math.random() - 0.5) * 20, ry + (Math.random() - 0.5) * 20);
        }
        ctx.stroke();
      } else if (weaponCfg?.id === 'inferno_cannon') {
        ctx.fillStyle = Math.random() < 0.5 ? '#EF4444' : '#F97316';
        ctx.beginPath();
        ctx.arc(36, 0, 10 + Math.random() * 8, 0, Math.PI * 2);
        ctx.fill();
      } else if (weaponCfg?.id === 'infinite_gun' && f.weaponCooldown > 0) {
        ctx.fillStyle = '#F59E0B';
        ctx.beginPath();
        ctx.arc(34, 0, 12, 0, Math.PI * 2);
        ctx.fill();
      }
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
      ctx.fillStyle = f.hat === 'boxing' ? '#EF4444' : bodyColor;
      ctx.beginPath();
      ctx.arc(rHandX, rHandY, f.hat === 'boxing' ? 6.5 : 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // 4. Head Body
    const headRadius = f.gender === 'female' ? 12 : 13;
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.arc(headX, headY, headRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // --- COSMETIC LAYER 4: Hair ---
    this.drawFighterHair(ctx, headX, headY, f, time);

    // --- COSMETIC LAYER 5: Headwear / Hats ---
    this.drawFighterHeadwear(ctx, headX, headY, f, time);

    // --- COSMETIC LAYER 6: Face Accessories & Expressive Eyes ---
    this.drawFighterFace(ctx, headX, headY, f, time);
    this.drawFighterFaceCosmetics(ctx, headX, headY, f);

    // --- COSMETIC LAYER 7: Front Accessories (Necklaces, Ties, Ammo Belts, Flowers) ---
    this.drawFighterFrontAccessories(ctx, neckX, neckY, headX, headY, f);

    ctx.restore();
  }

  private drawFighterCosmeticEffects(cx: number, cy: number, f: FighterState, time: number) {
    if (!f.effect || f.effect === 'none' || f.isDead) return;
    const ctx = this.ctx;
    ctx.save();

    if (f.effect === 'hearts') {
      ctx.fillStyle = '#F472B6';
      for (let i = 0; i < 3; i++) {
        const floatY = cy - 20 - ((time * 0.05 + i * 20) % 55);
        const floatX = cx + Math.sin(time * 0.005 + i) * 16;
        ctx.beginPath();
        ctx.arc(floatX - 3, floatY - 3, 4, Math.PI, 0);
        ctx.arc(floatX + 3, floatY - 3, 4, Math.PI, 0);
        ctx.lineTo(floatX, floatY + 5);
        ctx.closePath();
        ctx.fill();
      }
    } else if (f.effect === 'stars') {
      ctx.fillStyle = '#FACC15';
      for (let i = 0; i < 4; i++) {
        const angle = time * 0.003 + i * (Math.PI / 2);
        const floatX = cx + Math.cos(angle) * 32;
        const floatY = cy - 35 + Math.sin(angle) * 12;
        ctx.beginPath();
        ctx.arc(floatX, floatY, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (f.effect === 'electric') {
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const rx = cx + (Math.random() - 0.5) * 35;
        const ry = cy - Math.random() * 65;
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx + (Math.random() - 0.5) * 15, ry + (Math.random() - 0.5) * 15);
      }
      ctx.stroke();
    } else if (f.effect === 'smoke' || f.effect === 'dark_smoke') {
      ctx.fillStyle = f.effect === 'dark_smoke' ? 'rgba(15, 23, 42, 0.55)' : 'rgba(148, 163, 184, 0.4)';
      for (let i = 0; i < 5; i++) {
        const sx = cx + (Math.random() - 0.5) * 32;
        const sy = cy - 5 - Math.random() * 30;
        const sr = 6 + Math.random() * 8;
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (f.effect === 'sparkles') {
      ctx.fillStyle = '#FEF08A';
      for (let i = 0; i < 6; i++) {
        const sx = cx + (Math.random() - 0.5) * 44;
        const sy = cy - Math.random() * 75;
        ctx.beginPath();
        ctx.arc(sx, sy, 2 + Math.random() * 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (f.effect === 'aura') {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.28)';
      const auraPulse = Math.sin(time * 0.01) * 6;
      ctx.beginPath();
      ctx.arc(cx, cy - 30, 38 + auraPulse, 0, Math.PI * 2);
      ctx.fill();
    } else if (f.effect === 'cute_particles') {
      ctx.fillStyle = 'rgba(244, 114, 182, 0.45)';
      for (let i = 0; i < 4; i++) {
        const bx = cx + Math.sin(time * 0.004 + i) * 22;
        const by = cy - 20 - ((time * 0.04 + i * 20) % 50);
        ctx.beginPath();
        ctx.arc(bx, by, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (f.effect === 'light_glow') {
      ctx.fillStyle = 'rgba(253, 224, 71, 0.32)';
      ctx.beginPath();
      ctx.arc(cx, cy - 35, 44, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private drawFighterBackCosmetics(
    ctx: CanvasRenderingContext2D,
    nx: number,
    ny: number,
    f: FighterState,
    time: number
  ) {
    if (!f.cape || f.cape === 'none') return;
    ctx.save();
    ctx.lineWidth = 2.5;

    const capeColor = f.capeColor || f.secondaryColor || '#EF4444';
    const sway = Math.sin(time * 0.01 + f.vx * 0.15) * 8;

    if (f.cape === 'short_cape') {
      ctx.fillStyle = capeColor;
      ctx.strokeStyle = '#0F172A';
      ctx.beginPath();
      ctx.moveTo(nx - 4, ny);
      ctx.quadraticCurveTo(nx - 14, ny + 12 + sway, nx - 18, ny + 28 + sway);
      ctx.lineTo(nx + 4, ny + 24 + sway * 0.5);
      ctx.lineTo(nx + 4, ny);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (f.cape === 'long_cape' || f.cape === 'superhero_cape') {
      ctx.fillStyle = capeColor;
      ctx.strokeStyle = '#0F172A';
      ctx.beginPath();
      ctx.moveTo(nx - 4, ny);
      ctx.quadraticCurveTo(nx - 18, ny + 15 + sway, nx - 26, ny + 52 + sway);
      ctx.lineTo(nx + 6, ny + 46 + sway * 0.5);
      ctx.lineTo(nx + 4, ny);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (f.cape === 'torn_cape') {
      ctx.fillStyle = capeColor;
      ctx.strokeStyle = '#0F172A';
      ctx.beginPath();
      ctx.moveTo(nx - 4, ny);
      ctx.lineTo(nx - 22, ny + 45 + sway);
      ctx.lineTo(nx - 15, ny + 40 + sway);
      ctx.lineTo(nx - 8, ny + 48 + sway);
      ctx.lineTo(nx, ny + 42 + sway);
      ctx.lineTo(nx + 4, ny);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (f.cape === 'royal_cape') {
      ctx.fillStyle = capeColor;
      ctx.strokeStyle = '#0F172A';
      ctx.beginPath();
      ctx.moveTo(nx - 5, ny);
      ctx.lineTo(nx - 24, ny + 50 + sway);
      ctx.lineTo(nx + 6, ny + 44 + sway);
      ctx.lineTo(nx + 5, ny);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Gold trim
      ctx.fillStyle = '#FACC15';
      ctx.fillRect(nx - 5, ny, 10, 4);
    } else if (f.cape === 'ninja_cape') {
      ctx.fillStyle = capeColor;
      ctx.strokeStyle = '#0F172A';
      ctx.beginPath();
      ctx.moveTo(nx, ny);
      ctx.quadraticCurveTo(nx - 22, ny - 5 + sway, nx - 32, ny + 8 + sway);
      ctx.lineTo(nx - 26, ny + 14 + sway);
      ctx.lineTo(nx, ny + 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (f.cape === 'small_backpack' || f.cape === 'large_backpack' || f.cape === 'military_backpack') {
      const packW = f.cape === 'large_backpack' ? 14 : 11;
      const packH = f.cape === 'large_backpack' ? 24 : 18;
      ctx.fillStyle = f.capeColor || f.secondaryColor || '#8D6E63';
      ctx.strokeStyle = '#0F172A';
      ctx.roundRect(nx - packW - 4, ny + 2, packW, packH, 3);
      ctx.fill();
      ctx.stroke();
      // Zipper pocket
      ctx.fillStyle = '#475569';
      ctx.fillRect(nx - packW - 2, ny + packH - 6, packW - 4, 4);
    } else if (f.cape === 'jetpack') {
      ctx.fillStyle = '#64748B';
      ctx.strokeStyle = '#0F172A';
      ctx.roundRect(nx - 15, ny - 2, 10, 24, 3);
      ctx.fill();
      ctx.stroke();
      // Dual Nozzles
      ctx.fillStyle = '#334155';
      ctx.fillRect(nx - 14, ny + 22, 4, 5);
      ctx.fillRect(nx - 9, ny + 22, 4, 5);
      // Flame particles
      ctx.fillStyle = Math.random() < 0.5 ? '#EF4444' : '#F97316';
      ctx.beginPath();
      ctx.arc(nx - 12, ny + 30, 4 + Math.random() * 3, 0, Math.PI * 2);
      ctx.arc(nx - 7, ny + 30, 4 + Math.random() * 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (f.cape === 'angel_wings' || f.cape === 'small_wings') {
      const wingFlap = Math.sin(time * 0.008) * 8;
      ctx.fillStyle = f.cape === 'small_wings' ? 'rgba(244, 114, 182, 0.75)' : '#FFFFFF';
      ctx.strokeStyle = '#0F172A';
      ctx.beginPath();
      ctx.moveTo(nx, ny + 5);
      ctx.quadraticCurveTo(nx - 28, ny - 25 + wingFlap, nx - 38, ny + 5 + wingFlap);
      ctx.quadraticCurveTo(nx - 20, ny + 18, nx, ny + 15);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (f.cape === 'demon_wings' || f.cape === 'large_wings') {
      const wingFlap = Math.sin(time * 0.008) * 8;
      ctx.fillStyle = f.cape === 'demon_wings' ? '#1E293B' : '#DC2626';
      ctx.strokeStyle = '#0F172A';
      ctx.beginPath();
      ctx.moveTo(nx, ny + 5);
      ctx.lineTo(nx - 22, ny - 28 + wingFlap);
      ctx.lineTo(nx - 36, ny - 10 + wingFlap);
      ctx.lineTo(nx - 28, ny + 6 + wingFlap);
      ctx.lineTo(nx - 42, ny + 18 + wingFlap);
      ctx.lineTo(nx, ny + 16);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawFighterShoes(
    ctx: CanvasRenderingContext2D,
    lFootX: number,
    lFootY: number,
    rFootX: number,
    rFootY: number,
    f: FighterState
  ) {
    if (!f.shoes || f.shoes === 'none') return;
    const ctx2 = this.ctx;
    ctx2.save();
    const shoeColor = f.shoeColor || f.secondaryColor || '#0F172A';
    ctx2.fillStyle = shoeColor;
    ctx2.strokeStyle = '#0F172A';
    ctx2.lineWidth = 1.8;

    const feet = [
      { x: lFootX, y: lFootY },
      { x: rFootX, y: rFootY },
    ];

    for (const ft of feet) {
      ctx2.beginPath();
      if (f.shoes === 'cartoon_shoes') {
        ctx2.ellipse(ft.x + 2, ft.y, 8, 5.5, 0, 0, Math.PI * 2);
        ctx2.fill();
        ctx2.stroke();
      } else if (f.shoes === 'cute_shoes') {
        // Bunny slipper
        ctx2.ellipse(ft.x + 2, ft.y, 7, 5, 0, 0, Math.PI * 2);
        ctx2.fill();
        ctx2.stroke();
        ctx2.fillStyle = '#F472B6';
        ctx2.fillRect(ft.x + 4, ft.y - 6, 2, 4);
      } else if (f.shoes === 'samurai_sandals') {
        // Geta Wooden Block
        ctx2.fillStyle = '#8D6E63';
        ctx2.fillRect(ft.x - 3, ft.y - 1, 10, 4);
        ctx2.strokeRect(ft.x - 3, ft.y - 1, 10, 4);
        ctx2.fillStyle = '#EF4444';
        ctx2.fillRect(ft.x + 1, ft.y - 3, 2, 3);
      } else if (f.shoes === 'military_boots' || f.shoes === 'boots') {
        ctx2.fillStyle = shoeColor;
        ctx2.roundRect(ft.x - 3, ft.y - 6, 9, 8, 2);
        ctx2.fill();
        ctx2.stroke();
      } else if (f.shoes === 'futuristic') {
        ctx2.fillStyle = '#06B6D4';
        ctx2.roundRect(ft.x - 3, ft.y - 3, 10, 5, 2);
        ctx2.fill();
        ctx2.stroke();
        ctx2.fillStyle = '#38BDF8';
        ctx2.fillRect(ft.x - 2, ft.y + 1, 8, 2);
      } else {
        ctx2.roundRect(ft.x - 3, ft.y - 3, 9, 5, 2);
        ctx2.fill();
        ctx2.stroke();
      }
    }

    ctx2.restore();
  }

  private drawFighterOutfit(
    ctx: CanvasRenderingContext2D,
    nx: number,
    ny: number,
    hx: number,
    hy: number,
    f: FighterState
  ) {
    if (!f.outfit || f.outfit === 'none') return;
    ctx.save();
    const color = f.outfitColor || f.secondaryColor || '#3B82F6';
    ctx.fillStyle = color;
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 2;

    const bodyW = 14;
    const bodyH = hy - ny;

    ctx.beginPath();
    ctx.roundRect(nx - bodyW / 2, ny, bodyW, Math.abs(bodyH) + 4, 3);
    ctx.fill();
    ctx.stroke();

    if (f.outfit === 'cute_tshirt') {
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.arc(nx, ny + 10, 3.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (f.outfit === 'cute_hoodie' || f.outfit === 'hoodie') {
      // Hood pouch
      ctx.fillStyle = f.accentColor || '#1E293B';
      ctx.fillRect(nx - 4, ny + 14, 8, 7);
      ctx.strokeRect(nx - 4, ny + 14, 8, 7);
    } else if (f.outfit === 'combat' || f.outfit === 'tactical' || f.outfit === 'soldier') {
      ctx.fillStyle = '#334155';
      ctx.fillRect(nx - 5, ny + 6, 10, 8);
      ctx.strokeRect(nx - 5, ny + 6, 10, 8);
    } else if (f.outfit === 'dark_warrior') {
      ctx.fillStyle = '#991B1B';
      ctx.beginPath();
      ctx.moveTo(nx, ny + 4);
      ctx.lineTo(nx - 6, ny + 18);
      ctx.lineTo(nx + 6, ny + 18);
      ctx.closePath();
      ctx.fill();
    } else if (f.outfit === 'samurai' || f.outfit === 'ninja') {
      ctx.strokeStyle = '#FACC15';
      ctx.beginPath();
      ctx.moveTo(nx - 5, ny + 2);
      ctx.lineTo(nx + 5, ny + 20);
      ctx.moveTo(nx + 5, ny + 2);
      ctx.lineTo(nx - 5, ny + 20);
      ctx.stroke();
    } else if (f.outfit === 'royal') {
      ctx.fillStyle = '#FACC15';
      ctx.fillRect(nx - 1.5, ny + 2, 3, Math.abs(bodyH));
    } else if (f.outfit === 'space_suit' || f.outfit === 'robot') {
      ctx.fillStyle = '#06B6D4';
      ctx.beginPath();
      ctx.arc(nx, ny + 12, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawFighterHair(
    ctx: CanvasRenderingContext2D,
    hx: number,
    hy: number,
    f: FighterState,
    time: number
  ) {
    if (!f.hair || f.hair === 'none') return;
    ctx.save();
    const hairColor = f.hairColor || f.accentColor || '#0F172A';
    ctx.fillStyle = hairColor;
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 2;

    if (f.hair === 'short' || f.hair === 'military') {
      ctx.beginPath();
      ctx.arc(hx, hy - 4, 13.5, Math.PI * 0.8, Math.PI * 2.2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (f.hair === 'long') {
      const sway = Math.sin(time * 0.01 + f.vx * 0.15) * 4;
      ctx.beginPath();
      ctx.arc(hx, hy - 3, 13.5, Math.PI * 0.7, Math.PI * 2.3);
      ctx.lineTo(hx - 14, hy + 18 + sway);
      ctx.lineTo(hx - 6, hy + 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (f.hair === 'spiky' || f.hair === 'anime') {
      ctx.beginPath();
      ctx.moveTo(hx - 12, hy - 4);
      ctx.lineTo(hx - 16, hy - 18);
      ctx.lineTo(hx - 6, hy - 12);
      ctx.lineTo(hx, hy - 22);
      ctx.lineTo(hx + 6, hy - 12);
      ctx.lineTo(hx + 14, hy - 18);
      ctx.lineTo(hx + 12, hy - 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (f.hair === 'messy' || f.hair === 'curly') {
      ctx.beginPath();
      ctx.arc(hx, hy - 4, 14.5, Math.PI * 0.75, Math.PI * 2.25);
      ctx.fill();
      ctx.stroke();
    } else if (f.hair === 'mohawk') {
      ctx.beginPath();
      ctx.moveTo(hx - 3, hy - 10);
      ctx.lineTo(hx - 4, hy - 26);
      ctx.lineTo(hx + 4, hy - 26);
      ctx.lineTo(hx + 3, hy - 10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (f.hair === 'ponytail') {
      const sway = Math.sin(time * 0.015) * 5;
      ctx.beginPath();
      ctx.arc(hx, hy - 4, 13, Math.PI * 0.8, Math.PI * 2.2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(hx - 8, hy - 6);
      ctx.quadraticCurveTo(hx - 20, hy - 10 + sway, hx - 24, hy + 4 + sway);
      ctx.lineTo(hx - 12, hy);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (f.hair === 'large_cartoon' || f.hair === 'afro' || f.hair === 'wild') {
      ctx.beginPath();
      ctx.arc(hx, hy - 8, 19, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (f.hair === 'dreads' || f.hair === 'bob') {
      ctx.beginPath();
      ctx.arc(hx, hy - 3, 14, Math.PI * 0.7, Math.PI * 2.3);
      ctx.lineTo(hx - 12, hy + 12);
      ctx.lineTo(hx - 6, hy + 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawFighterHeadwear(
    ctx: CanvasRenderingContext2D,
    hx: number,
    hy: number,
    f: FighterState,
    time: number
  ) {
    const hat = f.hat;
    if (!hat || hat === 'none') return;
    ctx.save();
    const color = f.hatColor || f.secondaryColor || '#EF4444';
    ctx.fillStyle = color;
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 2.5;

    if (hat === 'headband' || hat === 'ninja_headband') {
      ctx.fillStyle = color;
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
    } else if (hat === 'wizard') {
      ctx.fillStyle = '#7C3AED';
      ctx.beginPath();
      ctx.ellipse(hx, hy - 11, 17, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(hx - 10, hy - 12);
      ctx.lineTo(hx, hy - 32);
      ctx.lineTo(hx + 10, hy - 12);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (hat === 'samurai') {
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(hx, hy - 5, 14.5, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Gold Horn Crest
      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.moveTo(hx - 10, hy - 22);
      ctx.lineTo(hx, hy - 14);
      ctx.lineTo(hx + 10, hy - 22);
      ctx.lineTo(hx, hy - 11);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (hat === 'pirate') {
      ctx.fillStyle = '#1E293B';
      ctx.beginPath();
      ctx.moveTo(hx - 18, hy - 10);
      ctx.lineTo(hx, hy - 25);
      ctx.lineTo(hx + 18, hy - 10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (hat === 'ninja') {
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(hx - 13, hy - 1, 26, 12);
      ctx.strokeRect(hx - 13, hy - 1, 26, 12);
    } else if (hat === 'horns' || hat === 'devil_horns') {
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
    } else if (hat === 'cat_ears' || hat === 'rabbit_ears') {
      ctx.fillStyle = '#F472B6';
      const earH = hat === 'rabbit_ears' ? 22 : 12;
      ctx.beginPath();
      ctx.moveTo(hx - 10, hy - 10);
      ctx.lineTo(hx - 8, hy - 10 - earH);
      ctx.lineTo(hx - 2, hy - 10);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(hx + 2, hy - 10);
      ctx.lineTo(hx + 8, hy - 10 - earH);
      ctx.lineTo(hx + 10, hy - 10);
      ctx.fill();
      ctx.stroke();
    } else if (hat === 'angel_halo') {
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(hx, hy - 24, 14, 4, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (hat === 'space_helmet') {
      ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(hx, hy - 1, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (hat === 'military_helmet' || hat === 'helmet' || hat === 'army_hat' || hat === 'jungle_hat') {
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.arc(hx, hy - 3, 14.5, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (hat === 'cone') {
      ctx.fillStyle = '#F43F5E';
      ctx.beginPath();
      ctx.moveTo(hx - 8, hy - 12);
      ctx.lineTo(hx, hy - 28);
      ctx.lineTo(hx + 8, hy - 12);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (hat === 'beanie') {
      ctx.fillStyle = '#0284C7';
      ctx.beginPath();
      ctx.arc(hx, hy - 5, 14, Math.PI * 0.8, Math.PI * 2.2);
      ctx.fill();
      ctx.stroke();
    } else if (hat === 'robot_antennas') {
      ctx.strokeStyle = '#64748B';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(hx - 6, hy - 12);
      ctx.lineTo(hx - 10, hy - 24);
      ctx.moveTo(hx + 6, hy - 12);
      ctx.lineTo(hx + 10, hy - 24);
      ctx.stroke();
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.arc(hx - 10, hy - 25, 3, 0, Math.PI * 2);
      ctx.arc(hx + 10, hy - 25, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private drawFighterFaceCosmetics(
    ctx: CanvasRenderingContext2D,
    hx: number,
    hy: number,
    f: FighterState
  ) {
    if (!f.face || f.face === 'none') return;
    ctx.save();
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 2;

    if (f.face === 'sunglasses' || f.face === 'pilot_glasses') {
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(hx + 1, hy - 5, 10, 6);
      ctx.strokeRect(hx + 1, hy - 5, 10, 6);
    } else if (f.face === 'round_glasses') {
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath();
      ctx.arc(hx + 5, hy - 2, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (f.face === 'eye_patch') {
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(hx + 4, hy - 2, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (f.face === 'ninja_mask' || f.face === 'bandit_mask' || f.face === 'face_mask') {
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(hx - 2, hy, 14, 10);
      ctx.strokeRect(hx - 2, hy, 14, 10);
    } else if (f.face === 'gas_mask') {
      ctx.fillStyle = '#334155';
      ctx.fillRect(hx - 4, hy - 1, 17, 11);
      ctx.strokeRect(hx - 4, hy - 1, 17, 11);
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.arc(hx + 10, hy + 4, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (f.face === 'samurai_mask') {
      ctx.fillStyle = '#DC2626';
      ctx.fillRect(hx - 2, hy + 1, 14, 9);
      ctx.strokeRect(hx - 2, hy + 1, 14, 9);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(hx + 2, hy + 4, 2, 4);
      ctx.fillRect(hx + 8, hy + 4, 2, 4);
    } else if (f.face === 'cute_blush') {
      ctx.fillStyle = 'rgba(244, 114, 182, 0.7)';
      ctx.beginPath();
      ctx.arc(hx + 5, hy + 2, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (f.face === 'scar') {
      ctx.strokeStyle = '#DC2626';
      ctx.beginPath();
      ctx.moveTo(hx + 3, hy - 8);
      ctx.lineTo(hx + 6, hy + 4);
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawFighterFrontAccessories(
    ctx: CanvasRenderingContext2D,
    nx: number,
    ny: number,
    hx: number,
    hy: number,
    f: FighterState
  ) {
    if (!f.accessory || f.accessory === 'none') return;
    ctx.save();
    ctx.lineWidth = 2;

    if (f.accessory === 'necklace' || f.accessory === 'chain') {
      ctx.strokeStyle = '#FACC15';
      ctx.beginPath();
      ctx.arc(nx, ny + 2, 6, 0, Math.PI);
      ctx.stroke();
    } else if (f.accessory === 'tie') {
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.moveTo(nx - 2, ny + 2);
      ctx.lineTo(nx + 2, ny + 2);
      ctx.lineTo(nx + 3, ny + 16);
      ctx.lineTo(nx, ny + 20);
      ctx.lineTo(nx - 3, ny + 16);
      ctx.closePath();
      ctx.fill();
    } else if (f.accessory === 'flower') {
      ctx.fillStyle = '#F472B6';
      ctx.beginPath();
      ctx.arc(hx - 10, hy - 4, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (f.accessory === 'ammo_belt') {
      ctx.strokeStyle = '#78350F';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(nx - 6, ny);
      ctx.lineTo(nx + 6, ny + 22);
      ctx.stroke();
    } else if (f.accessory === 'shoulder_pad') {
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(nx - 7, ny + 2, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (f.accessory === 'badge') {
      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.arc(nx + 2, ny + 6, 3, 0, Math.PI * 2);
      ctx.fill();
    }

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

      case 'thunder_sword':
        // Enormous Lightning Broadsword
        ctx.fillStyle = '#FACC15';
        ctx.strokeStyle = '#0F172A';
        // Handle & Hilt
        ctx.fillRect(-12, -3, 10, 6);
        ctx.strokeRect(-12, -3, 10, 6);
        ctx.fillStyle = '#EAB308';
        ctx.fillRect(-3, -12, 6, 24);
        ctx.strokeRect(-3, -12, 6, 24);
        // Giant Blade
        ctx.fillStyle = '#38BDF8';
        ctx.beginPath();
        ctx.moveTo(3, -9);
        ctx.lineTo(38, -6);
        ctx.lineTo(50, 0);
        ctx.lineTo(38, 6);
        ctx.lineTo(3, 9);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Electric Core Groove
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(5, -2, 32, 4);
        break;

      case 'infinite_gun':
        // Heavy Rotary Machine Gun
        ctx.fillStyle = '#1E293B';
        ctx.strokeStyle = '#0F172A';
        // Main Body & Ammo Drum
        ctx.fillRect(-10, -8, 22, 16);
        ctx.strokeRect(-10, -8, 22, 16);
        ctx.fillStyle = '#F59E0B';
        ctx.beginPath();
        ctx.arc(-2, 10, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // Triple Rotary Barrels
        ctx.fillStyle = '#64748B';
        ctx.fillRect(12, -9, 26, 5);
        ctx.strokeRect(12, -9, 26, 5);
        ctx.fillRect(12, -2, 26, 5);
        ctx.strokeRect(12, -2, 26, 5);
        ctx.fillRect(12, 5, 26, 5);
        ctx.strokeRect(12, 5, 26, 5);
        break;

      case 'inferno_cannon':
        // Massive Dragonhead Fire Cannon
        ctx.fillStyle = '#991B1B';
        ctx.strokeStyle = '#0F172A';
        // Heavy Barrel Body
        ctx.fillRect(-10, -9, 32, 18);
        ctx.strokeRect(-10, -9, 32, 18);
        // Twin Flame Canisters
        ctx.fillStyle = '#EA580C';
        ctx.fillRect(-6, 9, 24, 7);
        ctx.strokeRect(-6, 9, 24, 7);
        // Dragon Mouth Flare Nozzle
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.moveTo(22, -12);
        ctx.lineTo(36, -6);
        ctx.lineTo(36, 6);
        ctx.lineTo(22, 12);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Glowing Nozzle Core
        ctx.fillStyle = '#FACC15';
        ctx.fillRect(26, -4, 8, 8);
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

    let nameWidth = this.textWidthCache.get(f.name);
    if (nameWidth === undefined) {
      nameWidth = ctx.measureText(f.name).width;
      this.textWidthCache.set(f.name, nameWidth);
    }
    const badgeW = Math.max(56, nameWidth + 20);
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
    const isBlinking = !f.isDead && f.state !== 'hit' && Math.sin(time * 0.003 + (parseInt(f.id, 36) || 0)) > 0.96;

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
      if (!this.isInView(p.x - (p.size || 20), p.y - (p.size || 20), (p.size || 20) * 2, (p.size || 20) * 2)) continue;
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
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 3.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    const baseY = y + r * 0.35;
    const leftX = x - r * 0.65;
    const rightX = x + r * 1.33;

    // 1. Fill cloud interior
    ctx.beginPath();
    ctx.arc(x - r * 0.25, y, r * 0.42, 0, Math.PI * 2);
    ctx.arc(x + r * 0.15, y - r * 0.3, r * 0.55, 0, Math.PI * 2);
    ctx.arc(x + r * 0.65, y - r * 0.2, r * 0.48, 0, Math.PI * 2);
    ctx.arc(x + r * 0.95, y + r * 0.05, r * 0.40, 0, Math.PI * 2);
    ctx.fillRect(leftX, y - r * 0.1, rightX - leftX, baseY - (y - r * 0.1));
    ctx.fill();

    // 2. Stroke complete outer perimeter (including bottom base line)
    ctx.beginPath();
    ctx.moveTo(leftX, baseY);
    ctx.arc(x - r * 0.25, y, r * 0.42, Math.PI * 0.75, Math.PI * 1.45);
    ctx.arc(x + r * 0.15, y - r * 0.3, r * 0.55, Math.PI * 1.15, Math.PI * 1.95);
    ctx.arc(x + r * 0.65, y - r * 0.2, r * 0.48, Math.PI * 1.6, Math.PI * 2.2);
    ctx.arc(x + r * 0.95, y + r * 0.05, r * 0.40, Math.PI * 1.85, Math.PI * 0.35);
    ctx.lineTo(leftX, baseY); // Complete bottom line stroke connecting base
    ctx.closePath();
    ctx.stroke();

    ctx.restore();
  }

  private drawCartoonTree(x: number, y: number, size: number) {
    const ctx = this.ctx;
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = 3;

    // 1. Trunk
    ctx.fillStyle = '#8D6E63';
    ctx.strokeStyle = '#2D3748';
    ctx.beginPath();
    ctx.rect(x - 10, y, 20, 80);
    ctx.fill();
    ctx.stroke();

    // 2. Fill foliage canopy solid
    ctx.fillStyle = '#4CAF50';
    ctx.beginPath();
    ctx.arc(x, y - 20, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x - size * 0.5, y, size * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + size * 0.5, y, size * 0.7, 0, Math.PI * 2);
    ctx.fill();

    // 3. Stroke outer canopy boundary without internal line artifacts
    ctx.strokeStyle = '#2D3748';
    ctx.beginPath();
    ctx.arc(x - size * 0.5, y, size * 0.7, Math.PI * 0.5, Math.PI * 1.55);
    ctx.arc(x, y - 20, size, Math.PI * 1.1, Math.PI * 1.9);
    ctx.arc(x + size * 0.5, y, size * 0.7, Math.PI * 1.45, Math.PI * 0.5);
    ctx.closePath();
    ctx.stroke();

    // 4. Berries / Apples
    ctx.fillStyle = '#EF4444';
    ctx.strokeStyle = '#7F1D1D';
    ctx.lineWidth = 1.5;
    const berries = [
      { bx: x - 15, by: y - 25 },
      { bx: x + 18, by: y - 10 },
      { bx: x, by: y + 10 },
    ];
    for (const b of berries) {
      ctx.beginPath();
      ctx.arc(b.bx, b.by, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

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
