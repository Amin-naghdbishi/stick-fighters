import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Save,
  Play,
  ArrowLeft,
  Undo,
  Redo,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Grid,
  Trash2,
  Copy,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Plus,
  Compass,
  Layers,
  Sparkles,
  Zap,
  Sliders,
  Settings,
  HelpCircle,
  Eye,
  Check,
  ChevronRight,
  ChevronDown,
  Palette,
  Crosshair,
  Shield,
  FilePlus,
  Trash,
} from 'lucide-react';
import {
  Arena,
  CustomDecoration,
  DecorationType,
  MapSize,
  Platform,
  WeaponSpawnPoint,
  WeaponType,
} from '../types/game';
import {
  createDefaultCustomMap,
  deleteCustomMap,
  duplicateCustomMap,
  getCustomMaps,
  MAP_SIZE_PRESETS,
  saveCustomMap,
  validateAndSanitizeMap,
} from '../game/customMaps';
import { sound } from '../game/audio';
import { ALL_WEAPON_CONFIGS, SUPER_WEAPONS, WEAPONS_CONFIG } from '../game/weapons';
import { GameRenderer } from '../game/renderer';

interface MapEditorProps {
  initialMapId?: string;
  onExit: () => void;
  onTestMap: (arena: Arena) => void;
}

type EditorTool = 'select' | 'pan' | 'add_platform' | 'add_decoration' | 'add_weapon' | 'add_super_weapon' | 'add_player_spawn';

type SelectedItem =
  | { kind: 'platform'; index: number; id: string }
  | { kind: 'decoration'; index: number; id: string }
  | { kind: 'weaponSpawn'; index: number; id: string }
  | { kind: 'playerSpawn'; index: number }
  | null;

const PRESET_COLORS = [
  '#15803D', '#22C55E', '#16A34A', '#84CC16', '#EAB308',
  '#F97316', '#EF4444', '#EC4899', '#A855F7', '#6366F1',
  '#3B82F6', '#06B6D4', '#14B8A6', '#64748B', '#1E293B',
  '#FFFFFF', '#E5A65D', '#8D6E63', '#B45309', '#78350F',
];

const BG_COLOR_PRESETS = [
  { name: 'Sunny Sky', color: '#E3F6FD' },
  { name: 'Warm Sunset', color: '#FFF1E6' },
  { name: 'Emerald Forest', color: '#E8F8F0' },
  { name: 'Amethyst Crystal', color: '#F3E8FF' },
  { name: 'Golden Aurora', color: '#FEF3C7' },
  { name: 'Turquoise Twilight', color: '#CCFBF1' },
  { name: 'Midnight Blue', color: '#1E293B' },
  { name: 'Pure Paper White', color: '#FAFAFA' },
];

