import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users,
  Play,
  Copy,
  Check,
  ArrowLeft,
  Settings2,
  Bot,
  MapPin,
  MessageSquare,
  Sparkles,
  Compass,
  Maximize2,
  Lock,
  Crown,
  Send,
  ShieldAlert,
  Clock,
  Swords,
  Trophy,
} from 'lucide-react';
import { Arena, BotDifficultyLevel, FighterCustomization, FighterState, GameMode, RoomState } from '../types/game';
import { ARENAS } from '../game/arenas';
import { sound } from '../game/audio';
import { BOT_DIFFICULTY_CONFIGS } from '../game/botDifficulty';
import { MapSelectorModal } from './MapSelectorModal';

interface LobbyScreenProps {
  room: RoomState;
  myId: string;
  onReadyToggle: (isReady: boolean) => void;
  onStartGame: () => void;
  onUpdateSettings: (settings: {
    mapId?: string;
    mode?: GameMode;
    fillWithBots?: boolean;
    botCount?: number;
    botDifficulty?: BotDifficultyLevel;
    maxPlayers?: number;
    matchDuration?: number;
    duelRoundsTotal?: number;
  }) => void;
  onLeaveRoom: () => void;
  onOpenCustomizer: () => void;
  onPreviewMap: (mapId: string) => void;
  onSendChat: (msg: string) => void;
  chatMessages: { senderName: string; message: string; color: string }[];
}

