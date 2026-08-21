import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  Check,
  Palette,
  RotateCcw,
  Shield,
  Shuffle,
  Sparkles,
  User,
  Zap,
} from 'lucide-react';
import {
  ACCESSORY_CATALOG,
  CAPE_CATALOG,
  EFFECT_CATALOG,
  FACE_CATALOG,
  HAIR_CATALOG,
  HEADWEAR_CATALOG,
  OUTFIT_CATALOG,
  PRESET_COLORS,
  PRESET_OUTFITS,
  SHOE_CATALOG,
  SKINS_CATALOG,
} from '../game/customizationCatalog';
import { sound } from '../game/audio';
import { createInitialFighter } from '../game/physics';
import { GameRenderer } from '../game/renderer';
import { FighterCustomization } from '../types/game';

interface CharacterStudioProps {
  customization: FighterCustomization;
  onSave: (cust: FighterCustomization) => void;
  onBack: () => void;
  previousView?: string;
}

type CategoryTab =
  | 'skin'
  | 'hair'
  | 'headwear'
  | 'face'
  | 'outfit'
  | 'cape'
  | 'shoes'
  | 'accessories'
  | 'effects'
  | 'colors'
  | 'presets';

const RANDOM_NAMES = [
  'Captain Strike',
  'Speedy Tintin',
  'Ninja Spark',
  'Punchy Pete',
  'Valkyrie Val',
  'Brawler Bella',
  'Flash Fox',
  'Shadow Spike',
  'Thunder Theo',
  'Ruby Rocket',
  'Cyber Ghost',
  'Blaze Knight',
  'Astro Cadet',
  'Phantom Ronin',
];

