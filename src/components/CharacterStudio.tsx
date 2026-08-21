import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Sparkles, User, Shuffle, Check, ArrowLeft, Palette, Crown, Shield } from 'lucide-react';
import { FighterCustomization, Gender, HatType } from '../types/game';
import { GameRenderer } from '../game/renderer';
import { createInitialFighter } from '../game/physics';
import { sound } from '../game/audio';

interface CharacterStudioProps {
  customization: FighterCustomization;
  onSave: (cust: FighterCustomization) => void;
  onBack: () => void;
}

const PRESET_COLORS = [
  { name: 'Terracotta Coral', hex: '#FF5733' },
  { name: 'Sun Gold', hex: '#FFD700' },
  { name: 'Sky Azure', hex: '#3498DB' },
  { name: 'Mint Meadow', hex: '#A8E6CF' },
  { name: 'Lilac Purple', hex: '#9B59B6' },
  { name: 'Cobalt Blue', hex: '#2563EB' },
  { name: 'Comic Red', hex: '#EF4444' },
  { name: 'Emerald Green', hex: '#10B981' },
  { name: 'Sunny Orange', hex: '#F97316' },
  { name: 'Dark Ink', hex: '#334155' },
];

const HATS: { id: HatType; label: string; icon: string }[] = [
  { id: 'none', label: 'None', icon: '👤' },
  { id: 'headband', label: 'Karate Bandana', icon: '🥋' },
  { id: 'cap', label: 'Detective Cap', icon: '🧢' },
  { id: 'cowboy', label: 'Cowboy Hat', icon: '🤠' },
  { id: 'crown', label: 'Royal Crown', icon: '👑' },
  { id: 'ninja', label: 'Ninja Mask', icon: '🥷' },
  { id: 'horns', label: 'Viking Horns', icon: '⚔️' },
  { id: 'ribbon', label: 'Hair Ribbon', icon: '🎀' },
  { id: 'boxing', label: 'Boxing Gloves', icon: '🥊' },
];

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
];

