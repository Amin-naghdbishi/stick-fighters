import React, { useState } from 'react';
import {
  Volume2,
  VolumeX,
  Keyboard,
  Check,
  X,
  Music,
  Zap,
  Sliders,
  Play,
  RotateCcw,
  Trophy,
  Shield,
  Frown,
} from 'lucide-react';
import { sound } from '../game/audio';

const HUD_KEY = 'stick_fighters_hud_enabled';

export function getHudEnabled(): boolean {
  try {
    const saved = localStorage.getItem(HUD_KEY);
    return saved !== null ? JSON.parse(saved) : true;
  } catch (e) {
    return true;
  }
}

export function setHudEnabled(enabled: boolean) {
  try {
    localStorage.setItem(HUD_KEY, JSON.stringify(enabled));
    window.dispatchEvent(new CustomEvent('sf_hud_toggled', { detail: { enabled } }));
  } catch (e) {}
}

interface SettingsModalProps {
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
  const initialSettings = sound.getSettings();
  const [masterVol, setMasterVol] = useState(initialSettings.masterVolume);
  const [musicVol, setMusicVol] = useState(initialSettings.musicVolume);
  const [sfxVol, setSfxVol] = useState(initialSettings.sfxVolume);
  const [musicEnabled, setMusicEnabled] = useState(initialSettings.musicEnabled);
  const [sfxEnabled, setSfxEnabled] = useState(initialSettings.sfxEnabled);
  const [hudEnabledState, setHudEnabledState] = useState(getHudEnabled());

  const handleMasterChange = (val: number) => {
    setMasterVol(val);
    sound.setMasterVolume(val);
  };

  const handleMusicChange = (val: number) => {
    setMusicVol(val);
    sound.setMusicVolume(val);
  };

  const handleSfxChange = (val: number) => {
    setSfxVol(val);
    sound.setSfxVolume(val);
    sound.playFastPunch();
  };

  const handleToggleMusic = () => {
    const next = sound.toggleMusic();
    setMusicEnabled(next);
  };

  const handleToggleSfx = () => {
    const next = sound.toggleSfx();
    setSfxEnabled(next);
    if (next) sound.playClick();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-[#FFFBEB] rounded-3xl border-6 border-black p-5 sm:p-6 max-w-lg w-full shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] space-y-5 my-8 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b-3 border-black pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#FFD700] rounded-xl border-3 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <Sliders className="w-6 h-6 text-black" />
            </div>
            <div>
              <h3 className="text-xl sm:text-2xl font-black text-black uppercase tracking-tight">
                Audio & Game Settings
              </h3>
              <p className="text-xs font-bold text-slate-600">
                Custom sound mixing, procedural themes & controls
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              sound.playJump();
              onClose();
            }}
            className="p-1.5 rounded-xl border-3 border-black bg-slate-100 hover:bg-slate-200 text-black font-black cursor-pointer shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Audio Volume Controls Group */}
        <div className="space-y-3.5 bg-white p-4 sm:p-5 rounded-2xl border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex items-center justify-between mb-1">
            <h4 className="text-xs font-black text-black uppercase tracking-wider flex items-center gap-1.5">
              <Volume2 className="w-4 h-4 text-[#3498DB]" />
              <span>Volume Channels</span>
            </h4>
            <span className="text-[10px] font-bold text-slate-500 uppercase">Independent Control</span>
          </div>