export const CharacterStudio: React.FC<CharacterStudioProps> = ({
  customization,
  onSave,
  onBack,
  previousView,
}) => {
  const [current, setCurrent] = useState<FighterCustomization>({ ...customization });
  const [activeTab, setActiveTab] = useState<CategoryTab>('skin');
  const [animAction, setAnimAction] = useState<'idle' | 'fast_attack' | 'heavy_attack' | 'block' | 'victory'>('idle');
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Live Canvas Preview
  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const renderer = new GameRenderer(ctx);
    renderer.setDimensions(340, 360);

    const dummyArena: any = {
      id: 'preview',
      name: 'Studio',
      theme: 'park',
      width: 600,
      height: 400,
      bgColor: '#FFFBEB',
      spawnPoints: [{ x: 300, y: 260 }],
      platforms: [
        { id: 'plat', x: 100, y: 280, width: 400, height: 40, color: '#F3F4F6', type: 'wood' },
      ],
    };

    const fighter = createInitialFighter(
      'preview',
      current,
      300 as any,
      280 as any,
      false as any
    );

    const loop = () => {
      const now = Date.now();

      Object.assign(fighter, current);
      fighter.state = animAction;
      fighter.isBlocking = animAction === 'block';
      fighter.stateTimer = animAction === 'idle' ? 0 : 0.15;

      renderer.camera.x = 300;
      renderer.camera.y = 210;
      renderer.camera.zoom = 1.45;

      renderer.render(dummyArena, [fighter], [], [], now);
      animId = requestAnimationFrame(loop);
    };

    loop();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [current, animAction]);

  const triggerAnim = (action: 'fast_attack' | 'heavy_attack' | 'block' | 'victory') => {
    setAnimAction(action);
    if (action === 'fast_attack') sound.playFastPunch();
    if (action === 'heavy_attack') sound.playHeavyHit();
    if (action === 'block') sound.playShieldBlock();
    if (action === 'victory') sound.playVictoryFanfare();

    setTimeout(() => {
      setAnimAction('idle');
    }, 600);
  };

  const handleRandomize = () => {
    const randomName = RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)];
    const primary = PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)].hex;
    const secondary = PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)].hex;
    const accent = PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)].hex;

    const randomSkin = SKINS_CATALOG[Math.floor(Math.random() * SKINS_CATALOG.length)].id;
    const randomHair = HAIR_CATALOG[Math.floor(Math.random() * HAIR_CATALOG.length)].id;
    const randomHat = HEADWEAR_CATALOG[Math.floor(Math.random() * HEADWEAR_CATALOG.length)].id;
    const randomFace = FACE_CATALOG[Math.floor(Math.random() * FACE_CATALOG.length)].id;
    const randomOutfit = OUTFIT_CATALOG[Math.floor(Math.random() * OUTFIT_CATALOG.length)].id;
    const randomCape = CAPE_CATALOG[Math.floor(Math.random() * CAPE_CATALOG.length)].id;
    const randomShoe = SHOE_CATALOG[Math.floor(Math.random() * SHOE_CATALOG.length)].id;
    const randomAcc = ACCESSORY_CATALOG[Math.floor(Math.random() * ACCESSORY_CATALOG.length)].id;
    const randomEff = EFFECT_CATALOG[Math.floor(Math.random() * EFFECT_CATALOG.length)].id;

    setCurrent({
      name: randomName,
      gender: Math.random() > 0.5 ? 'male' : 'female',
      color: primary,
      secondaryColor: secondary,
      accentColor: accent,
      skin: randomSkin,
      hair: randomHair,
      hairColor: accent,
      hat: randomHat,
      hatColor: secondary,
      face: randomFace,
      outfit: randomOutfit,
      outfitColor: secondary,
      cape: randomCape,
      capeColor: primary,
      shoes: randomShoe,
      shoeColor: secondary,
      accessory: randomAcc,
      effect: randomEff,
    });
    sound.playComicPop();
  };

  const handleReset = () => {
    setCurrent({
      name: current.name || 'Tintin Fighter',
      gender: 'male',
      color: '#2563EB',
      secondaryColor: '#38BDF8',
      accentColor: '#FACC15',
      skin: 'classic',
      hair: 'none',
      hat: 'cap',
      face: 'none',
      outfit: 'none',
      cape: 'none',
      shoes: 'none',
      accessory: 'none',
      effect: 'none',
    });
    sound.playComicPop();
  };

  const handleSaveAndReturn = () => {
    sound.playJump();
    onSave(current);
    onBack();
  };

  const getRarityBadge = (rarity: string) => {
    switch (rarity) {
      case 'legendary':
        return 'bg-amber-400 text-black border-black font-black';
      case 'epic':
        return 'bg-purple-600 text-white border-black font-bold';
      case 'rare':
        return 'bg-blue-600 text-white border-black font-bold';
      case 'uncommon':
        return 'bg-emerald-600 text-white border-black font-bold';
      default:
        return 'bg-slate-200 text-slate-800 border-black font-semibold';
    }
  };

  return (
    <div id="character_studio_container" className="w-full max-w-6xl mx-auto p-3 sm:p-6">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <button
          id="btn_back_from_studio"
          onClick={() => {
            sound.playJump();
            onBack();
          }}
          className="flex items-center gap-2 px-4 py-2 bg-white text-black font-bold rounded-xl border-3 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-amber-50 active:translate-x-[2px] active:translate-y-[2px] transition-all cursor-pointer text-sm sm:text-base"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>{previousView === 'lobby' ? 'Back to Room' : 'Back to Menu'}</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="text-2xl sm:text-3xl">🎨</span>
          <h1 className="text-xl sm:text-3xl font-black text-black tracking-tight uppercase">
            Character Studio
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            title="Reset to default stickman"
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-black font-bold rounded-xl border-3 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-slate-200 transition-all cursor-pointer text-xs sm:text-sm"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="hidden sm:inline">Reset</span>
          </button>
          <button
            id="btn_randomize_fighter"
            onClick={handleRandomize}
            className="flex items-center gap-2 px-4 py-2 bg-[#FFD700] text-black font-bold rounded-xl border-3 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-[#ffe234] transition-all cursor-pointer text-xs sm:text-sm"
          >
            <Shuffle className="w-5 h-5" />
            <span>Randomize</span>
          </button>
        </div>
      </div>

      {/* Unlocked Banner */}
      <div className="mb-4 p-2.5 bg-[#FEF08A] border-3 border-black rounded-xl shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex items-center justify-between text-xs sm:text-sm font-black text-black">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-600 animate-bounce" />
          <span>EVERY COSMETIC ITEM IS 100% UNLOCKED FROM THE START! NO LOCKS, NO PURCHASES!</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Live 2D Fighter Preview Stage */}
        <div className="lg:col-span-4 bg-white rounded-2xl border-4 border-black p-4 sm:p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex flex-col items-center sticky top-4">
          <div className="relative w-full aspect-square max-w-[320px] bg-[#FFFBEB] rounded-xl border-3 border-black overflow-hidden shadow-inner flex items-center justify-center">
            {/* Comic Starburst backdrop */}
            <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
              <div className="w-64 h-64 rounded-full bg-[#FFD700] animate-spin" style={{ animationDuration: '30s' }} />
            </div>

            <canvas
              ref={previewCanvasRef}
              width={340}
              height={360}
              className="relative z-10 w-full h-full"
            />

            <div className="absolute top-2 right-2 bg-[#FFD700] text-black border-2 border-black px-2 py-0.5 rounded-full text-xs font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              Live Preview
            </div>
          </div>

          {/* Test Stance Buttons */}
          <div className="w-full mt-3 flex items-center justify-center gap-1.5 flex-wrap">
            <button
              onClick={() => triggerAnim('fast_attack')}
              className="px-2.5 py-1.5 bg-[#FF5733] text-white font-black text-xs rounded-lg border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-[#ff6f4f] cursor-pointer"
            >
              Punch!
            </button>
            <button
              onClick={() => triggerAnim('heavy_attack')}
              className="px-2.5 py-1.5 bg-[#FFD700] text-black font-black text-xs rounded-lg border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-[#ffe234] cursor-pointer"
            >
              Dropkick!
            </button>
            <button
              onClick={() => triggerAnim('block')}
              className="px-2.5 py-1.5 bg-[#3498DB] text-white font-black text-xs rounded-lg border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-[#4ea8e5] cursor-pointer"
            >
              Shield!
            </button>
            <button
              onClick={() => triggerAnim('victory')}
              className="px-2.5 py-1.5 bg-[#10B981] text-white font-black text-xs rounded-lg border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-emerald-400 cursor-pointer"
            >
              Victory!
            </button>
          </div>

          {/* Fighter Name & Stance Silhouette Selector */}
          <div className="w-full mt-4 space-y-3 pt-3 border-t-2 border-slate-200">
            <div>
              <label className="block text-xs font-black text-black uppercase tracking-wider mb-1">
                Fighter Name
              </label>
              <input
                id="input_fighter_name"
                type="text"
                maxLength={16}
                value={current.name}
                onChange={(e) => setCurrent({ ...current, name: e.target.value })}
                className="w-full px-3 py-2 bg-[#F3F4F6] text-black font-bold text-base rounded-xl border-2 border-black focus:outline-none focus:ring-2 focus:ring-[#FFD700] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                placeholder="Enter nickname..."
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                id="btn_select_gender_male"
                onClick={() => {
                  sound.playComicPop();
                  setCurrent({ ...current, gender: 'male' });
                }}
                className={`flex items-center justify-center gap-1.5 p-2 rounded-xl border-2 border-black font-black text-xs transition-all cursor-pointer ${
                  current.gender === 'male'
                    ? 'bg-[#3498DB] text-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
                    : 'bg-[#F3F4F6] text-black hover:bg-slate-200'
                }`}
              >
                <span>🥋 Male</span>
              </button>
              <button
                id="btn_select_gender_female"
                onClick={() => {
                  sound.playComicPop();
                  setCurrent({ ...current, gender: 'female' });
                }}
                className={`flex items-center justify-center gap-1.5 p-2 rounded-xl border-2 border-black font-black text-xs transition-all cursor-pointer ${
                  current.gender === 'female'
                    ? 'bg-[#FF5733] text-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
                    : 'bg-[#F3F4F6] text-black hover:bg-slate-200'
                }`}
              >
                <span>🌸 Female</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Category Tabs & Options Studio */}
        <div className="lg:col-span-8 bg-white rounded-2xl border-4 border-black p-4 sm:p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] space-y-5">
          {/* Category Tabs Scroll Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b-2 border-slate-200 no-scrollbar">
            {[
              { id: 'skin', label: 'Skin', icon: '👤' },
              { id: 'hair', label: 'Hair', icon: '💇' },
              { id: 'headwear', label: 'Headwear', icon: '🧢' },
              { id: 'face', label: 'Face', icon: '🕶️' },
              { id: 'outfit', label: 'Outfit', icon: '👕' },
              { id: 'cape', label: 'Back / Cape', icon: '🚩' },
              { id: 'shoes', label: 'Shoes', icon: '👟' },
              { id: 'accessories', label: 'Accessories', icon: '💍' },
              { id: 'effects', label: 'Effects', icon: '✨' },
              { id: 'colors', label: 'Colors', icon: '🎨' },
              { id: 'presets', label: 'Presets', icon: '👗' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  sound.playComicPop();
                  setActiveTab(tab.id as CategoryTab);
                }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 border-black font-black text-xs whitespace-nowrap transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-[#FFD700] text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] translate-y-[-1px]'
                    : 'bg-[#F3F4F6] text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* TAB 1: SKIN */}
          {activeTab === 'skin' && (
            <div className="space-y-4">
              <h3 className="font-black text-black uppercase tracking-wider text-sm">Select Body Skin / Tone</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {SKINS_CATALOG.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      sound.playComicPop();
                      setCurrent({ ...current, skin: item.id });
                    }}
                    className={`flex flex-col items-start p-3 rounded-xl border-3 border-black transition-all text-left cursor-pointer ${
                      (current.skin || 'classic') === item.id
                        ? 'bg-[#FEF08A] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                        : 'bg-[#F8FAFC] hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="text-xl">{item.icon}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${getRarityBadge(item.rarity)}`}>
                        {item.rarity}
                      </span>
                    </div>
                    <span className="font-bold text-xs text-black">{item.name}</span>
                    <span className="text-[10px] text-slate-500 line-clamp-1">{item.description}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: HAIR */}
          {activeTab === 'hair' && (
            <div className="space-y-4">
              <h3 className="font-black text-black uppercase tracking-wider text-sm">Select Hairstyle</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {HAIR_CATALOG.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      sound.playComicPop();
                      setCurrent({ ...current, hair: item.id });
                    }}
                    className={`flex flex-col items-start p-3 rounded-xl border-3 border-black transition-all text-left cursor-pointer ${
                      (current.hair || 'none') === item.id
                        ? 'bg-[#FEF08A] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                        : 'bg-[#F8FAFC] hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="text-xl">{item.icon}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${getRarityBadge(item.rarity)}`}>
                        {item.rarity}
                      </span>
                    </div>
                    <span className="font-bold text-xs text-black">{item.name}</span>
                    <span className="text-[10px] text-slate-500 line-clamp-1">{item.description}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: HEADWEAR */}
          {activeTab === 'headwear' && (
            <div className="space-y-4">
              <h3 className="font-black text-black uppercase tracking-wider text-sm">Select Hat & Headwear</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[360px] overflow-y-auto pr-1">
                {HEADWEAR_CATALOG.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      sound.playComicPop();
                      setCurrent({ ...current, hat: item.id });
                    }}
                    className={`flex flex-col items-start p-3 rounded-xl border-3 border-black transition-all text-left cursor-pointer ${
                      (current.hat || 'none') === item.id
                        ? 'bg-[#FEF08A] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                        : 'bg-[#F8FAFC] hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="text-xl">{item.icon}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${getRarityBadge(item.rarity)}`}>
                        {item.rarity}
                      </span>
                    </div>
                    <span className="font-bold text-xs text-black">{item.name}</span>
                    <span className="text-[10px] text-slate-500 line-clamp-1">{item.description}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: FACE */}
          {activeTab === 'face' && (
            <div className="space-y-4">
              <h3 className="font-black text-black uppercase tracking-wider text-sm">Select Face Accessories & Glasses</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {FACE_CATALOG.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      sound.playComicPop();
                      setCurrent({ ...current, face: item.id });
                    }}
                    className={`flex flex-col items-start p-3 rounded-xl border-3 border-black transition-all text-left cursor-pointer ${
                      (current.face || 'none') === item.id
                        ? 'bg-[#FEF08A] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                        : 'bg-[#F8FAFC] hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="text-xl">{item.icon}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${getRarityBadge(item.rarity)}`}>
                        {item.rarity}
                      </span>
                    </div>
                    <span className="font-bold text-xs text-black">{item.name}</span>
                    <span className="text-[10px] text-slate-500 line-clamp-1">{item.description}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: OUTFIT */}
          {activeTab === 'outfit' && (
            <div className="space-y-4">
              <h3 className="font-black text-black uppercase tracking-wider text-sm">Select Outfit & Clothing</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[360px] overflow-y-auto pr-1">
                {OUTFIT_CATALOG.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      sound.playComicPop();
                      setCurrent({ ...current, outfit: item.id });
                    }}
                    className={`flex flex-col items-start p-3 rounded-xl border-3 border-black transition-all text-left cursor-pointer ${
                      (current.outfit || 'none') === item.id
                        ? 'bg-[#FEF08A] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                        : 'bg-[#F8FAFC] hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="text-xl">{item.icon}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${getRarityBadge(item.rarity)}`}>
                        {item.rarity}
                      </span>
                    </div>
                    <span className="font-bold text-xs text-black">{item.name}</span>
                    <span className="text-[10px] text-slate-500 line-clamp-1">{item.description}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* TAB 6: CAPE & BACK */}
          {activeTab === 'cape' && (
            <div className="space-y-4">
              <h3 className="font-black text-black uppercase tracking-wider text-sm">Select Cape, Backpack & Wings</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[360px] overflow-y-auto pr-1">
                {CAPE_CATALOG.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      sound.playComicPop();
                      setCurrent({ ...current, cape: item.id });
                    }}
                    className={`flex flex-col items-start p-3 rounded-xl border-3 border-black transition-all text-left cursor-pointer ${
                      (current.cape || 'none') === item.id
                        ? 'bg-[#FEF08A] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                        : 'bg-[#F8FAFC] hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="text-xl">{item.icon}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${getRarityBadge(item.rarity)}`}>
                        {item.rarity}
                      </span>
                    </div>
                    <span className="font-bold text-xs text-black">{item.name}</span>
                    <span className="text-[10px] text-slate-500 line-clamp-1">{item.description}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* TAB 7: SHOES */}
          {activeTab === 'shoes' && (
            <div className="space-y-4">
              <h3 className="font-black text-black uppercase tracking-wider text-sm">Select Shoes & Footwear</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {SHOE_CATALOG.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      sound.playComicPop();
                      setCurrent({ ...current, shoes: item.id });
                    }}
                    className={`flex flex-col items-start p-3 rounded-xl border-3 border-black transition-all text-left cursor-pointer ${
                      (current.shoes || 'none') === item.id
                        ? 'bg-[#FEF08A] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                        : 'bg-[#F8FAFC] hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="text-xl">{item.icon}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${getRarityBadge(item.rarity)}`}>
                        {item.rarity}
                      </span>
                    </div>
                    <span className="font-bold text-xs text-black">{item.name}</span>
                    <span className="text-[10px] text-slate-500 line-clamp-1">{item.description}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* TAB 8: ACCESSORIES */}
          {activeTab === 'accessories' && (
            <div className="space-y-4">
              <h3 className="font-black text-black uppercase tracking-wider text-sm">Select Accessories & Jewelry</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[360px] overflow-y-auto pr-1">
                {ACCESSORY_CATALOG.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      sound.playComicPop();
                      setCurrent({ ...current, accessory: item.id });
                    }}
                    className={`flex flex-col items-start p-3 rounded-xl border-3 border-black transition-all text-left cursor-pointer ${
                      (current.accessory || 'none') === item.id
                        ? 'bg-[#FEF08A] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                        : 'bg-[#F8FAFC] hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="text-xl">{item.icon}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${getRarityBadge(item.rarity)}`}>
                        {item.rarity}
                      </span>
                    </div>
                    <span className="font-bold text-xs text-black">{item.name}</span>
                    <span className="text-[10px] text-slate-500 line-clamp-1">{item.description}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* TAB 9: EFFECTS */}
          {activeTab === 'effects' && (
            <div className="space-y-4">
              <h3 className="font-black text-black uppercase tracking-wider text-sm">Select Special Visual Effect</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {EFFECT_CATALOG.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      sound.playComicPop();
                      setCurrent({ ...current, effect: item.id });
                    }}
                    className={`flex flex-col items-start p-3 rounded-xl border-3 border-black transition-all text-left cursor-pointer ${
                      (current.effect || 'none') === item.id
                        ? 'bg-[#FEF08A] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                        : 'bg-[#F8FAFC] hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="text-xl">{item.icon}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${getRarityBadge(item.rarity)}`}>
                        {item.rarity}
                      </span>
                    </div>
                    <span className="font-bold text-xs text-black">{item.name}</span>
                    <span className="text-[10px] text-slate-500 line-clamp-1">{item.description}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* TAB 10: COLORS */}
          {activeTab === 'colors' && (
            <div className="space-y-4">
              {/* Primary Color */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-black text-black uppercase tracking-wider">
                    Primary Body Color
                  </label>
                  <input
                    type="color"
                    value={current.color}
                    onChange={(e) => setCurrent({ ...current, color: e.target.value })}
                    className="w-7 h-7 rounded border-2 border-black cursor-pointer bg-transparent"
                  />
                </div>
                <div className="grid grid-cols-6 sm:grid-cols-9 gap-1.5">
                  {PRESET_COLORS.map((preset) => (
                    <button
                      key={preset.hex}
                      onClick={() => {
                        sound.playComicPop();
                        setCurrent({ ...current, color: preset.hex });
                      }}
                      className="h-8 rounded-lg border-2 border-black transition-all cursor-pointer hover:scale-105"
                      style={{ backgroundColor: preset.hex }}
                    />
                  ))}
                </div>
              </div>

              {/* Secondary Color */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-black text-black uppercase tracking-wider">
                    Secondary Outfit / Hat Color
                  </label>
                  <input
                    type="color"
                    value={current.secondaryColor || '#38BDF8'}
                    onChange={(e) => setCurrent({ ...current, secondaryColor: e.target.value })}
                    className="w-7 h-7 rounded border-2 border-black cursor-pointer bg-transparent"
                  />
                </div>
                <div className="grid grid-cols-6 sm:grid-cols-9 gap-1.5">
                  {PRESET_COLORS.map((preset) => (
                    <button
                      key={preset.hex}
                      onClick={() => {
                        sound.playComicPop();
                        setCurrent({ ...current, secondaryColor: preset.hex });
                      }}
                      className="h-8 rounded-lg border-2 border-black transition-all cursor-pointer hover:scale-105"
                      style={{ backgroundColor: preset.hex }}
                    />
                  ))}
                </div>
              </div>

              {/* Accent Color */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-black text-black uppercase tracking-wider">
                    Accent Hair / Detail Color
                  </label>
                  <input
                    type="color"
                    value={current.accentColor || '#FACC15'}
                    onChange={(e) => setCurrent({ ...current, accentColor: e.target.value })}
                    className="w-7 h-7 rounded border-2 border-black cursor-pointer bg-transparent"
                  />
                </div>
                <div className="grid grid-cols-6 sm:grid-cols-9 gap-1.5">
                  {PRESET_COLORS.map((preset) => (
                    <button
                      key={preset.hex}
                      onClick={() => {
                        sound.playComicPop();
                        setCurrent({ ...current, accentColor: preset.hex });
                      }}
                      className="h-8 rounded-lg border-2 border-black transition-all cursor-pointer hover:scale-105"
                      style={{ backgroundColor: preset.hex }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 11: PRESETS */}
          {activeTab === 'presets' && (
            <div className="space-y-4">
              <h3 className="font-black text-black uppercase tracking-wider text-sm">Select Ready-Made Character Preset</h3>
              <p className="text-xs text-slate-600">
                Selecting a preset applies a full cosmetic outfit. You can still modify any item or category afterwards!
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[360px] overflow-y-auto pr-1">
                {PRESET_OUTFITS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      sound.playComicPop();
                      setCurrent({
                        ...current,
                        ...p.customization,
                      });
                    }}
                    className="flex items-start gap-3 p-3.5 bg-[#F8FAFC] hover:bg-[#FEF08A] rounded-xl border-3 border-black transition-all text-left cursor-pointer shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
                  >
                    <span className="text-3xl">{p.icon}</span>
                    <div>
                      <span className="font-black text-sm text-black block">{p.name}</span>
                      <span className="text-xs text-slate-600 leading-snug block">{p.description}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* SAVE & READY BUTTON */}
          <div className="pt-2">
            <button
              id="btn_save_fighter"
              onClick={handleSaveAndReturn}
              className="w-full py-4 bg-[#10B981] hover:bg-emerald-400 text-white font-black text-xl rounded-2xl border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-[2px] active:translate-y-[2px] transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Check className="w-6 h-6" />
              <span>READY TO FIGHT!</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
