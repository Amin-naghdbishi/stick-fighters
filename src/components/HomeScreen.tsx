import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Swords,
  Users,
  PlusCircle,
  LogIn,
  Bot,
  Palette,
  Settings,
  Sparkles,
  Zap,
  Shield,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { BotDifficultyLevel, FighterCustomization, GameMode } from '../types/game';
import { sound } from '../game/audio';
import { BOT_DIFFICULTY_CONFIGS } from '../game/botDifficulty';

interface HomeScreenProps {
  customization: FighterCustomization;
  isConnected: boolean;
  onQuickMatch: (mode: GameMode) => void;
  onCreateRoom: () => void;
  onJoinRoom: (roomId: string) => void;
  onPracticeBots: (botCount?: number, botDifficulty?: BotDifficultyLevel) => void;
  onOpenCustomizer: () => void;
  onOpenSettings: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  customization,
  isConnected,
  onQuickMatch,
  onCreateRoom,
  onJoinRoom,
  onPracticeBots,
  onOpenCustomizer,
  onOpenSettings,
}) => {
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showPracticeModal, setShowPracticeModal] = useState(false);
  const [practiceBotCount, setPracticeBotCount] = useState<number>(1);
  const [practiceDifficulty, setPracticeDifficulty] = useState<BotDifficultyLevel>(3);
  const [joinCode, setJoinCode] = useState('');
  const [isMusicPlaying, setIsMusicPlaying] = useState(() => sound.getSettings().musicEnabled);

  const handleToggleMusic = () => {
    const state = sound.toggleMusic();
    setIsMusicPlaying(state);
  };

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (joinCode.trim()) {
      sound.playCountdownBeep(true);
      onJoinRoom(joinCode.trim().toUpperCase());
    }
  };

  const handleStartPractice = () => {
    sound.playCountdownBeep(true);
    setShowPracticeModal(false);
    onPracticeBots(practiceBotCount, practiceDifficulty);
  };

  return (
    <div id="home_screen_container" className="w-full max-w-4xl mx-auto p-4 sm:p-6 space-y-8 flex flex-col items-center">
      {/* Top Status & Audio Bar */}
      <div className="w-full flex items-center justify-between">
        <div className="flex items-center gap-2 bg-white px-3.5 py-1.5 rounded-full border-3 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
          <span
            className={`w-3 h-3 rounded-full ${
              isConnected ? 'bg-[#10B981] animate-pulse' : 'bg-[#FFD700]'
            }`}
          />
          <span className="text-xs font-black text-black uppercase tracking-wide">
            {isConnected ? 'Multiplayer Live' : 'Local Ready'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleMusic}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border-3 border-black font-black text-xs transition-all cursor-pointer ${
              isMusicPlaying
                ? 'bg-[#FFD700] shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
                : 'bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-amber-50'
            }`}
          >
            {isMusicPlaying ? <Volume2 className="w-4 h-4 text-black" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
            <span className="hidden sm:inline text-black">{isMusicPlaying ? 'Music: ON' : 'Music: OFF'}</span>
          </button>

          <button
            id="btn_open_settings"
            onClick={() => {
              sound.playJump();
              onOpenSettings();
            }}
            className="p-2 bg-white text-black rounded-xl border-3 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-amber-50 transition-all cursor-pointer"
            title="Game Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Comic Logo Section */}
      <div className="text-center relative my-2">
        {/* Comic Starburst Halo */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-80 h-80 bg-[#FFD700] rounded-full opacity-20 blur-xl pointer-events-none" />

        <motion.div
          initial={{ scale: 0.8, y: -20 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: 'spring', damping: 12 }}
          className="relative inline-block"
        >
          <div className="inline-flex items-center gap-3 bg-[#FFD700] text-black px-6 py-2.5 rounded-3xl border-3 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-3 rotate-[-2deg]">
            <span className="text-2xl animate-bounce">🥊</span>
            <span className="text-xs sm:text-sm font-black uppercase tracking-widest text-black">
              2D Comic Arena • Stick Fighters
            </span>
            <span className="text-2xl animate-bounce" style={{ animationDelay: '0.2s' }}>
              ⚡
            </span>
          </div>

          <h1 className="text-5xl sm:text-7xl font-black text-black tracking-tight uppercase drop-shadow-[4px_4px_0px_#FFD700]">
            STICK FIGHTERS
          </h1>

          <p className="text-sm sm:text-base font-bold text-black/80 max-w-lg mx-auto mt-2">
            Jump, punch, dropkick, shield block, and knock your opponents out of the comic ring!
          </p>
        </motion.div>
      </div>

      {/* Current Fighter Profile Card Bar */}
      <div className="w-full max-w-lg bg-white rounded-2xl border-4 border-black p-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="w-13 h-13 rounded-xl border-3 border-black flex items-center justify-center text-2xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] relative"
            style={{ backgroundColor: customization.color }}
          >
            <span>{customization.gender === 'female' ? '🌸' : '🥋'}</span>
            {customization.hat !== 'none' && (
              <span className="absolute -top-1.5 -right-1.5 text-xs bg-white rounded-full border border-black p-0.5 shadow-xs">
                👑
              </span>
            )}
          </div>

          <div>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
              Active Fighter
            </span>
            <span className="text-lg font-black text-black">{customization.name}</span>
          </div>
        </div>

        <button
          id="btn_home_customize"
          onClick={() => {
            sound.playJump();
            onOpenCustomizer();
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#FFD700] hover:bg-[#ffe234] text-black font-black text-sm rounded-xl border-3 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] transition-all cursor-pointer"
        >
          <Palette className="w-4 h-4" />
          <span>Customize 🎨</span>
        </button>
      </div>

      {/* Main Action Menu Grid */}
      <div className="w-full max-w-lg grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {/* 1. Quick Duel Match (1v1) */}
        <button
          id="btn_quick_duel"
          onClick={() => {
            sound.playCountdownBeep(true);
            onQuickMatch('duel');
          }}
          className="p-5 bg-[#FF5733] hover:bg-[#ff6f4f] text-white rounded-2xl border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-[2px] active:translate-y-[2px] transition-all cursor-pointer flex flex-col items-center text-center gap-2 group"
        >
          <div className="p-3 bg-white text-[#FF5733] rounded-2xl border-3 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] group-hover:rotate-6 transition-transform">
            <Swords className="w-7 h-7" />
          </div>
          <div>
            <div className="font-black text-xl uppercase tracking-tight text-white">1v1 Duel</div>
            <div className="text-xs font-bold text-orange-100">Quick Matchmaking</div>
          </div>
        </button>

        {/* 2. Free For All (4P) */}
        <button
          id="btn_quick_ffa"
          onClick={() => {
            sound.playCountdownBeep(true);
            onQuickMatch('ffa');
          }}
          className="p-5 bg-[#9B59B6] hover:bg-[#ab6bc4] text-white rounded-2xl border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-[2px] active:translate-y-[2px] transition-all cursor-pointer flex flex-col items-center text-center gap-2 group"
        >
          <div className="p-3 bg-white text-[#9B59B6] rounded-2xl border-3 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] group-hover:rotate-6 transition-transform">
            <Users className="w-7 h-7" />
          </div>
          <div>
            <div className="font-black text-xl uppercase tracking-tight text-white">Free For All</div>
            <div className="text-xs font-bold text-purple-100">4-Fighter Arena Brawl</div>
          </div>
        </button>

        {/* 3. Create Custom Room */}
        <button
          id="btn_create_custom_room"
          onClick={() => {
            sound.playJump();
            onCreateRoom();
          }}
          className="p-4 bg-[#3498DB] hover:bg-[#4ea8e5] text-white rounded-2xl border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-[2px] active:translate-y-[2px] transition-all cursor-pointer flex items-center justify-center gap-3"
        >
          <PlusCircle className="w-6 h-6" />
          <span className="font-black text-base uppercase">Create Room</span>
        </button>

        {/* 4. Join by Code */}
        <button
          id="btn_join_by_code"
          onClick={() => {
            sound.playJump();
            setShowJoinModal(true);
          }}
          className="p-4 bg-[#FFD700] hover:bg-[#ffe234] text-black rounded-2xl border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-[2px] active:translate-y-[2px] transition-all cursor-pointer flex items-center justify-center gap-3"
        >
          <LogIn className="w-6 h-6" />
          <span className="font-black text-base uppercase">Join with Code</span>
        </button>

        {/* 5. Practice vs AI Bots (Instant Offline/Solo test) */}
        <button
          id="btn_practice_vs_bots"
          onClick={() => {
            sound.playJump();
            setShowPracticeModal(true);
          }}
          className="sm:col-span-2 p-4 bg-[#A8E6CF] hover:bg-[#bcf2df] text-black rounded-2xl border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-[2px] active:translate-y-[2px] transition-all cursor-pointer flex items-center justify-center gap-3"
        >
          <Bot className="w-6 h-6" />
          <span className="font-black text-lg uppercase">Practice vs AI Bots (Solo)</span>
        </button>
      </div>

      {/* Quick Controls Hint Pill */}
      <div className="bg-white rounded-2xl border-3 border-black px-4 py-2.5 text-xs font-bold text-black text-center shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
        <span>⌨️ <strong>Move:</strong> A/D | <strong>Jump:</strong> W/Space | <strong>Punch:</strong> J | <strong>Kick:</strong> K | <strong>Guard:</strong> L / Shift</span>
      </div>

      {/* Solo Practice vs AI Bots Setup Modal */}
      {showPracticeModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl border-6 border-black p-6 max-w-md w-full shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="w-6 h-6 text-purple-700" />
                <h3 className="text-xl font-black text-black uppercase">Solo Practice AI</h3>
              </div>
              <button
                onClick={() => setShowPracticeModal(false)}
                className="text-slate-500 hover:text-black font-black text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Number of Bot Opponents */}
            <div className="space-y-1.5">
              <label className="block text-xs font-black text-black uppercase">
                Number of Bots
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => {
                      sound.playComicPop();
                      setPracticeBotCount(count);
                    }}
                    className={`py-2 rounded-xl border-3 border-black font-black text-sm transition-all cursor-pointer ${
                      practiceBotCount === count
                        ? 'bg-purple-600 text-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
                        : 'bg-slate-100 text-black hover:bg-slate-200'
                    }`}
                  >
                    {count} {count === 1 ? 'Bot (Duel)' : 'Bots'}
                  </button>
                ))}
              </div>
            </div>

            {/* Bot Difficulty Level (1 to 5) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-black text-black uppercase">
                  Bot Difficulty Level
                </label>
                <span
                  className="text-xs font-black px-2.5 py-0.5 rounded-full border border-black text-white shadow-xs"
                  style={{ backgroundColor: BOT_DIFFICULTY_CONFIGS[practiceDifficulty].badgeColor }}
                >
                  {BOT_DIFFICULTY_CONFIGS[practiceDifficulty].name} ({BOT_DIFFICULTY_CONFIGS[practiceDifficulty].nameFa})
                </span>
              </div>

              <div className="grid grid-cols-5 gap-1.5">
                {([1, 2, 3, 4, 5] as BotDifficultyLevel[]).map((lvl) => {
                  const cfg = BOT_DIFFICULTY_CONFIGS[lvl];
                  const isSelected = practiceDifficulty === lvl;

                  return (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => {
                        sound.playComicPop();
                        setPracticeDifficulty(lvl);
                      }}
                      className={`p-2 rounded-xl border-3 border-black font-black text-center transition-all cursor-pointer ${
                        isSelected
                          ? 'text-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                      style={isSelected ? { backgroundColor: cfg.badgeColor } : {}}
                    >
                      <div className="text-sm font-black">L{lvl}</div>
                      <div className="text-[9px] font-bold opacity-90 truncate">{cfg.name.split(' ')[0]}</div>
                    </button>
                  );
                })}
              </div>

              <p className="text-[11px] font-medium text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                ⚡ <strong>AI Strategy:</strong> {BOT_DIFFICULTY_CONFIGS[practiceDifficulty].description}
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowPracticeModal(false)}
                className="flex-1 py-3 bg-slate-100 text-black font-black text-sm rounded-xl border-3 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStartPractice}
                className="flex-1 py-3 bg-[#10B981] hover:bg-emerald-400 text-white font-black text-sm rounded-xl border-3 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] cursor-pointer"
              >
                Start Practice! 🥋
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Join Room Code Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl border-6 border-black p-6 max-w-sm w-full shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black text-black uppercase">Join Match Room</h3>
              <button
                onClick={() => setShowJoinModal(false)}
                className="text-slate-500 hover:text-black font-black text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleJoinSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-black uppercase mb-1">
                  Enter Room Code
                </label>
                <input
                  type="text"
                  autoFocus
                  placeholder="e.g. ABC123"
                  maxLength={10}
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  className="w-full px-4 py-3 bg-[#F3F4F6] text-black font-mono font-bold text-lg tracking-wider rounded-xl border-3 border-black focus:outline-hidden focus:ring-2 focus:ring-[#FFD700] shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] uppercase"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowJoinModal(false)}
                  className="flex-1 py-3 bg-slate-100 text-black font-black text-sm rounded-xl border-3 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!joinCode.trim()}
                  className="flex-1 py-3 bg-[#10B981] hover:bg-emerald-400 text-white font-black text-sm rounded-xl border-3 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] cursor-pointer disabled:opacity-50"
                >
                  Join!
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
