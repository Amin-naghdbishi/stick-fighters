import React, { useEffect, useRef, useState, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'motion/react';
import {
  Volume2,
  VolumeX,
  RotateCcw,
  Home,
  Shield,
  Zap,
  Sword,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Trophy,
  Compass,
  Crosshair,
  Sparkles,
  Flame,
  Activity,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { ComicPop, FighterState, Particle, PlayerInput, RoomState } from '../types/game';
import { ARENAS } from '../game/arenas';
import { GameRenderer } from '../game/renderer';
import { sound } from '../game/audio';
import { WEAPONS_CONFIG, WeaponType } from '../game/weapons';
import { network, ConnectionStatus } from '../game/network';
import { getHudEnabled } from './SettingsModal';

interface GameCanvasViewProps {
  room: RoomState;
  myId: string;
  comicPops: ComicPop[];
  isPreviewMode?: boolean;
  onSendInput: (input: PlayerInput) => void;
  onRestartMatch: () => void;
  onReturnToLobby: () => void;
  onReadyToggle?: (isReady: boolean) => void;
}

export const GameCanvasView: React.FC<GameCanvasViewProps> = ({
  room,
  myId,
  comicPops,
  isPreviewMode = false,
  onSendInput,
  onRestartMatch,
  onReturnToLobby,
  onReadyToggle,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<GameRenderer | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const confettiFiredRef = useRef<boolean>(false);

  // References to avoid re-triggering canvas mount effects on fast ticks
  const roomRef = useRef<RoomState>(room);
  roomRef.current = room;

  const myIdRef = useRef<string>(myId);
  myIdRef.current = myId;

  const comicPopsRef = useRef<ComicPop[]>(comicPops);
  comicPopsRef.current = comicPops;

  // Local keyboard/touch/mouse input state
  const inputRef = useRef<PlayerInput>({
    left: false,
    right: false,
    up: false,
    down: false,
    fastAttack: false,
    heavyAttack: false,
    block: false,
    fire: false,
    aimAngle: 0,
  });

  // Remote player smooth interpolation map
  const remoteSmoothMapRef = useRef<Map<string, { x: number; y: number; facing: 1 | -1 }>>(new Map());

  const [soundMuted, setSoundMuted] = useState(false);
  const [isScoreboardOpen, setIsScoreboardOpen] = useState(false);
  const [activeTouch, setActiveTouch] = useState<{ [key: string]: boolean }>({});
  const lastWheelTimeRef = useRef<number>(0);

  // Network & Performance HUD Metrics State
  const [ping, setPing] = useState<number>(network.ping);
  const [netStatus, setNetStatus] = useState<ConnectionStatus>(network.connectionStatus);
  const [fps, setFps] = useState<number>(60);
  const [showHud, setShowHud] = useState<boolean>(() => getHudEnabled());

  useEffect(() => {
    const unsubPing = network.onPing((p) => setPing(p));
    const unsubStatus = network.onStatusChange((s) => setNetStatus(s));

    const handleHudToggle = (e: any) => {
      if (typeof e?.detail?.enabled === 'boolean') {
        setShowHud(e.detail.enabled);
      }
    };
    window.addEventListener('sf_hud_toggled', handleHudToggle);

    return () => {
      unsubPing();
      unsubStatus();
      window.removeEventListener('sf_hud_toggled', handleHudToggle);
    };
  }, []);

  const emitInput = useCallback(() => {
    onSendInput({ ...inputRef.current });
    // Reset transient triggers after emitting
    if (inputRef.current.switchWeapon) {
      inputRef.current.switchWeapon = undefined;
    }
  }, [onSendInput]);

  const switchWeaponDirectly = useCallback((weaponTypeOrDirection: 'next' | 'prev' | WeaponType) => {
    inputRef.current.switchWeapon = weaponTypeOrDirection;
    emitInput();
  }, [emitInput]);

  // Handle victory fanfare & confetti vs defeat / draw stinger
  useEffect(() => {
    if (!isPreviewMode && room.status === 'round_end' && !confettiFiredRef.current) {
      confettiFiredRef.current = true;
      const isWinner = room.winnerId === myId;
      if (isWinner) {
        sound.playVictoryFanfare();
        try {
          confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6'],
          });
        } catch (e) {
          // ignore
        }
      } else if (room.winnerId) {
        sound.playDefeatStinger();
      } else {
        sound.playTieStinger();
      }
    } else if (room.status === 'in_game' || room.status === 'countdown') {
      confettiFiredRef.current = false;
    }
  }, [room.status, room.winnerId, myId, isPreviewMode]);

  // Dynamic Battle Tension (Heartbeat layer on critical low health)
  useEffect(() => {
    if (isPreviewMode || room.status !== 'in_game') {
      sound.setBattleIntensity(false);
      return;
    }
    const myFighter = room.players ? room.players[myId] : null;
    if (myFighter && myFighter.hp > 0 && myFighter.hp / myFighter.maxHp <= 0.35) {
      sound.setBattleIntensity(true);
    } else {
      sound.setBattleIntensity(false);
    }
  }, [room.players, room.status, myId, isPreviewMode]);

  const onReturnToLobbyRef = useRef(onReturnToLobby);
  onReturnToLobbyRef.current = onReturnToLobby;
  const emitInputRef = useRef(emitInput);
  emitInputRef.current = emitInput;

  // Keyboard Event Listeners (Including Escape, WASD, Aim & Weapon switching)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        sound.playBack();
        onReturnToLobbyRef.current();
        return;
      }

      if (e.code === 'Tab') {
        e.preventDefault();
        if (e.repeat) return;
        setIsScoreboardOpen((prev) => !prev);
        return;
      }

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyW', 'KeyS', 'KeyA', 'KeyD'].includes(e.code)) {
        e.preventDefault();
      }

      let changed = false;
      const inp = inputRef.current;

      if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
        if (!inp.left) { inp.left = true; changed = true; }
      }
      if (e.code === 'KeyD' || e.code === 'ArrowRight') {
        if (!inp.right) { inp.right = true; changed = true; }
      }
      if (e.code === 'KeyW' || e.code === 'ArrowUp' || e.code === 'Space') {
        if (!inp.up) {
          inp.up = true;
          changed = true;
          sound.playJump();
        }
      }
      if (e.code === 'KeyS' || e.code === 'ArrowDown') {
        if (!inp.down) { inp.down = true; changed = true; }
      }
      if (e.code === 'KeyJ' || e.code === 'KeyZ') {
        if (!inp.fastAttack) {
          inp.fastAttack = true;
          changed = true;
          sound.playFastPunch();
        }
      }
      if (e.code === 'KeyK' || e.code === 'KeyX') {
        if (!inp.heavyAttack) {
          inp.heavyAttack = true;
          changed = true;
          sound.playHeavyHit();
        }
      }
      if (e.code === 'KeyL' || e.code === 'KeyC' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        if (!inp.block) {
          inp.block = true;
          changed = true;
          sound.playShieldBlock();
        }
      }

      // Weapon Fire (Key F)
      if (e.code === 'KeyF') {
        if (!inp.fire) {
          inp.fire = true;
          changed = true;
        }
      }

      // Weapon Switching (Q = prev, E = next)
      if (e.code === 'KeyQ') {
        inp.switchWeapon = 'prev';
        changed = true;
      }
      if (e.code === 'KeyE') {
        inp.switchWeapon = 'next';
        changed = true;
      }

      // Number key selection (1 to 9)
      if (['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9'].includes(e.code)) {
        const slotIdx = parseInt(e.code.replace('Digit', ''), 10) - 1;
        const myFighter = roomRef.current.players[myIdRef.current];
        if (myFighter && myFighter.weapons) {
          const availableWeapons = Object.keys(myFighter.weapons).filter(
            (k) => (myFighter.weapons[k] || 0) > 0
          ) as WeaponType[];
          if (availableWeapons[slotIdx]) {
            inp.switchWeapon = availableWeapons[slotIdx];
            changed = true;
          }
        }
      }

      if (changed) emitInputRef.current();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      let changed = false;
      const inp = inputRef.current;

      if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
        if (inp.left) { inp.left = false; changed = true; }
      }
      if (e.code === 'KeyD' || e.code === 'ArrowRight') {
        if (inp.right) { inp.right = false; changed = true; }
      }
      if (e.code === 'KeyW' || e.code === 'ArrowUp' || e.code === 'Space') {
        if (inp.up) { inp.up = false; changed = true; }
      }
      if (e.code === 'KeyS' || e.code === 'ArrowDown') {
        if (inp.down) { inp.down = false; changed = true; }
      }
      if (e.code === 'KeyJ' || e.code === 'KeyZ') {
        if (inp.fastAttack) { inp.fastAttack = false; changed = true; }
      }
      if (e.code === 'KeyK' || e.code === 'KeyX') {
        if (inp.heavyAttack) { inp.heavyAttack = false; changed = true; }
      }
      if (e.code === 'KeyL' || e.code === 'KeyC' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        if (inp.block) { inp.block = false; changed = true; }
      }
      if (e.code === 'KeyF') {
        if (inp.fire) { inp.fire = false; changed = true; }
      }

      if (changed) emitInputRef.current();
    };

    const handleWeaponFireEvent = (e: any) => {
      const detail = e.detail;
      if (!detail || !rendererRef.current) return;
      if (detail.weaponType === 'infinite_gun') {
        rendererRef.current.triggerShake(5, 0.08);
      } else if (detail.weaponType === 'thunder_sword') {
        rendererRef.current.triggerElectricPulse(0.15);
        rendererRef.current.triggerShake(8, 0.12);
      } else if (detail.weaponType === 'inferno_cannon') {
        rendererRef.current.triggerFirePulse(0.12);
        rendererRef.current.triggerShake(4, 0.08);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('sf_weapon_fire', handleWeaponFireEvent);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('sf_weapon_fire', handleWeaponFireEvent);
    };
  }, []);

  // Mouse Movement & Aim Angle Calculation
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !rendererRef.current) return;

    const rect = canvas.getBoundingClientRect();
    const mouseScreenX = e.clientX - rect.left;
    const mouseScreenY = e.clientY - rect.top;

    const cam = rendererRef.current.camera;
    const worldMouseX = (mouseScreenX - rect.width / 2) / cam.zoom + cam.x;
    const worldMouseY = (mouseScreenY - rect.height / 2) / cam.zoom + cam.y;

    const myFighter = roomRef.current.players[myIdRef.current];
    if (myFighter && !myFighter.isDead) {
      const dx = worldMouseX - myFighter.x;
      const dy = worldMouseY - (myFighter.y - 35); // Center of torso/shoulders
      const aimAngle = Math.atan2(dy, dx);

      if (Math.abs((inputRef.current.aimAngle || 0) - aimAngle) > 0.015) {
        inputRef.current.aimAngle = aimAngle;
        emitInput();
      }
    }
  }, [emitInput]);

  // Mouse Click & Shooting / Heavy Attack (Right Mouse Button = K Action)
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button === 0) {
      // Left click = Primary Fire / Attack
      const myFighter = roomRef.current.players[myIdRef.current];
      inputRef.current.fire = true;
      if (!myFighter?.activeWeapon) {
        inputRef.current.fastAttack = true;
        sound.playFastPunch();
      }
      emitInput();
    } else if (e.button === 2) {
      // Right click = K Action (Heavy Attack / Dropkick)
      e.preventDefault();
      if (!inputRef.current.heavyAttack) {
        inputRef.current.heavyAttack = true;
        sound.playHeavyHit();
        emitInput();
      }
    }
  }, [emitInput]);

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLDivElement> | MouseEvent) => {
    if (e.button === 0) {
      inputRef.current.fire = false;
      inputRef.current.fastAttack = false;
      emitInput();
    } else if (e.button === 2) {
      if (inputRef.current.heavyAttack) {
        inputRef.current.heavyAttack = false;
        emitInput();
      }
    }
  }, [emitInput]);

  useEffect(() => {
    window.addEventListener('mouseup', handleMouseUp as any);
    return () => window.removeEventListener('mouseup', handleMouseUp as any);
  }, [handleMouseUp]);

  // Mouse Wheel = Quick Weapon Cycling (Smoothly throttled to eliminate flicker)
  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    const now = Date.now();
    if (now - lastWheelTimeRef.current < 140) return;
    if (Math.abs(e.deltaY) > 5) {
      lastWheelTimeRef.current = now;
      switchWeaponDirectly(e.deltaY > 0 ? 'next' : 'prev');
    }
  }, [switchWeaponDirectly]);

  // Touch buttons handler
  const setTouchInput = (key: keyof PlayerInput, pressed: boolean) => {
    setActiveTouch((prev) => ({ ...prev, [key]: pressed }));
    if (inputRef.current[key] !== pressed) {
      inputRef.current[key] = pressed;
      if (pressed) {
        if (key === 'up') sound.playJump();
        if (key === 'fastAttack') sound.playFastPunch();
        if (key === 'heavyAttack') sound.playHeavyHit();
        if (key === 'block') sound.playShieldBlock();
        if (key === 'fire') {
          const myFighter = roomRef.current.players[myIdRef.current];
          if (!myFighter?.activeWeapon) {
            sound.playFastPunch();
          }
        }
      }
      emitInput();
    }
  };

  // Main Canvas Setup & Resize Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    rendererRef.current = new GameRenderer(ctx);

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      const cssW = rect.width > 0 ? rect.width : window.innerWidth;
      const cssH = rect.height > 0 ? rect.height : window.innerHeight;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const targetW = Math.floor(cssW * dpr);
      const targetH = Math.floor(cssH * dpr);

      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (rendererRef.current) {
        rendererRef.current.setDimensions(cssW, cssH);
      }
    };

    // Synchronously measure initial viewport before starting render loop
    updateSize();

    const resizeObserver = new ResizeObserver(() => {
      updateSize();
    });
    resizeObserver.observe(container);

    window.addEventListener('resize', updateSize);
    window.addEventListener('orientationchange', updateSize);
    document.addEventListener('fullscreenchange', updateSize);

    let animId: number;
    let lastTime = Date.now();
    let frameCount = 0;
    let lastFpsCalc = performance.now();

    const loop = () => {
      const now = Date.now();
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      // Real client rendering FPS measurement (updated every 500ms)
      frameCount++;
      const nowPerf = performance.now();
      if (nowPerf - lastFpsCalc >= 500) {
        const measuredFps = Math.round((frameCount * 1000) / (nowPerf - lastFpsCalc));
        setFps(measuredFps);
        frameCount = 0;
        lastFpsCalc = nowPerf;
      }

      const curRoom = roomRef.current;
      const curPops = comicPopsRef.current;
      const arena = ARENAS[curRoom.mapId] || ARENAS.park;
      const rawFighters: FighterState[] = Object.values(curRoom.players) as FighterState[];

      // Network Smoothing & Interpolation (Removes Player Position Jitter & Stutter)
      const smoothedFighters: FighterState[] = rawFighters.map((f) => {
        let prev = remoteSmoothMapRef.current.get(f.id);
        const dist = prev ? Math.hypot(f.x - prev.x, f.y - prev.y) : 0;

        if (!prev || dist > 200 || f.isDead) {
          prev = { x: f.x, y: f.y, facing: f.facing };
          remoteSmoothMapRef.current.set(f.id, prev);
        } else {
          // Smooth framerate-independent exponential decay lerp
          const lerpSpeed = f.id === myIdRef.current ? 35 : 25;
          const lerpFactor = 1 - Math.exp(-lerpSpeed * dt);
          prev.x += (f.x - prev.x) * lerpFactor;
          prev.y += (f.y - prev.y) * lerpFactor;
          prev.facing = f.facing;
        }

        return {
          ...f,
          x: prev.x,
          y: prev.y,
        };
      });

      // Particle simulation (dust, sparks)
      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= dt;
        p.alpha = p.life / p.maxLife;
        if (p.life <= 0) {
          particles.splice(i, 1);
        }
      }

      // Generate dust particles on running fighters
      for (const f of smoothedFighters) {
        if (f.state === 'run' && Math.random() < 0.25) {
          particles.push({
            id: 'dust_' + Math.random(),
            x: f.x - f.facing * 10,
            y: f.y - 2,
            vx: -f.facing * (Math.random() * 2 + 1),
            vy: -Math.random() * 1.5,
            size: Math.random() * 4 + 3,
            color: '#CBD5E1',
            alpha: 0.8,
            life: 0.35,
            maxLife: 0.35,
            shape: 'dust',
          });
        }
      }

      if (rendererRef.current) {
        rendererRef.current.updateCamera(smoothedFighters, arena, myIdRef.current, dt);
        rendererRef.current.render(
          arena,
          smoothedFighters,
          particles,
          curPops,
          now,
          curRoom.weaponSpawns || [],
          curRoom.projectiles || [],
          curRoom.burningGround || []
        );
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateSize);
      window.removeEventListener('orientationchange', updateSize);
      document.removeEventListener('fullscreenchange', updateSize);
    };
  }, []);

  const fightersList: FighterState[] = Object.values(room.players) as FighterState[];
  const myFighter = room.players[myId];
  const winnerFighter = room.winnerId ? room.players[room.winnerId] : null;
  const currentArena = ARENAS[room.mapId] || ARENAS.park;

  const activeWeaponConfig = myFighter?.activeWeapon ? WEAPONS_CONFIG[myFighter.activeWeapon] : null;
  const activeAmmo = myFighter?.activeWeapon ? (myFighter.weapons[myFighter.activeWeapon] || 0) : 0;
  const collectedWeaponsList = myFighter?.weapons
    ? (Object.entries(myFighter.weapons).filter(([_, ammo]) => (ammo as number) > 0) as [WeaponType, number][])
    : [];

  // Format timer into MM:SS
  const formatTime = (seconds: number) => {
    if (room.matchDuration === 0) return '∞';
    const totalSecs = Math.max(0, Math.ceil(seconds));
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Sort fighters by Score descending, then Kills, then fewer Deaths
  const sortedFighters = [...fightersList].sort(
    (a, b) =>
      (b.score || 0) - (a.score || 0) ||
      (b.kills || 0) - (a.kills || 0) ||
      (a.deaths || 0) - (b.deaths || 0)
  );

  return (
    <div
      ref={containerRef}
      id="game_view_container"
      className="relative w-full h-full overflow-hidden bg-sky-100 select-none touch-none cursor-crosshair"
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* 1. Main Canvas Stage (True Fullscreen Viewport) */}
      <canvas ref={canvasRef} className="w-full h-full block pointer-events-none" />

      {/* 2. Top Header / Comic HUD: LOCAL PLAYER HP & WEAPON STATUS */}
      {!isPreviewMode ? (
        <div className="absolute top-3 inset-x-3 sm:inset-x-6 flex items-start justify-between gap-3 pointer-events-none z-20">
          {/* Top Left: Local Player Dedicated Vital HUD & Weapon Inventory */}
          {myFighter ? (
            <div className="bg-white/95 backdrop-blur-xs rounded-2xl border-3 border-black p-2.5 sm:p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] w-full max-w-[290px] sm:max-w-[350px] pointer-events-auto">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2 truncate">
                  <span
                    className="w-4 h-4 rounded-full border-2 border-black shrink-0"
                    style={{ backgroundColor: myFighter.color }}
                  />
                  <span className="font-black text-xs sm:text-sm text-black truncate">
                    {myFighter.name}
                  </span>
                  <span className="text-[10px] bg-sky-100 text-sky-900 font-black px-1.5 py-0.5 rounded border border-sky-400">
                    YOU
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 font-mono">
                  <span className="font-black text-xs text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-300">
                    {myFighter.score ?? 0} pts
                  </span>
                  <span className="font-black text-xs text-slate-800">
                    {Math.max(0, Math.ceil(myFighter.hp))} HP
                  </span>
                </div>
              </div>

              {/* Health Gauge */}
              <div className="w-full h-3.5 bg-slate-200 rounded-lg border-2 border-black overflow-hidden relative mb-1.5">
                <div
                  className="h-full transition-all duration-150 rounded-md"
                  style={{
                    width: `${Math.max(0, (myFighter.hp / myFighter.maxHp) * 100)}%`,
                    backgroundColor:
                      myFighter.hp > 50 ? '#22C55E' : myFighter.hp > 25 ? '#F59E0B' : '#EF4444',
                  }}
                />
              </div>

              {/* Sub-bar: Shield Meter & K/D Tracker */}
              <div className="flex items-center justify-between text-[10px] font-black text-slate-600 mb-2">
                <div className="flex items-center gap-1">
                  <Shield className="w-3 h-3 text-sky-600" />
                  <span>GUARD: {Math.max(0, Math.ceil(myFighter.shield || 100))}%</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-emerald-700">{myFighter.kills || 0} Kills</span>
                  <span>•</span>
                  <span className="text-rose-600">{myFighter.deaths || 0} Deaths</span>
                </div>
              </div>

              {/* Weapon Status & Ammo HUD Bar */}
              <div className="pt-2 border-t-2 border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base leading-none">
                      {activeWeaponConfig ? activeWeaponConfig.icon : '👊'}
                    </span>
                    <div>
                      <div className="text-xs font-black text-black leading-tight flex items-center gap-1">
                        <span>{activeWeaponConfig ? activeWeaponConfig.name : 'Unarmed (Fists)'}</span>
                        {activeWeaponConfig && (
                          <span className={`text-[9px] px-1 rounded border font-black uppercase ${
                            activeWeaponConfig.isSuper
                              ? 'bg-purple-600 text-white border-purple-900 animate-pulse'
                              : 'bg-slate-100 text-slate-700 border-slate-300'
                          }`}>
                            {activeWeaponConfig.isSuper ? '⚡ SUPER' : `T${activeWeaponConfig.tier}`}
                          </span>
                        )}
                      </div>
                      <div className="text-[9px] font-bold text-slate-500">
                        {activeWeaponConfig ? 'Mouse Aim + Left Click / F' : 'Weak Melee • Find Weapon Spawns!'}
                      </div>
                    </div>
                  </div>

                  {activeWeaponConfig ? (
                    <div className="flex flex-col items-end">
                      {activeWeaponConfig.isSuper ? (
                        <div className="font-mono font-black text-xs text-white bg-purple-600 px-2 py-0.5 rounded-lg border border-black animate-pulse flex items-center gap-1">
                          <span>∞ AMMO</span>
                          <span className="bg-white text-purple-900 px-1 rounded text-[10px]">
                            {Math.max(0, Math.ceil(myFighter.superWeaponTimer || 0))}s
                          </span>
                        </div>
                      ) : (
                        <>
                          <div className="font-mono font-black text-xs text-black bg-amber-100 px-1.5 py-0.5 rounded border border-amber-400">
                            {activeAmmo} / {activeWeaponConfig.ammoCapacity}
                          </div>
                          <div className="flex gap-0.5 mt-1">
                            {Array.from({ length: 10 }).map((_, i) => (
                              <div
                                key={i}
                                className={`w-1.5 h-1.5 rounded-xs border border-black ${
                                  i < activeAmmo ? 'bg-amber-400' : 'bg-slate-200'
                                }`}
                              />
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <span className="text-[10px] font-black text-slate-400 uppercase">
                      NO AMMO
                    </span>
                  )}
                </div>

                {/* Collected Weapon Slots Carousel */}
                {collectedWeaponsList.length > 0 && (
                  <div className="flex items-center gap-1 mt-2 pt-1.5 border-t border-slate-100 overflow-x-auto pb-0.5">
                    <span className="text-[9px] font-black text-slate-400 uppercase shrink-0">
                      Slots:
                    </span>
                    {collectedWeaponsList.map(([wType, ammo], idx) => {
                      const cfg = WEAPONS_CONFIG[wType];
                      const isSelected = myFighter.activeWeapon === wType;
                      return (
                        <button
                          key={wType}
                          onClick={(e) => {
                            e.stopPropagation();
                            switchWeaponDirectly(wType);
                          }}
                          className={`px-1.5 py-0.5 rounded-lg border-2 text-[10px] font-black flex items-center gap-1 cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-amber-300 border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] scale-105'
                              : 'bg-slate-100 border-slate-300 hover:bg-slate-200 text-slate-700'
                          }`}
                          title={`Switch to ${cfg.name} (Key ${idx + 1})`}
                        >
                          <span>{cfg.icon}</span>
                          <span className="font-mono text-[9px]">{ammo}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white/90 rounded-2xl border-3 border-black p-2 font-black text-xs">
              Connecting fighter...
            </div>
          )}

          {/* Center: Synchronized Match Timer & Mode Badge */}
          <div className="bg-[#FFD700] rounded-2xl border-3 border-black px-4 py-1.5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-center shrink-0">
            <div className="text-[10px] font-black uppercase tracking-wider text-black flex items-center justify-center gap-1">
              {room.mode === 'duel'
                ? `ROUND ${room.currentDuelRound || 1} / ${room.duelRoundsTotal || 5}`
                : `MATCH TIME (${fightersList.length} FIGHTERS)`}
            </div>
            <div className="text-xl sm:text-2xl font-black text-black font-mono tracking-wider">
              {formatTime(room.roundTimer)}
            </div>
          </div>

          {/* Top Right: Scoreboard Dropdown Trigger, Sound & Leave Buttons */}
          <div className="flex items-center gap-2 pointer-events-auto shrink-0">
            <button
              id="btn_toggle_scoreboard"
              onClick={() => setIsScoreboardOpen((prev) => !prev)}
              className={`px-3 py-2 rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                isScoreboardOpen
                  ? 'bg-amber-400 text-black'
                  : 'bg-white text-black hover:bg-slate-100'
              }`}
              title="Toggle Scoreboard (Tab)"
            >
              <Trophy className="w-4 h-4 text-amber-600" />
              <span className="hidden sm:inline">SCOREBOARD</span>
              <span>{isScoreboardOpen ? '▲' : '▼'}</span>
            </button>

            <button
              onClick={() => {
                const next = !soundMuted;
                setSoundMuted(next);
                sound.setMuted(next);
              }}
              className="p-2 bg-white text-black rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-slate-100 transition-all cursor-pointer"
              title="Toggle Sound"
            >
              {soundMuted ? <VolumeX className="w-5 h-5 text-rose-500" /> : <Volume2 className="w-5 h-5 text-black" />}
            </button>

            <button
              id="btn_back_to_lobby"
              onClick={() => {
                sound.playJump();
                onReturnToLobby();
              }}
              className="px-3 py-2 bg-white text-black rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-amber-100 transition-all cursor-pointer flex items-center gap-1.5 font-black text-xs"
              title="Return to Room (ESC)"
            >
              <Home className="w-4 h-4 text-black" />
              <span className="hidden sm:inline">Back</span>
            </button>
          </div>
        </div>
      ) : (
        /* Map Preview Mode Pill Banner */
        <div className="absolute top-3 inset-x-4 flex items-center justify-between pointer-events-none z-20">
          <div className="bg-[#FFD700] rounded-2xl border-3 border-black px-4 py-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center gap-2 pointer-events-auto">
            <Compass className="w-5 h-5 text-black animate-spin" style={{ animationDuration: '6s' }} />
            <div>
              <div className="font-black text-xs sm:text-sm uppercase text-black">
                Map Preview: {currentArena.name} ({currentArena.size.toUpperCase()})
              </div>
              <div className="text-[10px] font-bold text-slate-800">
                Collect weapons from spawns, test mouse aim & shooting • Press ESC to return
              </div>
            </div>
          </div>
          <button
            onClick={() => onReturnToLobby()}
            className="px-3 py-2 bg-white text-black rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-black text-xs cursor-pointer pointer-events-auto flex items-center gap-1.5"
          >
            <Home className="w-4 h-4 text-black" />
            <span>Exit Preview</span>
          </button>
        </div>
      )}

      {/* 3. Collapsible Scoreboard Dropdown Panel */}
      <AnimatePresence>
        {!isPreviewMode && isScoreboardOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute top-20 right-3 sm:right-6 bg-white/95 backdrop-blur-xs rounded-2xl border-3 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-3 z-30 w-[270px] sm:w-[320px] pointer-events-auto"
          >
            <div className="flex items-center justify-between border-b-2 border-black pb-1.5 mb-2">
              <div className="flex items-center gap-1.5">
                <Trophy className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-black uppercase text-black tracking-wider">
                  LIVE SCOREBOARD
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black text-slate-500 uppercase">
                  +2 Kill • -1 Death
                </span>
                <button
                  onClick={() => setIsScoreboardOpen(false)}
                  className="w-5 h-5 flex items-center justify-center rounded-md bg-slate-100 hover:bg-slate-200 text-black font-black text-xs border border-black cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
              {sortedFighters.map((f, index) => {
                const isLeader = index === 0;
                const isMe = f.id === myId;

                return (
                  <div
                    key={f.id}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl border-2 border-black text-xs font-black transition-all ${
                      isLeader
                        ? 'bg-amber-100 border-amber-500 shadow-xs'
                        : isMe
                        ? 'bg-sky-100 border-sky-400'
                        : 'bg-white border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate max-w-[170px]">
                      <span
                        className={`text-xs w-4 font-mono font-black ${
                          isLeader ? 'text-amber-700' : 'text-slate-500'
                        }`}
                      >
                        {index + 1}.
                      </span>
                      <span
                        className="w-3 h-3 rounded-full border border-black shrink-0"
                        style={{ backgroundColor: f.color }}
                      />
                      <span className="truncate text-black font-black">
                        {f.name}
                      </span>
                      {isMe && (
                        <span className="text-[9px] bg-sky-200 text-sky-900 px-1 py-0.2 rounded font-black">
                          YOU
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0 font-mono">
                      <span className="text-[10px] text-slate-500 font-bold">
                        {f.kills || 0}K/{f.deaths || 0}D
                      </span>
                      <span
                        className={`text-xs font-black px-2 py-0.5 rounded border ${
                          (f.score || 0) >= 0
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : 'bg-rose-100 text-rose-800 border-rose-300'
                        }`}
                      >
                        {(f.score || 0) >= 0 ? `+${f.score || 0}` : `${f.score || 0}`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4. Live Respawn Notice (FFA Mode) */}
      <AnimatePresence>
        {!isPreviewMode && room.mode === 'ffa' && myFighter?.isDead && room.status === 'in_game' && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-24 left-1/2 -translate-x-1/2 bg-rose-600 border-3 border-black text-white px-5 py-2.5 rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] z-30 font-black text-sm flex items-center gap-2.5"
          >
            <span>💀 Knocked Out!</span>
            <span>Respawning in {Math.max(0.1, myFighter.respawnTimer || 0).toFixed(1)}s...</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 5. Match Countdown Banner ("3, 2, 1, FIGHT!") */}
      <AnimatePresence>
        {!isPreviewMode && room.status === 'countdown' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
            <motion.div
              key={room.countdown}
              initial={{ scale: 0.2, rotate: -15, opacity: 0 }}
              animate={{ scale: 1.2, rotate: 0, opacity: 1 }}
              exit={{ scale: 1.8, opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="bg-[#FFD700] border-6 border-black px-8 py-4 rounded-3xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-center"
            >
              <div className="text-sm font-black text-black uppercase tracking-widest mb-1">
                {room.mode === 'duel' ? `ROUND ${room.currentDuelRound || 1}` : 'GET READY'}
              </div>
              <h1 className="text-5xl sm:text-7xl font-black text-black uppercase tracking-tighter drop-shadow-md">
                {room.countdown > 0 ? room.countdown : 'BRAWL!'}
              </h1>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 6. Round End / Victory & Final Leaderboard Modal Overlay */}
      <AnimatePresence>
        {!isPreviewMode && room.status === 'round_end' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-40"
          >
            <div className="bg-white rounded-3xl border-6 border-black p-5 sm:p-7 max-w-lg w-full shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] text-center space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="inline-flex p-3 rounded-2xl bg-[#FFD700] border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <Trophy className="w-10 h-10 text-black" />
              </div>

              <div>
                <span className="text-xs font-black text-amber-700 uppercase tracking-widest">
                  MATCH COMPLETED
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-black uppercase tracking-tight mt-0.5">
                  {winnerFighter ? `${winnerFighter.name} Wins!` : 'Match Draw!'}
                </h2>
                <p className="text-xs font-bold text-slate-600 mt-0.5">
                  Scoring Rule: Kills (+2) • Deaths (-1)
                </p>
              </div>

              {/* Final Leaderboard Table */}
              <div className="bg-slate-50 rounded-2xl border-3 border-black p-3 text-left space-y-2">
                <div className="text-xs font-black text-black uppercase tracking-wider flex items-center justify-between pb-1 border-b-2 border-slate-200">
                  <span>Rank & Fighter</span>
                  <div className="flex gap-4 pr-1 text-slate-600">
                    <span>K</span>
                    <span>D</span>
                    <span className="text-black font-black">Score</span>
                  </div>
                </div>

                <div className="space-y-1.5 max-h-44 overflow-y-auto">
                  {(room.finalLeaderboard && room.finalLeaderboard.length > 0
                    ? room.finalLeaderboard
                    : sortedFighters.map((f, i) => ({
                        id: f.id,
                        name: f.name,
                        color: f.color,
                        kills: f.kills || 0,
                        deaths: f.deaths || 0,
                        score: f.score || 0,
                        rank: i + 1,
                      }))
                  ).map((entry, idx) => {
                    const isChampion = idx === 0;
                    const isMe = entry.id === myId;
                    return (
                      <div
                        key={entry.id}
                        className={`flex items-center justify-between p-2 rounded-xl border-2 border-black font-black text-xs ${
                          isChampion
                            ? 'bg-amber-100 border-amber-500'
                            : isMe
                            ? 'bg-sky-100 border-sky-400'
                            : 'bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] text-white font-black shrink-0 ${
                              idx === 0
                                ? 'bg-amber-500'
                                : idx === 1
                                ? 'bg-slate-400'
                                : idx === 2
                                ? 'bg-amber-700'
                                : 'bg-slate-700'
                            }`}
                          >
                            {idx + 1}
                          </span>
                          <span
                            className="w-3 h-3 rounded-full border border-black shrink-0"
                            style={{ backgroundColor: entry.color }}
                          />
                          <span className="truncate max-w-[130px] text-black">
                            {entry.name} {isMe && '(You)'}
                          </span>
                        </div>

                        <div className="flex gap-4 pr-1 font-mono text-xs">
                          <span className="w-5 text-right text-emerald-700">{entry.kills}</span>
                          <span className="w-5 text-right text-rose-600">{entry.deaths}</span>
                          <span className="w-8 text-right font-black text-black bg-amber-200/80 px-1 rounded">
                            {entry.score}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons: Rematch & Back to Room Lobby */}
              {(() => {
                const isHost = room.hostId === myId || myId === 'local_player';
                const isMyPlayerReady = myFighter?.isReady || false;

                return (
                  <div className="space-y-2">
                    <div className="pt-1 flex flex-col sm:flex-row gap-2.5">
                      {isHost ? (
                        <button
                          id="btn_rematch"
                          onClick={() => {
                            sound.playReplayStinger();
                            onRestartMatch();
                          }}
                          className="flex-1 py-3 bg-[#10B981] hover:bg-emerald-400 text-white font-black text-sm rounded-xl border-3 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] transition-all cursor-pointer flex items-center justify-center gap-2"
                        >
                          <RotateCcw className="w-4 h-4" />
                          <span>PLAY AGAIN (OWNER)</span>
                        </button>
                      ) : (
                        <button
                          id="btn_postmatch_ready"
                          onClick={() => {
                            sound.playJump();
                            if (onReadyToggle) onReadyToggle(!isMyPlayerReady);
                          }}
                          className={`flex-1 py-3 font-black text-sm rounded-xl border-3 border-black transition-all cursor-pointer flex items-center justify-center gap-2 ${
                            isMyPlayerReady
                              ? 'bg-[#FFD700] hover:bg-[#ffe234] text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
                              : 'bg-[#10B981] hover:bg-emerald-400 text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                          }`}
                        >
                          <RotateCcw className="w-4 h-4" />
                          <span>{isMyPlayerReady ? 'READY ✓ (WAITING OWNER)' : "I'M READY FOR REMATCH!"}</span>
                        </button>
                      )}

                      <button
                        id="btn_return_lobby"
                        onClick={() => {
                          sound.playBack();
                          onReturnToLobby();
                        }}
                        className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-black font-black text-sm rounded-xl border-3 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer flex items-center justify-center gap-2"
                      >
                        <Home className="w-4 h-4 text-black" />
                        <span>BACK TO ROOM</span>
                      </button>
                    </div>

                    {!isHost && (
                      <p className="text-[11px] font-bold text-slate-500">
                        {isMyPlayerReady
                          ? '✅ You are marked ready for rematch. Waiting for Room Owner to launch.'
                          : 'Click "I\'M READY FOR REMATCH!" to signal the Room Owner.'}
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 7. Bottom-Right Comic Connection Status & Performance Badge */}
      {!isPreviewMode && showHud && (
        <div
          id="performance_hud"
          className="absolute bottom-3 right-3 sm:bottom-4 sm:right-6 z-20 pointer-events-auto bg-white/95 backdrop-blur-xs rounded-2xl border-2 sm:border-3 border-black px-3 py-1.5 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] sm:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center gap-2 sm:gap-2.5 font-mono text-[10px] sm:text-xs font-black select-none"
        >
          {/* Connection State Dot & Label */}
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2.5 h-2.5 rounded-full border border-black shrink-0 ${
                netStatus === 'CONNECTED'
                  ? 'bg-emerald-400 animate-pulse'
                  : netStatus === 'RECONNECTING'
                  ? 'bg-amber-400 animate-ping'
                  : 'bg-rose-500'
              }`}
            />
            <span
              className={`uppercase tracking-wider font-black ${
                netStatus === 'CONNECTED'
                  ? 'text-emerald-700'
                  : netStatus === 'RECONNECTING'
                  ? 'text-amber-700'
                  : 'text-rose-700'
              }`}
            >
              {netStatus === 'CONNECTED' ? 'ONLINE' : netStatus === 'RECONNECTING' ? 'RECONNECTING' : 'OFFLINE'}
            </span>
          </div>

          <span className="text-slate-300 font-bold">|</span>

          {/* Ping Latency Metric */}
          <div className="flex items-center gap-1">
            <span className="text-slate-500 font-bold">PING:</span>
            <span
              className={`font-black ${
                ping < 70 ? 'text-emerald-600' : ping < 150 ? 'text-amber-600' : 'text-rose-600'
              }`}
            >
              {ping > 0 ? `${ping}ms` : '--'}
            </span>
          </div>

          <span className="text-slate-300 font-bold">|</span>

          {/* Client Rendering FPS Metric */}
          <div className="flex items-center gap-1">
            <span className="text-slate-500 font-bold">FPS:</span>
            <span
              className={`font-black ${
                fps >= 55 ? 'text-emerald-600' : fps >= 30 ? 'text-amber-600' : 'text-rose-600'
              }`}
            >
              {fps}
            </span>
          </div>

          <span className="text-slate-300 font-bold">|</span>

          {/* Server Physics Simulation Tick Rate */}
          <div className="flex items-center gap-1 text-sky-700">
            <span className="text-slate-500 font-bold">TICK:</span>
            <span className="font-black">30Hz</span>
          </div>
        </div>
      )}
    </div>
  );
};