export const LobbyScreen: React.FC<LobbyScreenProps> = ({
  room,
  myId,
  onReadyToggle,
  onStartGame,
  onUpdateSettings,
  onLeaveRoom,
  onOpenCustomizer,
  onPreviewMap,
  onSendChat,
  chatMessages,
}) => {
  const [copied, setCopied] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  const [customText, setCustomText] = useState('');
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const isHost = room.hostId === myId;
  const me = room.players[myId];
  const isReady = me?.isReady ?? false;
  const currentArena = ARENAS[room.mapId] || ARENAS.park;
  const playersList: FighterState[] = Object.values(room.players) as FighterState[];
  const currentBotCount = typeof room.botCount === 'number' ? room.botCount : 0;
  const ownerPlayer = room.players[room.hostId];
  const ownerName = ownerPlayer?.name || 'Room Owner';

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const handleCopyCode = () => {
    sound.playComicPop();
    navigator.clipboard.writeText(room.roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendCustomChat = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = customText.trim();
    if (!clean) return;
    sound.playComicPop();
    onSendChat(clean);
    setCustomText('');
  };

  const handleSendQuickChat = (msg: string) => {
    sound.playComicPop();
    onSendChat(msg);
  };

  return (
    <div id="lobby_screen_container" className="w-full max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Top Header: Ownership, Code & Status */}
      <div className="bg-white rounded-2xl border-4 border-black p-4 sm:p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <button
            id="btn_leave_lobby"
            onClick={() => {
              sound.playJump();
              onLeaveRoom();
            }}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-black font-bold rounded-xl border-3 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-slate-200 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Leave Room</span>
          </button>

          {/* Room Title & Owner Indicator */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black text-black tracking-tight uppercase">
                {room.roomName || 'Match Waiting Room'}
              </h2>
            </div>
            <div className="flex items-center justify-center gap-2 mt-1 flex-wrap">
              <span className="text-xs font-black uppercase bg-[#FFD700] text-black px-2.5 py-0.5 rounded-full border border-black shadow-xs flex items-center gap-1">
                <Crown className="w-3.5 h-3.5 text-amber-900 fill-amber-900" />
                <span>Room Owner: {ownerName} {isHost ? '(YOU)' : ''}</span>
              </span>
              <span className="text-xs font-black uppercase bg-[#3498DB] text-white px-2.5 py-0.5 rounded-full border border-black shadow-xs">
                Map: {currentArena.name} ({currentArena.size.toUpperCase()})
              </span>
            </div>
          </div>

          {/* Room Code Badge */}
          <div className="flex items-center gap-2">
            <div className="bg-[#FFFBEB] border-3 border-black px-3.5 py-1.5 rounded-xl flex items-center gap-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <span className="text-xs font-black text-amber-800 uppercase">Room Code:</span>
              <span className="font-mono font-black text-base text-black tracking-wider">{room.roomId}</span>
            </div>
            <button
              onClick={handleCopyCode}
              id="btn_copy_room_code"
              title="Copy Room Code"
              className="p-2.5 bg-[#FFD700] text-black rounded-xl border-3 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-[#ffe234] active:scale-95 transition-all cursor-pointer"
            >
              {copied ? <Check className="w-5 h-5 text-emerald-800" /> : <Copy className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Player Cards Grid (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white rounded-2xl border-4 border-black p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users className="w-6 h-6 text-black" />
                <h3 className="text-lg font-black text-black uppercase">
                  Fighters in Room ({playersList.length}/{room.maxPlayers})
                </h3>
              </div>

              <button
                onClick={() => {
                  sound.playJump();
                  onOpenCustomizer();
                }}
                className="px-3.5 py-1.5 bg-[#FFD700] text-black font-black text-xs rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-[#ffe234] transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span>Customize Skin 🎨</span>
              </button>
            </div>

            {/* Players Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {playersList.map((player) => {
                const isThisPlayerMe = player.id === myId;
                const isPlayerHost = player.id === room.hostId;
                const isFighterReady = isPlayerHost || player.isBot || player.isReady;

                return (
                  <div
                    key={player.id}
                    className={`relative p-3.5 rounded-xl border-3 border-black transition-all ${
                      isThisPlayerMe
                        ? 'bg-[#FFFBEB] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ring-2 ring-[#3498DB]'
                        : 'bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
                    }`}
                  >
                    {/* Role Badges */}
                    <div className="absolute top-2 right-2 flex items-center gap-1">
                      {isPlayerHost ? (
                        <span className="bg-[#FFD700] border border-black text-black text-[10px] font-black uppercase px-2 py-0.5 rounded-md shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1">
                          <Crown className="w-3 h-3 text-amber-900 fill-amber-900" />
                          <span>👑 OWNER</span>
                        </span>
                      ) : (
                        <span
                          className={`border border-black text-[10px] font-black uppercase px-2 py-0.5 rounded-md shadow-xs ${
                            player.isReady
                              ? 'bg-[#10B981] text-white'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {player.isReady ? 'READY ✓' : 'NOT READY'}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Character Avatar Icon */}
                      <div
                        className="w-12 h-12 rounded-xl border-3 border-black flex items-center justify-center text-xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] relative shrink-0"
                        style={{ backgroundColor: player.color }}
                      >
                        <span className="text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                          {player.gender === 'female' ? '🌸' : '🥋'}
                        </span>
                        {player.hat !== 'none' && (
                          <span className="absolute -top-2 -right-2 text-xs bg-white rounded-full border border-black p-0.5 shadow-xs">
                            👑
                          </span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0 pr-16">
                        <div className="flex items-center gap-1.5 truncate">
                          <h4 className="font-black text-black truncate text-sm">
                            {player.name}
                          </h4>
                          {isThisPlayerMe && (
                            <span className="text-[9px] font-black text-sky-800 bg-sky-100 px-1.5 py-0.2 rounded border border-sky-300">
                              YOU
                            </span>
                          )}
                          {player.isBot && (
                            <span className="text-[9px] font-black text-purple-800 bg-purple-100 px-1.5 py-0.2 rounded border border-purple-300">
                              BOT
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 mt-1">
                          <span
                            className={`inline-block w-2.5 h-2.5 rounded-full ${
                              isFighterReady
                                ? 'bg-[#10B981] animate-pulse'
                                : 'bg-rose-500'
                            }`}
                          />
                          <span
                            className={`text-[11px] font-bold ${
                              isFighterReady
                                ? 'text-emerald-800 font-black'
                                : 'text-rose-700'
                            }`}
                          >
                            {isPlayerHost
                              ? 'Owner (Auto Ready)'
                              : player.isBot
                              ? 'Bot (Ready)'
                              : player.isReady
                              ? 'Ready to Brawl! ✓'
                              : 'Pending Ready... ⏳'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Empty Slots */}
              {Array.from({ length: Math.max(0, room.maxPlayers - playersList.length) }).map(
                (_, idx) => (
                  <div
                    key={`empty_${idx}`}
                    className="p-3.5 rounded-xl border-3 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center text-slate-400 font-bold text-xs"
                  >
                    <span>Slot {playersList.length + idx + 1}: Open for Player</span>
                  </div>
                )
              )}
            </div>

            {/* Ready / Start Match Button */}
            {(() => {
              const otherHumans = playersList.filter((p) => p.id !== room.hostId && !p.isBot);
              const unreadyHumans = otherHumans.filter((p) => !p.isReady);
              const canHostStart = unreadyHumans.length === 0;

              return (
                <div className="mt-6 pt-4 border-t-2 border-slate-100 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    {isHost ? (
                      <button
                        id="btn_start_match"
                        disabled={!canHostStart}
                        onClick={() => {
                          if (!canHostStart) return;
                          sound.playCountdownBeep(true);
                          onStartGame();
                        }}
                        className={`w-full sm:w-auto px-8 py-4 font-black text-xl rounded-2xl border-4 border-black transition-all flex items-center justify-center gap-3 ${
                          canHostStart
                            ? 'bg-[#10B981] hover:bg-emerald-400 text-white shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-[2px] active:translate-y-[2px] cursor-pointer'
                            : 'bg-slate-200 text-slate-400 border-slate-400 shadow-none cursor-not-allowed'
                        }`}
                      >
                        <Play className={`w-6 h-6 ${canHostStart ? 'fill-white' : 'fill-slate-400'}`} />
                        <span>{canHostStart ? 'START BATTLE (OWNER)' : 'START BATTLE (WAITING READY)'}</span>
                      </button>
                    ) : (
                      <button
                        id="btn_toggle_ready"
                        onClick={() => {
                          sound.playJump();
                          onReadyToggle(!isReady);
                        }}
                        className={`w-full sm:w-auto px-8 py-4 font-black text-xl rounded-2xl border-4 border-black transition-all cursor-pointer flex items-center justify-center gap-3 ${
                          isReady
                            ? 'bg-[#FFD700] hover:bg-[#ffe234] text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                            : 'bg-[#10B981] hover:bg-emerald-400 text-white shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] active:scale-98'
                        }`}
                      >
                        <Check className="w-6 h-6" />
                        <span>{isReady ? 'READY ✓ (CLICK TO CANCEL)' : 'I AM READY!'}</span>
                      </button>
                    )}

                    <div className="text-xs font-bold">
                      {isHost ? (
                        canHostStart ? (
                          <span className="text-emerald-700 font-black flex items-center gap-1">
                            ✅ All active fighters are ready. You can launch the match now!
                          </span>
                        ) : (
                          <span className="text-rose-600 font-black flex items-center gap-1">
                            ⚠️ Waiting for {unreadyHumans.length} player(s) to ready up: {unreadyHumans.map((p) => p.name).join(', ')}
                          </span>
                        )
                      ) : isReady ? (
                        <span className="text-emerald-700 font-black">
                          ✅ You are ready! Waiting for Owner ({ownerName}) to start.
                        </span>
                      ) : (
                        <span className="text-amber-800 font-bold">
                          ⏳ Click "I AM READY!" so the room owner can launch the match.
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Interactive Free Text Match Chat Box */}
          <div className="bg-white rounded-2xl border-4 border-black p-4 sm:p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-black" />
                <h4 className="text-sm font-black text-black uppercase tracking-tight">
                  Lobby Chat & Comic Taunts
                </h4>
              </div>
              <span className="text-[11px] font-bold text-slate-500">
                Live with room players
              </span>
            </div>

            {/* Quick Comic Taunt Pills */}
            <div className="flex flex-wrap gap-1.5">
              {['POW! 💥', "Let's Brawl! 🥋", 'GG! 🏆', 'Nice Stance! 🌸', 'Bring it on! 🔥', 'K.O.! ⚡'].map(
                (taunt) => (
                  <button
                    key={taunt}
                    onClick={() => handleSendQuickChat(taunt)}
                    className="px-2.5 py-1 bg-[#F3F4F6] hover:bg-[#FFD700] text-black font-bold text-xs rounded-xl border border-black shadow-xs transition-all cursor-pointer"
                  >
                    {taunt}
                  </button>
                )
              )}
            </div>

            {/* Chat Messages Stream */}
            <div
              ref={chatScrollRef}
              className="h-32 overflow-y-auto space-y-1.5 bg-[#F9FAFB] p-3 rounded-xl border-2 border-black text-xs"
            >
              {chatMessages.length === 0 ? (
                <div className="text-slate-400 italic text-center py-6 font-medium">
                  No messages yet. Type in the box below to say hello!
                </div>
              ) : (
                chatMessages.map((msg, idx) => (
                  <div key={idx} className="flex items-start gap-1.5 leading-snug">
                    <span className="font-black shrink-0" style={{ color: msg.color }}>
                      {msg.senderName}:
                    </span>
                    <span className="font-bold text-black break-words">{msg.message}</span>
                  </div>
                ))
              )}
            </div>

            {/* Custom Free Text Input Bar */}
            <form onSubmit={handleSendCustomChat} className="flex items-center gap-2">
              <input
                id="input_lobby_chat"
                type="text"
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="Type a message (Press Enter to send)..."
                maxLength={120}
                className="flex-1 bg-white border-2 border-black rounded-xl px-3.5 py-2 text-sm font-bold text-black placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#FFD700] shadow-inner"
              />
              <button
                type="submit"
                id="btn_send_lobby_chat"
                disabled={!customText.trim()}
                className="px-4 py-2 bg-[#FFD700] hover:bg-[#ffe234] disabled:opacity-40 disabled:cursor-not-allowed text-black font-black text-sm rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Send className="w-4 h-4" />
                <span>Send</span>
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Room Settings (Owner-Editable vs Non-Owner Read-Only) */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-2xl border-4 border-black p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-black" />
                <h3 className="text-base font-black text-black uppercase">
                  Room Settings
                </h3>
              </div>

              {!isHost && (
                <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 border border-amber-400 rounded-md text-[10px] font-black text-amber-900">
                  <Lock className="w-3 h-3" />
                  <span>READ ONLY</span>
                </div>
              )}
            </div>

            {!isHost && (
              <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-300 text-xs font-bold text-amber-900 flex items-center gap-2">
                <Lock className="w-4 h-4 shrink-0 text-amber-700" />
                <span>Only <strong>{ownerName}</strong> (Room Owner) can modify settings.</span>
              </div>
            )}

            {/* Active Battle Arena Card */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-black text-black uppercase tracking-wider">
                  Current Map
                </label>
                <button
                  onClick={() => setShowMapModal(true)}
                  className="text-xs font-black text-[#3498DB] hover:underline cursor-pointer flex items-center gap-1"
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span>{isHost ? `Change Map (${Object.keys(ARENAS).length})` : 'Browse & Preview'}</span>
                </button>
              </div>

              <div
                onClick={() => setShowMapModal(true)}
                className="p-3.5 bg-[#FFFBEB] rounded-2xl border-3 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] cursor-pointer hover:bg-amber-100 transition-all space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-black text-sm text-black">{currentArena.name}</span>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-[#FFD700] rounded border border-black shadow-xs">
                    {currentArena.size}
                  </span>
                </div>
                <p className="text-xs font-bold text-slate-600 leading-snug">
                  {currentArena.description}
                </p>
                <div className="flex items-center justify-between pt-1 text-[11px] font-bold">
                  <span className="text-amber-800">⚡ {currentArena.features?.[0] || 'Dynamic Arena'}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      sound.playCountdownBeep(true);
                      onPreviewMap(currentArena.id);
                    }}
                    className="text-[#3498DB] hover:underline font-black flex items-center gap-1"
                  >
                    <Maximize2 className="w-3 h-3" /> Explore Solo
                  </button>
                </div>
              </div>
            </div>

            {/* Game Mode */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-black text-black uppercase tracking-wider">
                  Game Mode
                </label>
                {!isHost && <Lock className="w-3 h-3 text-slate-400" />}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  disabled={!isHost}
                  onClick={() => {
                    sound.playComicPop();
                    onUpdateSettings({ mode: 'duel', maxPlayers: 2 });
                  }}
                  className={`p-2.5 rounded-xl border-2 border-black font-black text-xs text-center transition-all ${
                    room.mode === 'duel'
                      ? 'bg-[#3498DB] text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                      : !isHost
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : 'bg-[#F3F4F6] text-black hover:bg-slate-200 cursor-pointer'
                  }`}
                >
                  1v1 Duel
                </button>

                <button
                  disabled={!isHost}
                  onClick={() => {
                    sound.playComicPop();
                    onUpdateSettings({ mode: 'ffa', maxPlayers: 4 });
                  }}
                  className={`p-2.5 rounded-xl border-2 border-black font-black text-xs text-center transition-all ${
                    room.mode === 'ffa'
                      ? 'bg-[#9B59B6] text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                      : !isHost
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : 'bg-[#F3F4F6] text-black hover:bg-slate-200 cursor-pointer'
                  }`}
                >
                  Free For All (FFA)
                </button>
              </div>
            </div>

            {/* Match Rules: Duration & Rounds */}
            <div className="p-3 bg-amber-50/70 rounded-xl border-2 border-black space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-700" />
                  <span className="text-xs font-black text-black uppercase tracking-wider">
                    Match Rules & Time
                  </span>
                </div>
                {!isHost ? (
                  <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                    <Lock className="w-3 h-3 text-slate-400" /> Host Only
                  </span>
                ) : (
                  <span className="text-[10px] font-black text-amber-700 bg-amber-200/80 px-2 py-0.5 rounded border border-amber-300">
                    Host Control
                  </span>
                )}
              </div>

              {/* Match Duration Selection (For Timed / FFA matches) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-slate-700">
                    Match Duration
                  </span>
                  <span className="text-[11px] font-black text-black">
                    {room.matchDuration === 0
                      ? 'Unlimited (∞)'
                      : `${Math.floor((room.matchDuration || 300) / 60)} Minutes`}
                  </span>
                </div>

                {isHost ? (
                  <div className="space-y-2">
                    {/* Quick Preset Buttons */}
                    <div className="grid grid-cols-4 gap-1">
                      {[
                        { label: '3m', sec: 180 },
                        { label: '5m', sec: 300 },
                        { label: '10m', sec: 600 },
                        { label: '23m', sec: 1380 },
                      ].map((opt) => {
                        const isSelected = (room.matchDuration ?? 300) === opt.sec;
                        return (
                          <button
                            key={opt.sec}
                            type="button"
                            onClick={() => {
                              sound.playComicPop();
                              onUpdateSettings({ matchDuration: opt.sec });
                            }}
                            className={`py-1 px-1 rounded-lg border-2 border-black font-black text-[11px] text-center transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-[#FF6B6B] text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                                : 'bg-white text-black hover:bg-slate-100'
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Direct Custom Numeric Input */}
                    <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-xl border-2 border-black">
                      <span className="text-[10px] font-black text-slate-600 uppercase pl-1">
                        Custom:
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={120}
                        value={room.matchDuration === 0 ? 0 : Math.floor((room.matchDuration || 300) / 60)}
                        onChange={(e) => {
                          if (e.target.value === '') {
                            onUpdateSettings({ matchDuration: 0 });
                            return;
                          }
                          const val = parseInt(e.target.value, 10);
                          if (!isNaN(val) && val >= 0 && val <= 120) {
                            onUpdateSettings({ matchDuration: val * 60 });
                          }
                        }}
                        className="w-16 bg-amber-50 font-mono font-black text-xs text-center py-1 rounded-lg border border-black focus:outline-hidden"
                      />
                      <span className="text-[11px] font-bold text-black">
                        Min (0 = ∞)
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          sound.playComicPop();
                          onUpdateSettings({ matchDuration: 0 });
                        }}
                        className={`ml-auto px-2 py-0.5 rounded-lg border border-black font-black text-[10px] ${
                          room.matchDuration === 0
                            ? 'bg-[#FFD700] text-black'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        ∞ Unlimited
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-2 bg-white rounded-xl border border-slate-300 font-black text-xs text-slate-700 flex items-center justify-between">
                    <span>{room.matchDuration === 0 ? 'Unlimited (∞)' : `${Math.floor((room.matchDuration || 300) / 60)} Minutes`}</span>
                    <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Owner setting
                    </span>
                  </div>
                )}
              </div>

              {/* Duel Mode Total Rounds */}
              {room.mode === 'duel' && (
                <div className="pt-2 border-t border-amber-200">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                      <Swords className="w-3.5 h-3.5 text-amber-700" /> Duel Rounds
                    </span>
                    <span className="text-[11px] font-black text-black">
                      {room.duelRoundsTotal || 5} Rounds Total
                    </span>
                  </div>

                  {isHost ? (
                    <div className="space-y-2">
                      {/* Quick Presets */}
                      <div className="flex gap-1">
                        {[1, 3, 5, 10, 37].map((rCount) => {
                          const isSelected = (room.duelRoundsTotal ?? 5) === rCount;
                          return (
                            <button
                              key={rCount}
                              type="button"
                              onClick={() => {
                                sound.playComicPop();
                                onUpdateSettings({ duelRoundsTotal: rCount });
                              }}
                              className={`flex-1 py-1 rounded-lg border-2 border-black font-black text-[11px] text-center transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-[#4ECDC4] text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                                  : 'bg-white text-black hover:bg-slate-100'
                              }`}
                            >
                              {rCount}R
                            </button>
                          );
                        })}
                      </div>

                      {/* Direct Custom Numeric Rounds Input */}
                      <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-xl border-2 border-black">
                        <span className="text-[10px] font-black text-slate-600 uppercase pl-1">
                          Custom Rounds:
                        </span>
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={room.duelRoundsTotal || 5}
                          onChange={(e) => {
                            if (e.target.value === '') {
                              // We use 1 as a fallback for empty state to allow clearing
                              // Without it, the user can't backspace the last digit if it's controlled.
                              onUpdateSettings({ duelRoundsTotal: 1 });
                              return;
                            }
                            const val = parseInt(e.target.value, 10);
                            if (!isNaN(val) && val >= 1 && val <= 100) {
                              onUpdateSettings({ duelRoundsTotal: val });
                            }
                          }}
                          className="w-16 bg-amber-50 font-mono font-black text-xs text-center py-1 rounded-lg border border-black focus:outline-hidden"
                        />
                        <span className="text-[11px] font-bold text-black">
                          Rounds (1 - 100)
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-2 bg-white rounded-xl border border-slate-300 font-black text-xs text-slate-700 flex items-center justify-between">
                      <span>{room.duelRoundsTotal || 5} Rounds</span>
                      <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Owner setting
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Max Players Limit (Up to 10) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-black text-black uppercase tracking-wider">
                  Max Capacity ({room.maxPlayers} Fighters)
                </label>
                {!isHost && <Lock className="w-3 h-3 text-slate-400" />}
              </div>
              <div className="flex gap-1.5">
                {[2, 4, 6, 8, 10].map((num) => (
                  <button
                    key={num}
                    disabled={!isHost}
                    onClick={() => {
                      sound.playComicPop();
                      onUpdateSettings({ maxPlayers: num });
                    }}
                    className={`flex-1 py-1.5 rounded-xl border-2 border-black font-black text-xs text-center transition-all ${
                      room.maxPlayers === num
                        ? 'bg-[#FFD700] text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                        : !isHost
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : 'bg-[#F3F4F6] text-black hover:bg-slate-200 cursor-pointer'
                    }`}
                  >
                    {num}P
                  </button>
                ))}
              </div>
            </div>

            {/* Optional AI Bots Setting */}
            <div className="pt-2 border-t-2 border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bot className="w-5 h-5 text-purple-700" />
                  <span className="text-xs font-black text-black">AI Bots (Optional)</span>
                </div>
                <span className="text-xs font-black text-purple-800 bg-purple-100 px-2 py-0.5 rounded border border-purple-300">
                  {currentBotCount === 0 ? '0 Bots (Off)' : `${currentBotCount} Bots`}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {[0, 1, 2, 3, 4].map((count) => (
                  <button
                    key={count}
                    disabled={!isHost}
                    onClick={() => {
                      sound.playComicPop();
                      onUpdateSettings({ botCount: count, fillWithBots: count > 0 });
                    }}
                    className={`flex-1 py-1 rounded-lg border-2 border-black font-black text-xs transition-all ${
                      currentBotCount === count
                        ? 'bg-purple-600 text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                        : !isHost
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : 'bg-[#F3F4F6] text-black hover:bg-slate-200 cursor-pointer'
                    }`}
                  >
                    {count === 0 ? '0' : `${count}`}
                  </button>
                ))}
              </div>

              {/* Bot Difficulty Level Selector (1 to 5) */}
              {currentBotCount > 0 && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-slate-700 uppercase tracking-tight">
                      Bot Difficulty
                    </span>
                    <span
                      className="text-[10px] font-black px-2 py-0.5 rounded-full border border-black text-white shadow-xs"
                      style={{ backgroundColor: BOT_DIFFICULTY_CONFIGS[room.botDifficulty || 3].badgeColor }}
                    >
                      {BOT_DIFFICULTY_CONFIGS[room.botDifficulty || 3].name} ({BOT_DIFFICULTY_CONFIGS[room.botDifficulty || 3].nameFa})
                    </span>
                  </div>

                  <div className="grid grid-cols-5 gap-1">
                    {([1, 2, 3, 4, 5] as BotDifficultyLevel[]).map((lvl) => {
                      const cfg = BOT_DIFFICULTY_CONFIGS[lvl];
                      const isSelected = (room.botDifficulty || 3) === lvl;

                      return (
                        <button
                          key={lvl}
                          disabled={!isHost}
                          onClick={() => {
                            sound.playComicPop();
                            onUpdateSettings({ botDifficulty: lvl });
                          }}
                          title={`${cfg.name} - Reaction: ${cfg.reactionTimeMinMs}-${cfg.reactionTimeMaxMs}ms`}
                          className={`py-1 px-0.5 rounded-lg border-2 border-black font-black text-[10px] text-center transition-all cursor-pointer ${
                            isSelected
                              ? 'text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                              : !isHost
                              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                              : 'bg-white text-slate-700 hover:bg-slate-100'
                          }`}
                          style={isSelected ? { backgroundColor: cfg.badgeColor } : {}}
                        >
                          <div>L{lvl}</div>
                          <div className="text-[8px] opacity-90 truncate">{cfg.name.split(' ')[0]}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <p className="text-[10px] font-bold text-slate-500">
                Default is 0 bots. Difficulty levels are balanced fairly without cheats or unfair stats.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Map Selection Modal */}
      {showMapModal && (
        <MapSelectorModal
          currentMapId={room.mapId}
          isHost={isHost}
          onSelectMap={(mapId) => {
            onUpdateSettings({ mapId });
          }}
          onPreviewMap={(mapId) => {
            setShowMapModal(false);
            onPreviewMap(mapId);
          }}
          onClose={() => setShowMapModal(false)}
        />
      )}
    </div>
  );
};

