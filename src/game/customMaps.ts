import { Arena, CustomDecoration, Platform, WeaponSpawnPoint, WeaponType } from '../types/game';

export const CUSTOM_MAPS_STORAGE_KEY = 'stick_fighters_custom_maps_v1';

export interface MapSizePreset {
  id: string;
  name: string;
  width: number;
  height: number;
  description: string;
}

export const MAP_SIZE_PRESETS: MapSizePreset[] = [
  { id: 'small', name: 'Small Arena', width: 1240, height: 740, description: 'Fast 1v1 close combat' },
  { id: 'medium', name: 'Medium Arena', width: 1520, height: 860, description: 'Balanced 2-4 player brawl' },
  { id: 'large', name: 'Large Arena', width: 2600, height: 1200, description: 'Expansive multi-tier battlefield' },
  { id: 'xlarge', name: 'Extra Large (XL)', width: 3600, height: 1500, description: 'Colossal exploration map' },
  { id: 'huge', name: 'Huge (Colossus)', width: 4800, height: 1800, description: 'Massive epic-scale battleground' },
];

/**
 * Creates a clean default custom map template with a ground floor,
 * 2 player spawn points, and 1 weapon spawn.
 */
export function createDefaultCustomMap(presetId: string = 'medium'): Arena {
  const preset = MAP_SIZE_PRESETS.find((p) => p.id === presetId) || MAP_SIZE_PRESETS[1];
  const now = Date.now();
  const id = `custom_${now}_${Math.random().toString(36).substring(2, 7)}`;

  const groundY = preset.height - 180;
  const groundWidth = Math.min(preset.width - 200, 1120);
  const groundX = (preset.width - groundWidth) / 2;

  const platforms: Platform[] = [
    {
      id: `plat_ground_${now}`,
      x: groundX,
      y: groundY,
      width: groundWidth,
      height: 120,
      color: '#15803D',
      type: 'ground',
      isPassableDown: false,
    },
    {
      id: `plat_top_${now}`,
      x: groundX + groundWidth * 0.3,
      y: groundY - 160,
      width: groundWidth * 0.4,
      height: 24,
      color: '#E5A65D',
      type: 'wood',
      isPassableDown: true,
    },
  ];

  const spawnPoints = [
    { x: groundX + 120, y: groundY - 60 },
    { x: groundX + groundWidth - 120, y: groundY - 60 },
    { x: preset.width / 2, y: groundY - 220 },
  ];

  const weaponSpawns: WeaponSpawnPoint[] = [
    {
      id: `wpn_${now}_1`,
      weaponType: 'pistol',
      x: preset.width / 2,
      y: groundY - 190,
      respawnTime: 7,
    },
  ];

  const decorations: CustomDecoration[] = [
    {
      id: `dec_tree_${now}`,
      type: 'tree',
      x: groundX + 60,
      y: groundY - 80,
      scale: 1,
      color: '#4CAF50',
      layer: 'background',
    },
    {
      id: `dec_cloud_${now}`,
      type: 'cloud',
      x: preset.width * 0.35,
      y: 120,
      scale: 1.2,
      color: '#FFFFFF',
      layer: 'background',
    },
    {
      id: `dec_cloud2_${now}`,
      type: 'cloud',
      x: preset.width * 0.7,
      y: 160,
      scale: 0.9,
      color: '#FFFFFF',
      layer: 'background',
    },
  ];

  return {
    id,
    name: 'My Custom Arena',
    description: 'Custom created battle arena in Stick Fighters Map Editor.',
    theme: 'park',
    size: 'custom',
    width: preset.width,
    height: preset.height,
    bgColor: '#E3F6FD',
    features: ['Custom Map', 'Drop Platforms'],
    spawnPoints,
    weaponSpawns,
    platforms,
    decorations,
    isCustom: true,
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
}

/**
 * Loads all custom maps from persistent browser storage.
 */
export function getCustomMaps(): Arena[] {
  try {
    const raw = localStorage.getItem(CUSTOM_MAPS_STORAGE_KEY);
    if (!raw) return [];
    const maps = JSON.parse(raw);
    if (Array.isArray(maps)) {
      return maps.map(validateAndSanitizeMap);
    }
  } catch (e) {
    console.error('Error loading custom maps from storage:', e);
  }
  return [];
}

/**
 * Retrieves a single custom map by its ID.
 */
export function getCustomMapById(id: string): Arena | null {
  const maps = getCustomMaps();
  return maps.find((m) => m.id === id) || null;
}

/**
 * Saves or updates a custom map in localStorage.
 */
export function saveCustomMap(map: Arena): boolean {
  try {
    const sanitized = validateAndSanitizeMap({
      ...map,
      updatedAt: Date.now(),
    });

    const maps = getCustomMaps();
    const existingIdx = maps.findIndex((m) => m.id === sanitized.id);

    if (existingIdx >= 0) {
      maps[existingIdx] = sanitized;
    } else {
      maps.unshift(sanitized);
    }

    localStorage.setItem(CUSTOM_MAPS_STORAGE_KEY, JSON.stringify(maps));
    return true;
  } catch (e) {
    console.error('Failed to save custom map:', e);
    return false;
  }
}

/**
 * Deletes a custom map by ID from localStorage.
 */
export function deleteCustomMap(id: string): boolean {
  try {
    const maps = getCustomMaps().filter((m) => m.id !== id);
    localStorage.setItem(CUSTOM_MAPS_STORAGE_KEY, JSON.stringify(maps));
    return true;
  } catch (e) {
    console.error('Failed to delete custom map:', e);
    return false;
  }
}

/**
 * Duplicates a custom map and saves the copy with a new ID.
 */
export function duplicateCustomMap(id: string): Arena | null {
  const original = getCustomMapById(id);
  if (!original) return null;

  const now = Date.now();
  const copy: Arena = {
    ...JSON.parse(JSON.stringify(original)),
    id: `custom_${now}_${Math.random().toString(36).substring(2, 7)}`,
    name: `${original.name} (Copy)`,
    createdAt: now,
    updatedAt: now,
  };

  saveCustomMap(copy);
  return copy;
}

/**
 * Validates and clamps custom map properties to prevent pathological/corrupted data.
 */
export function validateAndSanitizeMap(raw: any): Arena {
  const width = Math.min(Math.max(Number(raw.width) || 1200, 600), 8000);
  const height = Math.min(Math.max(Number(raw.height) || 720, 400), 4000);

  const platforms: Platform[] = Array.isArray(raw.platforms)
    ? raw.platforms.slice(0, 350).map((p: any, idx: number) => ({
        id: String(p.id || `plat_${idx}`),
        x: Math.round(Number(p.x) || 0),
        y: Math.round(Number(p.y) || 0),
        width: Math.max(10, Math.min(Math.round(Number(p.width) || 100), width)),
        height: Math.max(8, Math.min(Math.round(Number(p.height) || 24), height)),
        color: typeof p.color === 'string' ? p.color : '#E5A65D',
        type: ['ground', 'wood', 'stone', 'cloud', 'bounce'].includes(p.type) ? p.type : 'wood',
        isPassableDown: Boolean(p.isPassableDown),
      }))
    : [];

  // Ensure at least one ground platform exists if empty
  if (platforms.length === 0) {
    platforms.push({
      id: `plat_fallback_${Date.now()}`,
      x: 100,
      y: height - 150,
      width: width - 200,
      height: 100,
      color: '#15803D',
      type: 'ground',
      isPassableDown: false,
    });
  }

  const spawnPoints = Array.isArray(raw.spawnPoints) && raw.spawnPoints.length > 0
    ? raw.spawnPoints.slice(0, 20).map((sp: any) => ({
        x: Math.min(Math.max(Math.round(Number(sp.x) || 100), 40), width - 40),
        y: Math.min(Math.max(Math.round(Number(sp.y) || 100), 40), height - 40),
      }))
    : [
        { x: width * 0.25, y: height - 200 },
        { x: width * 0.75, y: height - 200 },
      ];

  const weaponSpawns: WeaponSpawnPoint[] = Array.isArray(raw.weaponSpawns)
    ? raw.weaponSpawns.slice(0, 50).map((wp: any, idx: number) => ({
        id: String(wp.id || `wpn_${idx}`),
        weaponType: wp.weaponType as WeaponType,
        x: Math.min(Math.max(Math.round(Number(wp.x) || 100), 30), width - 30),
        y: Math.min(Math.max(Math.round(Number(wp.y) || 100), 30), height - 30),
        respawnTime: Math.max(1, Math.min(Math.round(Number(wp.respawnTime) || 10), 300)),
      }))
    : [];

  const decorations: CustomDecoration[] = Array.isArray(raw.decorations)
    ? raw.decorations.slice(0, 300).map((d: any, idx: number) => ({
        id: String(d.id || `dec_${idx}`),
        type: d.type || 'tree',
        x: Math.round(Number(d.x) || 0),
        y: Math.round(Number(d.y) || 0),
        width: Number(d.width) || undefined,
        height: Number(d.height) || undefined,
        scale: Math.max(0.2, Math.min(Number(d.scale) || 1, 5)),
        rotation: Number(d.rotation) || 0,
        color: typeof d.color === 'string' ? d.color : undefined,
        color2: typeof d.color2 === 'string' ? d.color2 : undefined,
        color3: typeof d.color3 === 'string' ? d.color3 : undefined,
        layer: ['background', 'gameplay', 'foreground'].includes(d.layer) ? d.layer : 'background',
        flipH: Boolean(d.flipH),
        flipV: Boolean(d.flipV),
      }))
    : [];

  return {
    id: String(raw.id || `custom_${Date.now()}`),
    name: String(raw.name || 'Untitled Custom Map').trim().substring(0, 40) || 'Untitled Custom Map',
    description: String(raw.description || 'Custom Stick Fighters Map').trim().substring(0, 140),
    theme: typeof raw.theme === 'string' ? raw.theme : 'park',
    size: 'custom',
    width,
    height,
    bgColor: typeof raw.bgColor === 'string' && raw.bgColor.startsWith('#') ? raw.bgColor : '#E3F6FD',
    features: Array.isArray(raw.features) ? raw.features.slice(0, 5) : ['Custom Map'],
    spawnPoints,
    weaponSpawns,
    platforms,
    decorations,
    isCustom: true,
    createdAt: Number(raw.createdAt) || Date.now(),
    updatedAt: Number(raw.updatedAt) || Date.now(),
    version: Number(raw.version) || 1,
  };
}