export const CharacterStudio: React.FC<CharacterStudioProps> = ({
  customization,
  onSave,
  onBack,
}) => {
  const [current, setCurrent] = useState<FighterCustomization>({ ...customization });
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
      current.name,
      current.gender,
      current.color,
      current.hat,
      300,
      280
    );

    const loop = () => {
      const now = Date.now();

      fighter.name = current.name;
      fighter.gender = current.gender;
      fighter.color = current.color;
      fighter.hat = current.hat;
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
    const randomColor = PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)].hex;
    const randomHat = HATS[Math.floor(Math.random() * HATS.length)].id;
    const randomGender = Math.random() > 0.5 ? 'male' : 'female';

    setCurrent({
      name: randomName,
      color: randomColor,
      hat: randomHat,
      gender: randomGender,
    });
    sound.playComicPop();
  };

  const handleSaveAndReturn = () => {
    sound.playJump();
    onSave(current);
    onBack();
  };

  return (
    <div id="character_studio_container" className="w-full max-w-5xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          id="btn_back_from_studio"
          onClick={() => {
            sound.playJump();
            onBack();
          }}
          className="flex items-center gap-2 px-4 py-2 bg-white text-black font-bold rounded-xl border-3 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-amber-50 active:translate-x-[2px] active:translate-y-[2px] transition-all cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Menu</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="text-2xl">🎨</span>
          <h1 className="text-2xl sm:text-3xl font-black text-black tracking-tight uppercase">
            Fighter Studio
          </h1>
        </div>

        <button
          id="btn_randomize_fighter"
          onClick={handleRandomize}
          className="flex items-center gap-2 px-4 py-2 bg-[#FFD700] text-black font-bold rounded-xl border-3 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-[#ffe234] transition-all cursor-pointer"
        >
          <Shuffle className="w-5 h-5" />
          <span className="hidden sm:inline">Randomize</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: 3D-like Live Stickman Stage */}
        <div className="lg:col-span-5 bg-white rounded-2xl border-4 border-black p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex flex-col items-center">
          <div className="relative w-full aspect-square max-w-[340px] bg-[#FFFBEB] rounded-xl border-3 border-black overflow-hidden shadow-inner flex items-center justify-center">
            {/* Comic Starburst behind canvas */}
            <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
              <div className="w-64 h-64 rounded-full bg-[#FFD700] animate-spin" style={{ animationDuration: '30s' }} />
            </div>

            <canvas
              ref={previewCanvasRef}
              width={340}
              height={360}
              className="relative z-10 w-full h-full"
            />

            {/* Tap for action hint */}
            <div className="absolute top-2 right-2 bg-[#FFD700] text-black border-2 border-black px-2.5 py-0.5 rounded-full text-xs font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              Live Stance
            </div>
          </div>

          {/* Test Stance Buttons */}
          <div className="w-full mt-4 flex items-center justify-center gap-2 flex-wrap">
            <button
              onClick={() => triggerAnim('fast_attack')}
              className="px-3 py-1.5 bg-[#FF5733] text-white font-black text-xs rounded-lg border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-[#ff6f4f] transition-all cursor-pointer"
            >
              Punch!
            </button>
            <button
              onClick={() => triggerAnim('heavy_attack')}
              className="px-3 py-1.5 bg-[#FFD700] text-black font-black text-xs rounded-lg border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-[#ffe234] transition-all cursor-pointer"
            >
              Dropkick!
            </button>
            <button
              onClick={() => triggerAnim('block')}
              className="px-3 py-1.5 bg-[#3498DB] text-white font-black text-xs rounded-lg border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-[#4ea8e5] transition-all cursor-pointer"
            >
              Shield!
            </button>
            <button
              onClick={() => triggerAnim('victory')}
              className="px-3 py-1.5 bg-[#10B981] text-white font-black text-xs rounded-lg border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-emerald-400 transition-all cursor-pointer"
            >
              Victory!
            </button>
          </div>
        </div>

        {/* Right: Customization Controls */}
        <div className="lg:col-span-7 bg-white rounded-2xl border-4 border-black p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] space-y-6">
          {/* 1. Name Input */}
          <div>
            <label className="block text-sm font-black text-black uppercase tracking-wider mb-2">
              Fighter Name
            </label>
            <div className="relative">
              <input
                id="input_fighter_name"
                type="text"
                maxLength={16}
                value={current.name}
                onChange={(e) => setCurrent({ ...current, name: e.target.value })}
                className="w-full px-4 py-3 bg-[#F3F4F6] text-black font-bold text-lg rounded-xl border-3 border-black focus:outline-none focus:ring-2 focus:ring-[#FFD700] shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
                placeholder="Enter nickname..."
              />
              <span className="absolute right-3 top-3.5 text-xs font-bold text-slate-400">
                {current.name.length}/16
              </span>
            </div>
          </div>

          {/* 2. Gender / Stance Model Selection */}
          <div>
            <label className="block text-sm font-black text-black uppercase tracking-wider mb-2">
              Fighter Silhouette & Stance
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                id="btn_select_gender_male"
                onClick={() => {
                  sound.playComicPop();
                  setCurrent({ ...current, gender: 'male' });
                }}
                className={`flex items-center justify-center gap-3 p-3.5 rounded-xl border-3 border-black font-black text-base transition-all cursor-pointer ${
                  current.gender === 'male'
                    ? 'bg-[#3498DB] text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] translate-x-[-1px] translate-y-[-1px]'
                    : 'bg-[#F3F4F6] text-black hover:bg-slate-200'
                }`}
              >
                <span className="text-xl">🥋</span>
                <span>Stickman (Male)</span>
              </button>

              <button
                id="btn_select_gender_female"
                onClick={() => {
                  sound.playComicPop();
                  setCurrent({ ...current, gender: 'female' });
                }}
                className={`flex items-center justify-center gap-3 p-3.5 rounded-xl border-3 border-black font-black text-base transition-all cursor-pointer ${
                  current.gender === 'female'
                    ? 'bg-[#FF5733] text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] translate-x-[-1px] translate-y-[-1px]'
                    : 'bg-[#F3F4F6] text-black hover:bg-slate-200'
                }`}
              >
                <span className="text-xl">🌸</span>
                <span>Stickwoman (Female)</span>
              </button>
            </div>
            <p className="text-xs text-slate-600 font-semibold mt-1.5 ml-1">
              ✨ Both fighters have 100% equal combat speed, health, and punch power.
            </p>
          </div>

          {/* 3. Color Picker & Swatches */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-black text-black uppercase tracking-wider">
                Fighter Body Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={current.color}
                  onChange={(e) => setCurrent({ ...current, color: e.target.value })}
                  className="w-7 h-7 rounded-lg border-2 border-black cursor-pointer bg-transparent"
                />
                <span className="text-xs font-mono font-bold text-black bg-[#F3F4F6] px-2 py-1 rounded-md border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
                  {current.color.toUpperCase()}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
              {PRESET_COLORS.map((preset) => (
                <button
                  key={preset.hex}
                  onClick={() => {
                    sound.playComicPop();
                    setCurrent({ ...current, color: preset.hex });
                  }}
                  title={preset.name}
                  className={`h-10 rounded-xl border-3 border-black transition-all cursor-pointer flex items-center justify-center ${
                    current.color.toLowerCase() === preset.hex.toLowerCase()
                      ? 'ring-3 ring-[#FFD700] scale-110 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                      : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: preset.hex }}
                >
                  {current.color.toLowerCase() === preset.hex.toLowerCase() && (
                    <Check className="w-5 h-5 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* 4. Hats & Accessories */}
          <div>
            <label className="block text-sm font-black text-black uppercase tracking-wider mb-2">
              Comic Hat & Accessory
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-3 gap-2.5">
              {HATS.map((hat) => (
                <button
                  key={hat.id}
                  onClick={() => {
                    sound.playComicPop();
                    setCurrent({ ...current, hat: hat.id });
                  }}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border-3 border-black font-bold text-xs transition-all cursor-pointer ${
                    current.hat === hat.id
                      ? 'bg-[#FFD700] text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] translate-x-[-1px] translate-y-[-1px]'
                      : 'bg-[#F3F4F6] text-black hover:bg-slate-200'
                  }`}
                >
                  <span className="text-lg">{hat.icon}</span>
                  <span className="truncate">{hat.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Save & Ready Button */}
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