export const MapEditor: React.FC<MapEditorProps> = ({
  initialMapId,
  onExit,
  onTestMap,
}) => {
  // Load or create initial map
  const [map, setMap] = useState<Arena>(() => {
    if (initialMapId) {
      const existing = getCustomMaps().find((m) => m.id === initialMapId);
      if (existing) return existing;
    }
    const maps = getCustomMaps();
    if (maps.length > 0) return maps[0];
    return createDefaultCustomMap('medium');
  });

  const [history, setHistory] = useState<Arena[]>([]);
  const [redoStack, setRedoStack] = useState<Arena[]>([]);
  const [activeTool, setActiveTool] = useState<EditorTool>('select');
  const [selectedItem, setSelectedItem] = useState<SelectedItem>(null);
  const [gridSnap, setGridSnap] = useState<number>(20); // 0 = off, 20, 40
  const [zoom, setZoom] = useState<number>(0.65);
  const [panX, setPanX] = useState<number>(0);
  const [panY, setPanY] = useState<number>(0);
  const [activePaletteTab, setActivePaletteTab] = useState<'platforms' | 'decorations' | 'spawns' | 'maps'>('platforms');
  const [showSaveToast, setShowSaveToast] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedWeaponForSpawn, setSelectedWeaponForSpawn] = useState<WeaponType>('shotgun');
  const [selectedSuperWeaponForSpawn, setSelectedSuperWeaponForSpawn] = useState<WeaponType>('plasma_vortex');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDraggingRef = useRef(false);
  const dragModeRef = useRef<'move' | 'pan' | 'resize' | 'rotate' | null>(null);
  const dragHandleRef = useRef<string | null>(null);
  const lastMouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const startObjPosRef = useRef<{ x: number; y: number; w?: number; h?: number; rot?: number; scale?: number }>({ x: 0, y: 0 });

  // Commit changes to undo history
  const pushHistory = useCallback((newMap: Arena) => {
    setHistory((prev) => [...prev.slice(-25), map]);
    setRedoStack([]);
    setMap(newMap);
  }, [map]);

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setRedoStack((r) => [...r, map]);
    setHistory((h) => h.slice(0, -1));
    setMap(prev);
    setSelectedItem(null);
    sound.playJump();
  }, [history, map]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setHistory((h) => [...h, map]);
    setRedoStack((r) => r.slice(0, -1));
    setMap(next);
    setSelectedItem(null);
    sound.playJump();
  }, [redoStack, map]);

  // Center & fit map on load
  const fitMapToScreen = useCallback(() => {
    if (!canvasRef.current) return;
    const parent = canvasRef.current.parentElement;
    const cw = parent && parent.clientWidth > 100 ? parent.clientWidth : window.innerWidth - 320;
    const ch = parent && parent.clientHeight > 100 ? parent.clientHeight : window.innerHeight - 80;
    const scaleX = (cw - 80) / map.width;
    const scaleY = (ch - 80) / map.height;
    const newZoom = Math.max(0.15, Math.min(1.2, Math.min(scaleX, scaleY)));
    setZoom(newZoom);
    setPanX(Math.max(20, (cw - map.width * newZoom) / 2));
    setPanY(Math.max(20, (ch - map.height * newZoom) / 2));
  }, [map.width, map.height]);

  useEffect(() => {
    fitMapToScreen();
    const t = setTimeout(fitMapToScreen, 60);
    window.addEventListener('resize', fitMapToScreen);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', fitMapToScreen);
    };
  }, [fitMapToScreen]);

  // Save map to storage
  const handleSave = useCallback(() => {
    sound.playCountdownBeep(true);
    saveCustomMap(map);
    setShowSaveToast(true);
    setTimeout(() => setShowSaveToast(false), 2200);
  }, [map]);

  // Play / Test current map
  const handleTestPlay = useCallback(() => {
    sound.playCountdownBeep(true);
    saveCustomMap(map);
    onTestMap(map);
  }, [map, onTestMap]);

  // Screen to World coords
  const screenToWorld = useCallback((sx: number, sy: number) => {
    return {
      x: (sx - panX) / zoom,
      y: (sy - panY) / zoom,
    };
  }, [panX, panY, zoom]);

  // Snap to grid helper
  const snap = useCallback((val: number) => {
    if (gridSnap <= 0) return val;
    return Math.round(val / gridSnap) * gridSnap;
  }, [gridSnap]);

  // Add Object Handlers
  const addPlatform = (type: 'ground' | 'wood' | 'stone' | 'bounce' | 'cloud') => {
    sound.playComicPop();
    const centerX = snap(map.width / 2 - 100);
    const centerY = snap(map.height / 2);
    const newPlat: Platform = {
      id: `plat_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      x: centerX,
      y: centerY,
      width: type === 'bounce' ? 70 : 200,
      height: type === 'ground' ? 60 : 24,
      color: type === 'ground' ? '#15803D' : type === 'wood' ? '#E5A65D' : type === 'stone' ? '#64748B' : type === 'bounce' ? '#FF5252' : '#FFFFFF',
      type: type === 'bounce' ? 'bounce' : type === 'ground' ? 'ground' : 'wood',
      isPassableDown: type === 'wood' || type === 'cloud',
    };

    const newPlatforms = [...map.platforms, newPlat];
    pushHistory({ ...map, platforms: newPlatforms });
    setSelectedItem({ kind: 'platform', index: newPlatforms.length - 1, id: newPlat.id });
    setActiveTool('select');
  };

  const addDecoration = (type: DecorationType) => {
    sound.playComicPop();
    const centerX = snap(map.width / 2);
    const centerY = snap(map.height / 2);
    const newDec: CustomDecoration = {
      id: `dec_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      type,
      x: centerX,
      y: centerY,
      scale: 1,
      rotation: 0,
      layer: 'background',
      color: type === 'rect' ? '#3B82F6' : type === 'circle' ? '#EC4899' : type === 'star' ? '#FDE047' : undefined,
    };

    const newDecorations = [...(map.decorations || []), newDec];
    pushHistory({ ...map, decorations: newDecorations });
    setSelectedItem({ kind: 'decoration', index: newDecorations.length - 1, id: newDec.id });
    setActiveTool('select');
  };

  const addWeaponSpawn = (wType: WeaponType) => {
    sound.playComicPop();
    const centerX = snap(map.width / 2);
    const centerY = snap(map.height / 2);
    const isSuper = SUPER_WEAPONS.includes(wType);
    const newSpawn: WeaponSpawnPoint = {
      id: `wpn_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      weaponType: wType,
      x: centerX,
      y: centerY,
      respawnTime: isSuper ? 30 : 8,
    };

    const newSpawns = [...map.weaponSpawns, newSpawn];
    pushHistory({ ...map, weaponSpawns: newSpawns });
    setSelectedItem({ kind: 'weaponSpawn', index: newSpawns.length - 1, id: newSpawn.id });
    setActiveTool('select');
  };

  const addPlayerSpawn = () => {
    if (map.spawnPoints.length >= 10) return;
    sound.playComicPop();
    const centerX = snap(map.width / 2);
    const centerY = snap(map.height / 2);
    const newPoints = [...map.spawnPoints, { x: centerX, y: centerY }];
    pushHistory({ ...map, spawnPoints: newPoints });
    setSelectedItem({ kind: 'playerSpawn', index: newPoints.length - 1 });
    setActiveTool('select');
  };

  // Delete Selected Item
  const handleDeleteSelected = useCallback(() => {
    if (!selectedItem) return;
    sound.playComicPop();

    if (selectedItem.kind === 'platform') {
      const newPlats = map.platforms.filter((_, idx) => idx !== selectedItem.index);
      pushHistory({ ...map, platforms: newPlats });
    } else if (selectedItem.kind === 'decoration') {
      const newDecs = (map.decorations || []).filter((_, idx) => idx !== selectedItem.index);
      pushHistory({ ...map, decorations: newDecs });
    } else if (selectedItem.kind === 'weaponSpawn') {
      const newWpns = map.weaponSpawns.filter((_, idx) => idx !== selectedItem.index);
      pushHistory({ ...map, weaponSpawns: newWpns });
    } else if (selectedItem.kind === 'playerSpawn') {
      if (map.spawnPoints.length <= 1) return; // Keep at least 1 spawn
      const newSpawns = map.spawnPoints.filter((_, idx) => idx !== selectedItem.index);
      pushHistory({ ...map, spawnPoints: newSpawns });
    }
    setSelectedItem(null);
  }, [selectedItem, map, pushHistory]);

  // Duplicate Selected Item
  const handleDuplicateSelected = useCallback(() => {
    if (!selectedItem) return;
    sound.playComicPop();

    if (selectedItem.kind === 'platform') {
      const orig = map.platforms[selectedItem.index];
      if (!orig) return;
      const copy: Platform = {
        ...orig,
        id: `plat_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        x: orig.x + 30,
        y: orig.y + 30,
      };
      const newPlats = [...map.platforms, copy];
      pushHistory({ ...map, platforms: newPlats });
      setSelectedItem({ kind: 'platform', index: newPlats.length - 1, id: copy.id });
    } else if (selectedItem.kind === 'decoration') {
      const orig = (map.decorations || [])[selectedItem.index];
      if (!orig) return;
      const copy: CustomDecoration = {
        ...orig,
        id: `dec_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        x: orig.x + 30,
        y: orig.y + 30,
      };
      const newDecs = [...(map.decorations || []), copy];
      pushHistory({ ...map, decorations: newDecs });
      setSelectedItem({ kind: 'decoration', index: newDecs.length - 1, id: copy.id });
    } else if (selectedItem.kind === 'weaponSpawn') {
      const orig = map.weaponSpawns[selectedItem.index];
      if (!orig) return;
      const copy: WeaponSpawnPoint = {
        ...orig,
        id: `wpn_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        x: orig.x + 30,
        y: orig.y + 30,
      };
      const newWpns = [...map.weaponSpawns, copy];
      pushHistory({ ...map, weaponSpawns: newWpns });
      setSelectedItem({ kind: 'weaponSpawn', index: newWpns.length - 1, id: copy.id });
    }
  }, [selectedItem, map, pushHistory]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        handleDuplicateSelected();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        handleDeleteSelected();
      } else if (e.key === ' ') {
        setActiveTool((prev) => (prev === 'pan' ? 'select' : 'pan'));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, handleSave, handleDuplicateSelected, handleDeleteSelected]);

  // Map Rendering on Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // High DPI Canvas Scaling
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    ctx.save();
    ctx.scale(dpr, dpr);

    // Clear background
    ctx.fillStyle = '#0F172A'; // Dark editor canvas surrounding
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Apply Pan & Zoom
    ctx.save();
    ctx.translate(panX, panY);
    ctx.scale(zoom, zoom);

    // 1. Map Arena Background Card
    ctx.fillStyle = map.bgColor || '#E3F6FD';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetX = 8;
    ctx.shadowOffsetY = 8;
    ctx.fillRect(0, 0, map.width, map.height);
    ctx.shadowColor = 'transparent';

    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 4 / zoom;
    ctx.strokeRect(0, 0, map.width, map.height);

    // 2. Editor Grid Overlay (if grid snap active)
    if (gridSnap > 0) {
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.06)';
      ctx.lineWidth = 1 / zoom;
      ctx.beginPath();
      for (let x = gridSnap; x < map.width; x += gridSnap) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, map.height);
      }
      for (let y = gridSnap; y < map.height; y += gridSnap) {
        ctx.moveTo(0, y);
        ctx.lineTo(map.width, y);
      }
      ctx.stroke();
    }

    // Temporary renderer instance for drawing rich objects
    const dummyRenderer = new GameRenderer(ctx);

    // 3. Draw Background Layer Decorations
    dummyRenderer.drawCustomDecorations(map, 'background', 0);

    // 4. Draw Platforms
    for (let i = 0; i < map.platforms.length; i++) {
      const plat = map.platforms[i];
      const isSelected = selectedItem?.kind === 'platform' && selectedItem.index === i;

      ctx.save();
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = '#1E293B';

      if (plat.type === 'bounce') {
        ctx.fillStyle = plat.color || '#FF5252';
        dummyRenderer.roundRect(ctx, plat.x, plat.y, plat.width, plat.height, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.moveTo(plat.x + plat.width / 2 - 14, plat.y + plat.height / 2 + 5);
        ctx.lineTo(plat.x + plat.width / 2, plat.y + plat.height / 2 - 7);
        ctx.lineTo(plat.x + plat.width / 2 + 14, plat.y + plat.height / 2 + 5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (plat.isPassableDown) {
        ctx.fillStyle = plat.color || '#E5A65D';
        dummyRenderer.roundRect(ctx, plat.x, plat.y, plat.width, plat.height, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.globalAlpha = 0.35;
        dummyRenderer.roundRect(ctx, plat.x + 4, plat.y + 3, plat.width - 8, 4, 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
      } else {
        ctx.fillStyle = '#8D6E63';
        ctx.fillRect(plat.x, plat.y + 16, plat.width, plat.height - 16);
        ctx.strokeRect(plat.x, plat.y + 16, plat.width, plat.height - 16);

        ctx.fillStyle = plat.color || '#66BB6A';
        dummyRenderer.roundRect(ctx, plat.x - 4, plat.y, plat.width + 8, 24, 6);
        ctx.fill();
        ctx.stroke();
      }

      // Selection outline & handles
      if (isSelected) {
        ctx.strokeStyle = '#3B82F6';
        ctx.lineWidth = 3 / zoom;
        ctx.setLineDash([6 / zoom, 6 / zoom]);
        ctx.strokeRect(plat.x - 6, plat.y - 6, plat.width + 12, plat.height + 12);
        ctx.setLineDash([]);

        // Resize handles (Right & Bottom-Right)
        ctx.fillStyle = '#3B82F6';
        const hSize = 10 / zoom;
        ctx.fillRect(plat.x + plat.width + 2, plat.y + plat.height / 2 - hSize / 2, hSize, hSize);
        ctx.fillRect(plat.x + plat.width + 2, plat.y + plat.height + 2, hSize, hSize);
      }
      ctx.restore();
    }

    // 5. Draw Gameplay Layer Decorations
    dummyRenderer.drawCustomDecorations(map, 'gameplay', 0);

    // 6. Draw Foreground Layer Decorations
    dummyRenderer.drawCustomDecorations(map, 'foreground', 0);

    // Draw Decoration Selection Outlines
    if (selectedItem?.kind === 'decoration' && map.decorations) {
      const dec = map.decorations[selectedItem.index];
      if (dec) {
        ctx.save();
        ctx.translate(dec.x, dec.y);
        if (dec.rotation) ctx.rotate(dec.rotation);
        const boundSize = 80 * (dec.scale || 1);
        ctx.strokeStyle = '#3B82F6';
        ctx.lineWidth = 3 / zoom;
        ctx.setLineDash([6 / zoom, 6 / zoom]);
        ctx.strokeRect(-boundSize / 2 - 8, -boundSize / 2 - 8, boundSize + 16, boundSize + 16);
        ctx.setLineDash([]);

        // Rotation handle on top
        ctx.fillStyle = '#F59E0B';
        ctx.beginPath();
        ctx.arc(0, -boundSize / 2 - 24, 7 / zoom, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#1E293B';
        ctx.lineWidth = 2 / zoom;
        ctx.stroke();

        ctx.restore();
      }
    }

    // 7. Draw Player Spawn Point Markers (Editor only visualization)
    for (let i = 0; i < map.spawnPoints.length; i++) {
      const sp = map.spawnPoints[i];
      const isSelected = selectedItem?.kind === 'playerSpawn' && selectedItem.index === i;

      ctx.save();
      ctx.translate(sp.x, sp.y);

      ctx.fillStyle = isSelected ? '#3B82F6' : '#10B981';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;

      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`P${i + 1}`, 0, 1);

      // Label below
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(`🥋 Spawn ${i + 1}`, 0, 32);

      if (isSelected) {
        ctx.strokeStyle = '#3B82F6';
        ctx.lineWidth = 3 / zoom;
        ctx.setLineDash([4 / zoom, 4 / zoom]);
        ctx.strokeRect(-28, -28, 56, 56);
      }
      ctx.restore();
    }

    // 8. Draw Weapon Spawn Markers (Editor only visualization)
    for (let i = 0; i < map.weaponSpawns.length; i++) {
      const wsp = map.weaponSpawns[i];
      const isSelected = selectedItem?.kind === 'weaponSpawn' && selectedItem.index === i;
      const isSuper = SUPER_WEAPONS.includes(wsp.weaponType);
      const wName = WEAPONS_CONFIG[wsp.weaponType]?.name || wsp.weaponType;

      ctx.save();
      ctx.translate(wsp.x, wsp.y);

      // Draw pedestal/marker ring
      ctx.fillStyle = isSuper ? '#9333EA' : '#F59E0B';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;

      dummyRenderer.roundRect(ctx, -24, -16, 48, 32, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(isSuper ? '🌌' : '⚡', 0, 0);

      // Weapon Name Tag
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(`${wName}`, 0, 26);

      if (isSelected) {
        ctx.strokeStyle = '#3B82F6';
        ctx.lineWidth = 3 / zoom;
        ctx.setLineDash([4 / zoom, 4 / zoom]);
        ctx.strokeRect(-32, -22, 64, 60);
      }
      ctx.restore();
    }

    ctx.restore();
    ctx.restore();
  }, [map, panX, panY, zoom, selectedItem, gridSnap]);

  // Mouse Interaction Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const world = screenToWorld(sx, sy);

    lastMouseRef.current = { x: sx, y: sy };

    // Pan mode (middle-click, space held, or pan tool)
    if (e.button === 1 || e.button === 2 || activeTool === 'pan' || e.shiftKey) {
      isDraggingRef.current = true;
      dragModeRef.current = 'pan';
      return;
    }

    // Select Tool Hit Testing (Top-to-bottom order: Spawns -> Weapons -> Platforms -> Decorations)
    // 1. Check Player Spawns
    for (let i = map.spawnPoints.length - 1; i >= 0; i--) {
      const sp = map.spawnPoints[i];
      if (Math.hypot(world.x - sp.x, world.y - sp.y) < 28) {
        setSelectedItem({ kind: 'playerSpawn', index: i });
        isDraggingRef.current = true;
        dragModeRef.current = 'move';
        startObjPosRef.current = { x: sp.x, y: sp.y };
        sound.playComicPop();
        return;
      }
    }

    // 2. Check Weapon Spawns
    for (let i = map.weaponSpawns.length - 1; i >= 0; i--) {
      const wsp = map.weaponSpawns[i];
      if (Math.abs(world.x - wsp.x) < 30 && Math.abs(world.y - wsp.y) < 25) {
        setSelectedItem({ kind: 'weaponSpawn', index: i, id: wsp.id });
        isDraggingRef.current = true;
        dragModeRef.current = 'move';
        startObjPosRef.current = { x: wsp.x, y: wsp.y };
        sound.playComicPop();
        return;
      }
    }

    // 3. Check Platforms & Handles
    for (let i = map.platforms.length - 1; i >= 0; i--) {
      const p = map.platforms[i];
      if (world.x >= p.x && world.x <= p.x + p.width && world.y >= p.y && world.y <= p.y + p.height) {
        setSelectedItem({ kind: 'platform', index: i, id: p.id });
        isDraggingRef.current = true;
        dragModeRef.current = 'move';
        startObjPosRef.current = { x: p.x, y: p.y, w: p.width, h: p.height };
        sound.playComicPop();
        return;
      }
    }

    // 4. Check Decorations
    if (map.decorations) {
      for (let i = map.decorations.length - 1; i >= 0; i--) {
        const d = map.decorations[i];
        const rad = 45 * (d.scale || 1);
        if (Math.hypot(world.x - d.x, world.y - d.y) < rad) {
          setSelectedItem({ kind: 'decoration', index: i, id: d.id });
          isDraggingRef.current = true;
          dragModeRef.current = 'move';
          startObjPosRef.current = { x: d.x, y: d.y, rot: d.rotation, scale: d.scale };
          sound.playComicPop();
          return;
        }
      }
    }

    // Deselect if clicked empty area
    setSelectedItem(null);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    const dx = sx - lastMouseRef.current.x;
    const dy = sy - lastMouseRef.current.y;
    lastMouseRef.current = { x: sx, y: sy };

    if (dragModeRef.current === 'pan') {
      setPanX((px) => px + dx);
      setPanY((py) => py + dy);
      return;
    }

    if (dragModeRef.current === 'move' && selectedItem) {
      const worldDx = dx / zoom;
      const worldDy = dy / zoom;

      if (selectedItem.kind === 'platform') {
        setMap((prev) => {
          const plats = [...prev.platforms];
          const plat = { ...plats[selectedItem.index] };
          plat.x = Math.max(0, Math.min(prev.width - plat.width, snap(plat.x + worldDx)));
          plat.y = Math.max(0, Math.min(prev.height - plat.height, snap(plat.y + worldDy)));
          plats[selectedItem.index] = plat;
          return { ...prev, platforms: plats };
        });
      } else if (selectedItem.kind === 'decoration' && map.decorations) {
        setMap((prev) => {
          const decs = [...(prev.decorations || [])];
          const dec = { ...decs[selectedItem.index] };
          dec.x = Math.max(0, Math.min(prev.width, snap(dec.x + worldDx)));
          dec.y = Math.max(0, Math.min(prev.height, snap(dec.y + worldDy)));
          decs[selectedItem.index] = dec;
          return { ...prev, decorations: decs };
        });
      } else if (selectedItem.kind === 'weaponSpawn') {
        setMap((prev) => {
          const wsp = [...prev.weaponSpawns];
          const item = { ...wsp[selectedItem.index] };
          item.x = Math.max(40, Math.min(prev.width - 40, snap(item.x + worldDx)));
          item.y = Math.max(40, Math.min(prev.height - 40, snap(item.y + worldDy)));
          wsp[selectedItem.index] = item;
          return { ...prev, weaponSpawns: wsp };
        });
      } else if (selectedItem.kind === 'playerSpawn') {
        setMap((prev) => {
          const sps = [...prev.spawnPoints];
          const item = { ...sps[selectedItem.index] };
          item.x = Math.max(40, Math.min(prev.width - 40, snap(item.x + worldDx)));
          item.y = Math.max(40, Math.min(prev.height - 40, snap(item.y + worldDy)));
          sps[selectedItem.index] = item;
          return { ...prev, spawnPoints: sps };
        });
      }
    }
  };

  const handleMouseUp = () => {
    if (isDraggingRef.current && dragModeRef.current === 'move') {
      pushHistory(map);
    }
    isDraggingRef.current = false;
    dragModeRef.current = null;
  };

  // Zoom with mouse wheel
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    const newZoom = Math.max(0.15, Math.min(2.5, zoom * zoomFactor));

    setPanX(mouseX - (mouseX - panX) * (newZoom / zoom));
    setPanY(mouseY - (mouseY - panY) * (newZoom / zoom));
    setZoom(newZoom);
  };

  // Change Map Dimensions / Preset
  const handleSelectPreset = (preset: typeof MAP_SIZE_PRESETS[0]) => {
    sound.playComicPop();
    pushHistory({
      ...map,
      width: preset.width,
      height: preset.height,
    });
  };

  return (
    <div id="map_editor_container" className="fixed inset-0 z-50 bg-[#0F172A] text-white flex flex-col select-none overflow-hidden font-sans">
      {/* 1. TOP HEADER TOOLBAR */}
      <header className="h-14 bg-[#1E293B] border-b-4 border-black px-4 flex items-center justify-between gap-3 shrink-0 shadow-md">
        {/* Left: Exit & Map Name */}
        <div className="flex items-center gap-3">
          <button
            id="btn_editor_exit"
            onClick={() => {
              sound.playJump();
              onExit();
            }}
            className="p-2 bg-slate-700 hover:bg-slate-600 rounded-xl border-2 border-black font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
            title="Exit to Main Menu"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Exit</span>
          </button>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={map.name}
              onChange={(e) => setMap({ ...map, name: e.target.value.substring(0, 35) })}
              placeholder="Map Name..."
              className="bg-slate-900/90 text-white font-black text-sm px-3 py-1.5 rounded-xl border-2 border-black focus:outline-hidden focus:ring-2 focus:ring-[#FFD700] w-40 sm:w-56"
            />
            <span className="text-[11px] font-black text-slate-400 hidden md:inline">
              📐 {map.width} × {map.height} px
            </span>
          </div>
        </div>

        {/* Center: Zoom, Undo, Redo, Grid */}
        <div className="flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-xl border-2 border-black">
          <button
            onClick={handleUndo}
            disabled={history.length === 0}
            className="p-1.5 hover:bg-slate-700 disabled:opacity-30 rounded-lg cursor-pointer"
            title="Undo (Ctrl+Z)"
          >
            <Undo className="w-4 h-4" />
          </button>
          <button
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            className="p-1.5 hover:bg-slate-700 disabled:opacity-30 rounded-lg cursor-pointer"
            title="Redo (Ctrl+Y)"
          >
            <Redo className="w-4 h-4" />
          </button>

          <div className="w-px h-4 bg-slate-700 mx-1" />

          <button
            onClick={() => setZoom((z) => Math.max(0.15, z - 0.1))}
            className="p-1.5 hover:bg-slate-700 rounded-lg cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono font-bold w-12 text-center text-amber-300">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom((z) => Math.min(2.5, z + 0.1))}
            className="p-1.5 hover:bg-slate-700 rounded-lg cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={fitMapToScreen}
            className="p-1.5 hover:bg-slate-700 rounded-lg cursor-pointer"
            title="Fit to Screen"
          >
            <Maximize2 className="w-4 h-4" />
          </button>

          <div className="w-px h-4 bg-slate-700 mx-1" />

          <button
            onClick={() => setGridSnap((g) => (g === 20 ? 40 : g === 40 ? 0 : 20))}
            className={`px-2 py-1 rounded-lg text-xs font-black flex items-center gap-1 cursor-pointer ${
              gridSnap > 0 ? 'bg-[#FFD700] text-black' : 'text-slate-400 hover:bg-slate-800'
            }`}
            title="Toggle Grid Snap"
          >
            <Grid className="w-3.5 h-3.5" />
            <span>{gridSnap > 0 ? `${gridSnap}px` : 'Off'}</span>
          </button>
        </div>

        {/* Right: Save & Test Play Buttons */}
        <div className="flex items-center gap-2">
          <button
            id="btn_editor_save"
            onClick={handleSave}
            className="px-3.5 py-1.5 bg-[#10B981] hover:bg-emerald-400 text-white font-black text-xs rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Save className="w-4 h-4" />
            <span>Save Map</span>
          </button>

          <button
            id="btn_editor_test_play"
            onClick={handleTestPlay}
            className="px-4 py-1.5 bg-[#FF5733] hover:bg-orange-400 text-white font-black text-xs rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>Play / Test 🎮</span>
          </button>
        </div>
      </header>

      {/* 2. MAIN WORKSPACE (LEFT PALETTE + CENTER CANVAS + RIGHT PROPERTIES) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* LEFT PALETTE PANEL */}
        <aside className="w-64 bg-[#1E293B] border-r-4 border-black flex flex-col shrink-0 z-10 shadow-lg">
          {/* Palette Tabs */}
          <div className="grid grid-cols-4 bg-slate-900 p-1 border-b-2 border-black text-[11px] font-black">
            <button
              onClick={() => setActivePaletteTab('platforms')}
              className={`py-2 rounded-lg text-center cursor-pointer transition-colors ${
                activePaletteTab === 'platforms' ? 'bg-[#FFD700] text-black' : 'text-slate-400 hover:text-white'
              }`}
            >
              🟩 Floor
            </button>
            <button
              onClick={() => setActivePaletteTab('decorations')}
              className={`py-2 rounded-lg text-center cursor-pointer transition-colors ${
                activePaletteTab === 'decorations' ? 'bg-[#FFD700] text-black' : 'text-slate-400 hover:text-white'
              }`}
            >
              🌳 Scenery
            </button>
            <button
              onClick={() => setActivePaletteTab('spawns')}
              className={`py-2 rounded-lg text-center cursor-pointer transition-colors ${
                activePaletteTab === 'spawns' ? 'bg-[#FFD700] text-black' : 'text-slate-400 hover:text-white'
              }`}
            >
              ⚡ Spawns
            </button>
            <button
              onClick={() => setActivePaletteTab('maps')}
              className={`py-2 rounded-lg text-center cursor-pointer transition-colors ${
                activePaletteTab === 'maps' ? 'bg-[#FFD700] text-black' : 'text-slate-400 hover:text-white'
              }`}
            >
              📁 Maps
            </button>
          </div>

          {/* Palette Items Scroll Area */}
          <div className="p-3 overflow-y-auto flex-1 space-y-3">
            {/* PLATFORMS TAB */}
            {activePaletteTab === 'platforms' && (
              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                  Add Platform Pieces
                </span>
                <button
                  onClick={() => addPlatform('ground')}
                  className="w-full p-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl border-2 border-black flex items-center gap-3 text-left cursor-pointer transition-all hover:translate-x-1"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#15803D] border border-black flex items-center justify-center text-sm">
                    🟩
                  </div>
                  <div>
                    <div className="text-xs font-black">Solid Ground</div>
                    <div className="text-[10px] text-slate-400">Standard walkable solid ground</div>
                  </div>
                </button>

                <button
                  onClick={() => addPlatform('wood')}
                  className="w-full p-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl border-2 border-black flex items-center gap-3 text-left cursor-pointer transition-all hover:translate-x-1"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#E5A65D] border border-black flex items-center justify-center text-sm">
                    🪵
                  </div>
                  <div>
                    <div className="text-xs font-black">Wood Platform</div>
                    <div className="text-[10px] text-slate-400">Pass-through (Down + Jump)</div>
                  </div>
                </button>

                <button
                  onClick={() => addPlatform('stone')}
                  className="w-full p-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl border-2 border-black flex items-center gap-3 text-left cursor-pointer transition-all hover:translate-x-1"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#64748B] border border-black flex items-center justify-center text-sm">
                    🪨
                  </div>
                  <div>
                    <div className="text-xs font-black">Stone Slab</div>
                    <div className="text-[10px] text-slate-400">Solid impenetrable platform</div>
                  </div>
                </button>

                <button
                  onClick={() => addPlatform('bounce')}
                  className="w-full p-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl border-2 border-black flex items-center gap-3 text-left cursor-pointer transition-all hover:translate-x-1"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#FF5252] border border-black flex items-center justify-center text-sm">
                    🚀
                  </div>
                  <div>
                    <div className="text-xs font-black">Launch Bouncer</div>
                    <div className="text-[10px] text-slate-400">High vertical launch pad</div>
                  </div>
                </button>

                <button
                  onClick={() => addPlatform('cloud')}
                  className="w-full p-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl border-2 border-black flex items-center gap-3 text-left cursor-pointer transition-all hover:translate-x-1"
                >
                  <div className="w-8 h-8 rounded-lg bg-white border border-black flex items-center justify-center text-sm text-black">
                    ☁️
                  </div>
                  <div>
                    <div className="text-xs font-black">Cloud Platform</div>
                    <div className="text-[10px] text-slate-400">Soft floating platform</div>
                  </div>
                </button>
              </div>
            )}

            {/* DECORATIONS TAB */}
            {activePaletteTab === 'decorations' && (
              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                  Scenery & Objects
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { type: 'tree' as DecorationType, icon: '🌳', name: 'Oak Tree' },
                    { type: 'pine_tree' as DecorationType, icon: '🌲', name: 'Pine Tree' },
                    { type: 'palm_tree' as DecorationType, icon: '🌴', name: 'Palm Tree' },
                    { type: 'cloud' as DecorationType, icon: '☁️', name: 'Comic Cloud' },
                    { type: 'rock' as DecorationType, icon: '🪨', name: 'Floating Rock' },
                    { type: 'torii_gate' as DecorationType, icon: '⛩️', name: 'Torii Gate' },
                    { type: 'ancient_column' as DecorationType, icon: '🏛️', name: 'Column' },
                    { type: 'crystal_cluster' as DecorationType, icon: '💎', name: 'Crystals' },
                    { type: 'lantern_post' as DecorationType, icon: '🏮', name: 'Lantern' },
                    { type: 'gear' as DecorationType, icon: '⚙️', name: 'Gear' },
                    { type: 'balloon' as DecorationType, icon: '🎈', name: 'Balloon' },
                    { type: 'rect' as DecorationType, icon: '⏹️', name: 'Custom Box' },
                    { type: 'circle' as DecorationType, icon: '⚪', name: 'Custom Circle' },
                    { type: 'star' as DecorationType, icon: '⭐', name: 'Custom Star' },
                  ].map((item) => (
                    <button
                      key={item.type}
                      onClick={() => addDecoration(item.type)}
                      className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl border border-black flex flex-col items-center justify-center gap-1 text-center cursor-pointer transition-all hover:scale-105"
                    >
                      <span className="text-xl">{item.icon}</span>
                      <span className="text-[10px] font-black">{item.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* SPAWNS TAB */}
            {activePaletteTab === 'spawns' && (
              <div className="space-y-3">
                {/* 1. Player Spawn */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 block">
                    Player Spawns ({map.spawnPoints.length}/10)
                  </span>
                  <button
                    onClick={addPlayerSpawn}
                    disabled={map.spawnPoints.length >= 10}
                    className="w-full p-2.5 bg-emerald-950/80 hover:bg-emerald-900 border-2 border-emerald-600 rounded-xl flex items-center gap-2.5 text-left cursor-pointer transition-all"
                  >
                    <div className="w-8 h-8 rounded-lg bg-emerald-500 text-black font-black flex items-center justify-center text-sm">
                      🥋
                    </div>
                    <div>
                      <div className="text-xs font-black text-emerald-200">+ Player Spawn</div>
                      <div className="text-[10px] text-emerald-400">Add start location</div>
                    </div>
                  </button>
                </div>

                {/* 2. Normal Weapons */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 block">
                    Regular Weapon Spawns
                  </span>
                  <div className="space-y-1">
                    <select
                      value={selectedWeaponForSpawn}
                      onChange={(e) => setSelectedWeaponForSpawn(e.target.value as WeaponType)}
                      className="w-full bg-slate-900 text-white font-bold text-xs p-2 rounded-xl border-2 border-black"
                    >
                      {ALL_WEAPON_CONFIGS.filter((w) => !w.isSuper).map((w) => (
                        <option key={w.type} value={w.type}>
                          ⚡ {w.name} ({w.type})
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={() => addWeaponSpawn(selectedWeaponForSpawn)}
                      className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs rounded-xl border-2 border-black shadow-xs cursor-pointer"
                    >
                      + Place Normal Weapon
                    </button>
                  </div>
                </div>

                {/* 3. Super Weapons */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-purple-400 block">
                    Super Weapon Spawns 🌌
                  </span>
                  <div className="space-y-1">
                    <select
                      value={selectedSuperWeaponForSpawn}
                      onChange={(e) => setSelectedSuperWeaponForSpawn(e.target.value as WeaponType)}
                      className="w-full bg-slate-900 text-purple-300 font-bold text-xs p-2 rounded-xl border-2 border-purple-800"
                    >
                      {ALL_WEAPON_CONFIGS.filter((w) => w.isSuper).map((w) => (
                        <option key={w.type} value={w.type}>
                          🌌 SUPER: {w.name}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={() => addWeaponSpawn(selectedSuperWeaponForSpawn)}
                      className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white font-black text-xs rounded-xl border-2 border-black shadow-xs cursor-pointer"
                    >
                      + Place Super Weapon (1-Hit Kill)
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* MAPS TAB (Saved Maps & Presets) */}
            {activePaletteTab === 'maps' && (
              <div className="space-y-3">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                  Your Saved Custom Maps
                </span>

                <button
                  onClick={() => {
                    const newMap = createDefaultCustomMap('medium');
                    saveCustomMap(newMap);
                    setMap(newMap);
                    fitMapToScreen();
                    sound.playCountdownBeep(true);
                  }}
                  className="w-full py-2 bg-[#FFD700] hover:bg-[#ffe234] text-black font-black text-xs rounded-xl border-2 border-black shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <FilePlus className="w-4 h-4" />
                  <span>Create New Blank Map</span>
                </button>

                <div className="space-y-1.5 max-h-56 overflow-y-auto">
                  {getCustomMaps().map((saved) => (
                    <div
                      key={saved.id}
                      onClick={() => {
                        sound.playComicPop();
                        setMap(saved);
                        setSelectedItem(null);
                        fitMapToScreen();
                      }}
                      className={`p-2.5 rounded-xl border-2 border-black flex items-center justify-between cursor-pointer transition-all ${
                        saved.id === map.id ? 'bg-amber-500/30 border-[#FFD700]' : 'bg-slate-800 hover:bg-slate-700'
                      }`}
                    >
                      <div>
                        <div className="font-black text-xs">{saved.name}</div>
                        <div className="text-[10px] text-slate-400">
                          {saved.width} × {saved.height} px
                        </div>
                      </div>

                      {saved.id === map.id && <span className="text-xs">⭐ Active</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* MAIN CANVAS WORKSPACE */}
        <main className="flex-1 relative overflow-hidden bg-[#0A0F1D]">
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onWheel={handleWheel}
            className="w-full h-full cursor-crosshair block"
          />

          {/* Quick Helper Floating Bar on Canvas Bottom */}
          <div className="absolute bottom-4 left-4 bg-slate-900/90 backdrop-blur-xs px-3.5 py-2 rounded-2xl border-2 border-black flex items-center gap-3 text-xs font-bold text-slate-300 shadow-md">
            <span>🖱️ Click to Select</span>
            <span>🖐️ Space/Middle Drag to Pan</span>
            <span>🔍 Wheel to Zoom</span>
            <span>⌨️ Ctrl+Z Undo</span>
            <span>⌨️ Del to Delete</span>
          </div>

          {/* Save Toast Notification */}
          <AnimatePresence>
            {showSaveToast && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="absolute top-4 left-1/2 -translate-x-1/2 bg-[#10B981] text-white font-black text-sm px-6 py-2.5 rounded-2xl border-3 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center gap-2"
              >
                <Check className="w-5 h-5" />
                <span>Map Successfully Saved!</span>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* RIGHT PROPERTIES & MAP SETTINGS PANEL */}
        <aside className="w-72 bg-[#1E293B] border-l-4 border-black p-4 flex flex-col shrink-0 overflow-y-auto space-y-4 shadow-lg">
          {selectedItem ? (
            /* OBJECT PROPERTIES */
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b-2 border-slate-700 pb-2">
                <span className="text-xs font-black uppercase tracking-wider text-[#FFD700]">
                  {selectedItem.kind === 'platform' ? '🟩 Platform Properties' : selectedItem.kind === 'decoration' ? '🌳 Decoration Properties' : selectedItem.kind === 'weaponSpawn' ? '⚡ Weapon Spawn' : '🥋 Player Spawn'}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleDuplicateSelected}
                    className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs"
                    title="Duplicate (Ctrl+D)"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleDeleteSelected}
                    className="p-1.5 bg-rose-600 hover:bg-rose-500 rounded-lg text-xs"
                    title="Delete (Del)"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* PLATFORM SPECIFIC PROPERTIES */}
              {selectedItem.kind === 'platform' && map.platforms[selectedItem.index] && (() => {
                const plat = map.platforms[selectedItem.index];
                return (
                  <div className="space-y-3">
                    {/* Width & Height */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                          Width (px)
                        </label>
                        <input
                          type="number"
                          value={plat.width}
                          onChange={(e) => {
                            const w = Math.max(10, Math.min(map.width, Number(e.target.value) || 10));
                            const plats = [...map.platforms];
                            plats[selectedItem.index] = { ...plat, width: w };
                            pushHistory({ ...map, platforms: plats });
                          }}
                          className="w-full bg-slate-900 text-white font-bold text-xs p-2 rounded-xl border border-black"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                          Height (px)
                        </label>
                        <input
                          type="number"
                          value={plat.height}
                          onChange={(e) => {
                            const h = Math.max(8, Math.min(map.height, Number(e.target.value) || 8));
                            const plats = [...map.platforms];
                            plats[selectedItem.index] = { ...plat, height: h };
                            pushHistory({ ...map, platforms: plats });
                          }}
                          className="w-full bg-slate-900 text-white font-bold text-xs p-2 rounded-xl border border-black"
                        />
                      </div>
                    </div>

                    {/* Pass-through toggle */}
                    <label className="flex items-center gap-2 p-2 bg-slate-900/60 rounded-xl border border-black cursor-pointer">
                      <input
                        type="checkbox"
                        checked={plat.isPassableDown ?? false}
                        onChange={(e) => {
                          const plats = [...map.platforms];
                          plats[selectedItem.index] = { ...plat, isPassableDown: e.target.checked };
                          pushHistory({ ...map, platforms: plats });
                        }}
                        className="w-4 h-4 rounded-md accent-[#FFD700]"
                      />
                      <span className="text-xs font-bold">Pass-through (Down+Jump)</span>
                    </label>

                    {/* Platform Color Swatches */}
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                        Platform Color
                      </label>
                      <div className="grid grid-cols-5 gap-1.5 mb-2">
                        {PRESET_COLORS.slice(0, 10).map((c) => (
                          <button
                            key={c}
                            onClick={() => {
                              const plats = [...map.platforms];
                              plats[selectedItem.index] = { ...plat, color: c };
                              pushHistory({ ...map, platforms: plats });
                            }}
                            className="w-7 h-7 rounded-lg border border-black transition-transform hover:scale-110 cursor-pointer"
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                      <input
                        type="color"
                        value={plat.color || '#15803D'}
                        onChange={(e) => {
                          const plats = [...map.platforms];
                          plats[selectedItem.index] = { ...plat, color: e.target.value };
                          pushHistory({ ...map, platforms: plats });
                        }}
                        className="w-full h-8 bg-transparent cursor-pointer rounded-lg border border-black"
                      />
                    </div>
                  </div>
                );
              })()}

              {/* DECORATION SPECIFIC PROPERTIES */}
              {selectedItem.kind === 'decoration' && map.decorations && map.decorations[selectedItem.index] && (() => {
                const dec = map.decorations[selectedItem.index];
                return (
                  <div className="space-y-3">
                    {/* Layer Selector */}
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                        Layer Depth
                      </label>
                      <div className="grid grid-cols-3 gap-1 text-[10px] font-black">
                        {[
                          { id: 'background', label: 'Background' },
                          { id: 'gameplay', label: 'Gameplay' },
                          { id: 'foreground', label: 'Foreground' },
                        ].map((layerOpt) => (
                          <button
                            key={layerOpt.id}
                            onClick={() => {
                              const decs = [...(map.decorations || [])];
                              decs[selectedItem.index] = { ...dec, layer: layerOpt.id as any };
                              pushHistory({ ...map, decorations: decs });
                            }}
                            className={`py-1.5 rounded-lg border border-black cursor-pointer ${
                              dec.layer === layerOpt.id ? 'bg-[#FFD700] text-black font-black' : 'bg-slate-800'
                            }`}
                          >
                            {layerOpt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Scale & Rotation */}
                    <div>
                      <div className="flex items-center justify-between text-[10px] font-black uppercase text-slate-400 mb-1">
                        <span>Scale</span>
                        <span>{Math.round((dec.scale || 1) * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.3"
                        max="3.0"
                        step="0.05"
                        value={dec.scale || 1}
                        onChange={(e) => {
                          const decs = [...(map.decorations || [])];
                          decs[selectedItem.index] = { ...dec, scale: parseFloat(e.target.value) };
                          pushHistory({ ...map, decorations: decs });
                        }}
                        className="w-full accent-[#FFD700]"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-[10px] font-black uppercase text-slate-400 mb-1">
                        <span>Rotation</span>
                        <span>{Math.round(((dec.rotation || 0) * 180) / Math.PI)}°</span>
                      </div>
                      <input
                        type="range"
                        min={-Math.PI}
                        max={Math.PI}
                        step="0.05"
                        value={dec.rotation || 0}
                        onChange={(e) => {
                          const decs = [...(map.decorations || [])];
                          decs[selectedItem.index] = { ...dec, rotation: parseFloat(e.target.value) };
                          pushHistory({ ...map, decorations: decs });
                        }}
                        className="w-full accent-[#FFD700]"
                      />
                    </div>

                    {/* Flip buttons */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => {
                          const decs = [...(map.decorations || [])];
                          decs[selectedItem.index] = { ...dec, flipH: !dec.flipH };
                          pushHistory({ ...map, decorations: decs });
                        }}
                        className={`p-2 rounded-xl border border-black font-black text-xs flex items-center justify-center gap-1 cursor-pointer ${
                          dec.flipH ? 'bg-[#FFD700] text-black' : 'bg-slate-800'
                        }`}
                      >
                        <FlipHorizontal className="w-3.5 h-3.5" />
                        <span>Flip H</span>
                      </button>
                      <button
                        onClick={() => {
                          const decs = [...(map.decorations || [])];
                          decs[selectedItem.index] = { ...dec, flipV: !dec.flipV };
                          pushHistory({ ...map, decorations: decs });
                        }}
                        className={`p-2 rounded-xl border border-black font-black text-xs flex items-center justify-center gap-1 cursor-pointer ${
                          dec.flipV ? 'bg-[#FFD700] text-black' : 'bg-slate-800'
                        }`}
                      >
                        <FlipVertical className="w-3.5 h-3.5" />
                        <span>Flip V</span>
                      </button>
                    </div>

                    {/* Custom Color (for custom shapes & elements) */}
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                        Color / Tint
                      </label>
                      <input
                        type="color"
                        value={dec.color || '#3B82F6'}
                        onChange={(e) => {
                          const decs = [...(map.decorations || [])];
                          decs[selectedItem.index] = { ...dec, color: e.target.value };
                          pushHistory({ ...map, decorations: decs });
                        }}
                        className="w-full h-8 bg-transparent cursor-pointer rounded-lg border border-black"
                      />
                    </div>
                  </div>
                );
              })()}

              {/* WEAPON SPAWN SPECIFIC PROPERTIES */}
              {selectedItem.kind === 'weaponSpawn' && map.weaponSpawns[selectedItem.index] && (() => {
                const wsp = map.weaponSpawns[selectedItem.index];
                return (
                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                        Weapon Type
                      </label>
                      <select
                        value={wsp.weaponType}
                        onChange={(e) => {
                          const wType = e.target.value as WeaponType;
                          const wspList = [...map.weaponSpawns];
                          wspList[selectedItem.index] = {
                            ...wsp,
                            weaponType: wType,
                            respawnTime: SUPER_WEAPONS.includes(wType) ? 30 : 8,
                          };
                          pushHistory({ ...map, weaponSpawns: wspList });
                        }}
                        className="w-full bg-slate-900 text-white font-bold text-xs p-2 rounded-xl border border-black"
                      >
                        {ALL_WEAPON_CONFIGS.map((w) => (
                          <option key={w.type} value={w.type}>
                            {w.isSuper ? '🌌 SUPER: ' : '⚡ '}
                            {w.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-[10px] font-black uppercase text-slate-400 mb-1">
                        <span>Respawn Time</span>
                        <span>{wsp.respawnTime}s</span>
                      </div>
                      <input
                        type="range"
                        min="2"
                        max="60"
                        value={wsp.respawnTime}
                        onChange={(e) => {
                          const wspList = [...map.weaponSpawns];
                          wspList[selectedItem.index] = { ...wsp, respawnTime: parseInt(e.target.value) };
                          pushHistory({ ...map, weaponSpawns: wspList });
                        }}
                        className="w-full accent-[#FFD700]"
                      />
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : (
            /* OVERALL MAP SETTINGS (When no item is selected) */
            <div className="space-y-4">
              <div className="border-b-2 border-slate-700 pb-2">
                <span className="text-xs font-black uppercase tracking-wider text-[#FFD700] block">
                  ⚙️ Map Settings
                </span>
                <span className="text-[10px] text-slate-400">Click any object on map to edit it</span>
              </div>

              {/* Map Name & Description */}
              <div className="space-y-2">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                    Map Name
                  </label>
                  <input
                    type="text"
                    value={map.name}
                    onChange={(e) => setMap({ ...map, name: e.target.value.substring(0, 35) })}
                    className="w-full bg-slate-900 text-white font-bold text-xs p-2 rounded-xl border border-black"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    value={map.description || ''}
                    onChange={(e) => setMap({ ...map, description: e.target.value.substring(0, 100) })}
                    className="w-full bg-slate-900 text-white font-bold text-xs p-2 rounded-xl border border-black"
                  />
                </div>
              </div>

              {/* Map Size Presets */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 block">
                  Map Size Presets
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {MAP_SIZE_PRESETS.map((p) => {
                    const isSelected = map.width === p.width && map.height === p.height;
                    return (
                      <button
                        key={p.id}
                        onClick={() => handleSelectPreset(p)}
                        className={`p-2 rounded-xl border border-black text-left cursor-pointer transition-all ${
                          isSelected ? 'bg-[#FFD700] text-black font-black' : 'bg-slate-800 hover:bg-slate-700 text-white'
                        }`}
                      >
                        <div className="text-xs font-black">{p.name}</div>
                        <div className="text-[9px] opacity-75">{p.width}×{p.height}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Width & Height */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                    Width (800-6000)
                  </label>
                  <input
                    type="number"
                    value={map.width}
                    onChange={(e) => {
                      const w = Math.max(800, Math.min(6000, Number(e.target.value) || 800));
                      setMap({ ...map, width: w });
                    }}
                    className="w-full bg-slate-900 text-white font-bold text-xs p-2 rounded-xl border border-black"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                    Height (600-3000)
                  </label>
                  <input
                    type="number"
                    value={map.height}
                    onChange={(e) => {
                      const h = Math.max(600, Math.min(3000, Number(e.target.value) || 600));
                      setMap({ ...map, height: h });
                    }}
                    className="w-full bg-slate-900 text-white font-bold text-xs p-2 rounded-xl border border-black"
                  />
                </div>
              </div>

              {/* Background Color */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 block">
                  Sky Background Color
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {BG_COLOR_PRESETS.map((bg) => (
                    <button
                      key={bg.name}
                      onClick={() => {
                        sound.playComicPop();
                        pushHistory({ ...map, bgColor: bg.color });
                      }}
                      className="w-full h-8 rounded-lg border-2 border-black transition-transform hover:scale-105 cursor-pointer relative"
                      style={{ backgroundColor: bg.color }}
                      title={bg.name}
                    >
                      {map.bgColor === bg.color && (
                        <Check className="w-3.5 h-3.5 text-black absolute inset-0 m-auto" />
                      )}
                    </button>
                  ))}
                </div>
                <input
                  type="color"
                  value={map.bgColor || '#E3F6FD'}
                  onChange={(e) => pushHistory({ ...map, bgColor: e.target.value })}
                  className="w-full h-8 bg-transparent cursor-pointer rounded-lg border border-black"
                />
              </div>

              {/* Summary Stats */}
              <div className="p-3 bg-slate-900/80 rounded-xl border border-black text-[11px] font-bold text-slate-300 space-y-1">
                <div>🟩 Platforms: {map.platforms.length}</div>
                <div>🌳 Decorations: {map.decorations?.length || 0}</div>
                <div>⚡ Weapon Spawns: {map.weaponSpawns.length}</div>
                <div>🥋 Player Spawns: {map.spawnPoints.length}</div>
              </div>

              {/* Map Deletion / Duplicate */}
              <div className="pt-2 border-t border-slate-700 flex items-center justify-between gap-2">
                <button
                  onClick={() => {
                    const copy = duplicateCustomMap(map.id);
                    if (copy) {
                      setMap(copy);
                      sound.playCountdownBeep(true);
                    }
                  }}
                  className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-xl text-xs font-black cursor-pointer"
                >
                  Duplicate Map
                </button>

                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-3 py-1.5 bg-rose-700 hover:bg-rose-600 rounded-xl text-xs font-black cursor-pointer"
                >
                  Delete Map
                </button>
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#1E293B] border-4 border-black rounded-3xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl">
            <Trash className="w-12 h-12 text-rose-500 mx-auto" />
            <h3 className="text-xl font-black text-white uppercase">Delete This Map?</h3>
            <p className="text-xs text-slate-300">
              Are you sure you want to permanently delete <strong>"{map.name}"</strong>? This action cannot be undone.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 bg-slate-700 rounded-xl font-black text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  deleteCustomMap(map.id);
                  const remaining = getCustomMaps();
                  if (remaining.length > 0) {
                    setMap(remaining[0]);
                  } else {
                    const fallback = createDefaultCustomMap('medium');
                    saveCustomMap(fallback);
                    setMap(fallback);
                  }
                  setShowDeleteConfirm(false);
                  sound.playJump();
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 rounded-xl font-black text-xs text-white cursor-pointer"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