          {/* Master Volume */}
          <div className="space-y-1 bg-[#F3F4F6] p-3 rounded-xl border-2 border-black">
            <div className="flex justify-between items-center text-xs font-black text-black uppercase">
              <span>Master Volume</span>
              <span className="font-mono bg-white px-2 py-0.5 rounded border border-black text-[11px]">
                {Math.round(masterVol * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={masterVol}
              onChange={(e) => handleMasterChange(parseFloat(e.target.value))}
              className="w-full h-2.5 bg-slate-300 rounded-lg appearance-none cursor-pointer accent-black"
            />
          </div>

          {/* Music Volume & Toggle */}
          <div className="space-y-1.5 bg-[#F3F4F6] p-3 rounded-xl border-2 border-black">
            <div className="flex justify-between items-center text-xs font-black text-black uppercase">
              <div className="flex items-center gap-1.5">
                <Music className="w-4 h-4 text-purple-700" />
                <span>Music (BGM Themes)</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-mono bg-white px-2 py-0.5 rounded border border-black text-[11px]">
                  {musicEnabled ? `${Math.round(musicVol * 100)}%` : 'OFF'}
                </span>
                <button
                  onClick={handleToggleMusic}
                  className={`px-2.5 py-0.5 rounded-lg border-2 border-black text-[10px] font-black cursor-pointer transition-all ${
                    musicEnabled ? 'bg-[#10B981] text-white' : 'bg-slate-300 text-slate-700'
                  }`}
                >
                  {musicEnabled ? 'MUSIC: ON' : 'MUSIC: OFF'}
                </button>
              </div>
            </div>

            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              disabled={!musicEnabled}
              value={musicVol}
              onChange={(e) => handleMusicChange(parseFloat(e.target.value))}
              className="w-full h-2.5 bg-slate-300 rounded-lg appearance-none cursor-pointer accent-[#9B59B6] disabled:opacity-40"
            />
          </div>

          {/* SFX Volume & Toggle */}
          <div className="space-y-1.5 bg-[#F3F4F6] p-3 rounded-xl border-2 border-black">
            <div className="flex justify-between items-center text-xs font-black text-black uppercase">
              <div className="flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-orange-600" />
                <span>Sound Effects (SFX)</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-mono bg-white px-2 py-0.5 rounded border border-black text-[11px]">
                  {sfxEnabled ? `${Math.round(sfxVol * 100)}%` : 'OFF'}
                </span>
                <button
                  onClick={handleToggleSfx}
                  className={`px-2.5 py-0.5 rounded-lg border-2 border-black text-[10px] font-black cursor-pointer transition-all ${
                    sfxEnabled ? 'bg-[#10B981] text-white' : 'bg-slate-300 text-slate-700'
                  }`}
                >
                  {sfxEnabled ? 'SFX: ON' : 'SFX: OFF'}
                </button>
              </div>
            </div>

            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              disabled={!sfxEnabled}
              value={sfxVol}
              onChange={(e) => handleSfxChange(parseFloat(e.target.value))}
              className="w-full h-2.5 bg-slate-300 rounded-lg appearance-none cursor-pointer accent-[#FF5733] disabled:opacity-40"
            />
          </div>

          {/* Performance HUD Toggle */}
          <div className="flex items-center justify-between bg-[#F3F4F6] p-3 rounded-xl border-2 border-black">
            <div>
              <div className="text-xs font-black text-black uppercase flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-emerald-600" />
                <span>Performance HUD (Ping, FPS, Net Status)</span>
              </div>
              <span className="text-[10px] font-bold text-slate-500">Displays real latency & rendering FPS in matches</span>
            </div>

            <button
              onClick={() => {
                const next = !hudEnabledState;
                setHudEnabled(next);
                setHudEnabledState(next);
                sound.playClick();
              }}
              className={`px-3 py-1 rounded-lg border-2 border-black text-[11px] font-black cursor-pointer transition-all ${
                hudEnabledState ? 'bg-[#10B981] text-white' : 'bg-slate-300 text-slate-700'
              }`}
            >
              {hudEnabledState ? 'HUD: ON' : 'HUD: OFF'}
            </button>
          </div>
        </div>

        {/* Audio Stinger Test Board (To verify distinct Victory, Defeat, Replay, etc.) */}
        <div className="space-y-2.5 bg-white p-4 rounded-2xl border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black text-black uppercase tracking-wider">
              Audio SFX & Stinger Test
            </h4>
            <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
              Interactive Preview
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => sound.playVictoryFanfare()}
              className="p-2 bg-[#FFD700] hover:bg-[#ffe234] text-black font-black text-[11px] rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] cursor-pointer flex flex-col items-center gap-1 active:translate-x-[1px] active:translate-y-[1px]"
            >
              <Trophy className="w-4 h-4 text-black" />
              <span>Victory Fanfare</span>
            </button>

            <button
              onClick={() => sound.playDefeatStinger()}
              className="p-2 bg-rose-100 hover:bg-rose-200 text-rose-900 font-black text-[11px] rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] cursor-pointer flex flex-col items-center gap-1 active:translate-x-[1px] active:translate-y-[1px]"
            >
              <Frown className="w-4 h-4 text-rose-800" />
              <span>Defeat Stinger</span>
            </button>

            <button
              onClick={() => sound.playReplayStinger()}
              className="p-2 bg-[#A8E6CF] hover:bg-[#bbf2df] text-emerald-950 font-black text-[11px] rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] cursor-pointer flex flex-col items-center gap-1 active:translate-x-[1px] active:translate-y-[1px]"
            >
              <RotateCcw className="w-4 h-4 text-emerald-900" />
              <span>Replay SFX</span>
            </button>

            <button
              onClick={() => sound.playFastPunch()}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-black font-black text-[11px] rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] cursor-pointer flex items-center justify-center gap-1"
            >
              <span>🥊 Punch</span>
            </button>

            <button
              onClick={() => sound.playHeavyHit()}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-black font-black text-[11px] rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] cursor-pointer flex items-center justify-center gap-1"
            >
              <span>💥 Heavy Kick</span>
            </button>

            <button
              onClick={() => sound.playShieldBlock()}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-black font-black text-[11px] rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] cursor-pointer flex items-center justify-center gap-1"
            >
              <span>🛡️ Shield Guard</span>
            </button>
          </div>
        </div>

        {/* Keyboard & Controls Reference Guide */}
        <div className="space-y-2">
          <h4 className="text-xs font-black text-black uppercase tracking-wider flex items-center gap-1.5">
            <Keyboard className="w-4 h-4 text-black" />
            <span>Keyboard & Mobile Controls Guide</span>
          </h4>
          <div className="grid grid-cols-2 gap-2 text-xs font-bold text-black">
            <div className="bg-sky-50 p-2.5 rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <span className="text-sky-900 font-black block">Movement:</span>
              <span>A / D or ◄ / ►</span>
            </div>
            <div className="bg-emerald-50 p-2.5 rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <span className="text-emerald-900 font-black block">Jump / Double:</span>
              <span>W / Space / ▲</span>
            </div>
            <div className="bg-rose-50 p-2.5 rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <span className="text-rose-900 font-black block">Quick Punch:</span>
              <span>J or Z Key</span>
            </div>
            <div className="bg-amber-50 p-2.5 rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <span className="text-amber-900 font-black block">Dropkick:</span>
              <span>K or X Key</span>
            </div>
            <div className="bg-purple-50 p-2.5 rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] col-span-2">
              <span className="text-purple-900 font-black block">Shield Bubble Guard:</span>
              <span>L / C / Shift (Blocks 80% damage & negates knockback)</span>
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            sound.playJump();
            onClose();
          }}
          className="w-full py-3 bg-[#FFD700] hover:bg-[#ffe234] text-black font-black text-base rounded-xl border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer flex items-center justify-center gap-2"
        >
          <Check className="w-5 h-5" />
          <span>CONFIRM & CLOSE</span>
        </button>
      </div>
    </div>
  );
};
