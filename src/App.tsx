import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  BotDifficultyLevel,
  FighterCustomization,
  GameMode,
  PlayerInput,
  RoomState,
  ServerMessage,
  ComicPop,
} from './types/game';
import { network } from './game/network';
import { LocalGameEngine } from './game/localEngine';
import { sound } from './game/audio';
import { HomeScreen } from './components/HomeScreen';
import { CharacterStudio } from './components/CharacterStudio';
import { LobbyScreen } from './components/LobbyScreen';
import { GameCanvasView } from './components/GameCanvasView';
import { SettingsModal } from './components/SettingsModal';

const STORAGE_KEY = 'stick_fighters_player_v1';

const DEFAULT_CUSTOMIZATION: FighterCustomization = {
  name: 'Tintin Fighter',
  gender: 'male',
  color: '#2563EB',
  hat: 'cap',
};

export default function App() {
  const [view, setView] = useState<'home' | 'studio' | 'lobby' | 'game'>('home');
  const [previousView, setPreviousView] = useState<'home' | 'lobby'>('home');
  const [customization, setCustomization] = useState<FighterCustomization>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      // ignore
    }
    return DEFAULT_CUSTOMIZATION;
  });

  const [room, setRoom] = useState<RoomState | null>(null);
  const [myId, setMyId] = useState<string>('local_player');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isLocalMode, setIsLocalMode] = useState<boolean>(false);
  const [isPreviewMode, setIsPreviewMode] = useState<boolean>(false);
  const [comicPops, setComicPops] = useState<ComicPop[]>([]);
  const [chatMessages, setChatMessages] = useState<{ senderName: string; message: string; color: string }[]>([]);
  const [showSettings, setShowSettings] = useState<boolean>(false);

  const savedLobbyRoomRef = useRef<RoomState | null>(null);
  const savedLobbyMyIdRef = useRef<string>('');
  const localEngineRef = useRef<LocalGameEngine | null>(null);
  const localInputRef = useRef<PlayerInput>({
    left: false,
    right: false,
    up: false,
    down: false,
    fastAttack: false,
    heavyAttack: false,
    block: false,
  });

  // Save customization changes to localStorage
  const handleSaveCustomization = (cust: FighterCustomization) => {
    setCustomization(cust);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cust));
    } catch (e) {
      // ignore
    }
    network.send({ type: 'update_customization', customization: cust });
  };

  // Context-aware Background Music Track Transitions
  useEffect(() => {
    if (view === 'home') {
      sound.playTrack('menu');
    } else if (view === 'studio') {
      sound.playTrack('studio');
    } else if (view === 'lobby') {
      sound.playTrack('lobby');
    } else if (view === 'game') {
      if (isPreviewMode) {
        sound.playTrack('map_preview');
      } else {
        sound.playTrack('battle');
      }
    }
  }, [view, isPreviewMode]);

  // First interaction unlock for browser Web Audio policy
  useEffect(() => {
    const handleFirstInteraction = () => {
      sound.unlockAudio();
    };

    window.addEventListener('click', handleFirstInteraction, { once: true });
    window.addEventListener('keydown', handleFirstInteraction, { once: true });
    window.addEventListener('touchstart', handleFirstInteraction, { once: true });

    return () => {
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
    };
  }, []);

  // Setup WebSocket Listeners
  useEffect(() => {
    const unsub = network.onMessage((msg: ServerMessage) => {
      setIsConnected(true);

      switch (msg.type) {
        case 'room_joined':
          setIsLocalMode(false);
          setIsPreviewMode(false);
          setMyId(msg.yourId);
          setRoom(msg.room);
          if (msg.room.status === 'in_game' || msg.room.status === 'countdown') {
            setView('game');
          } else {
            setView('lobby');
          }
          break;

        case 'room_state':
          if (isPreviewMode) {
            savedLobbyRoomRef.current = msg.room;
          } else {
            setRoom(msg.room);
            if (msg.room.status === 'in_game' || msg.room.status === 'countdown') {
              setView('game');
            } else if (msg.room.status === 'lobby' && view === 'game' && !isLocalMode) {
              setView('lobby');
            }
          }
          break;

        case 'game_tick':
          setRoom(msg.room);
          if (msg.room.status === 'in_game' || msg.room.status === 'countdown' || msg.room.status === 'round_end') {
            if (view !== 'game' && !isPreviewMode) setView('game');
          }
          break;

        case 'weapon_pickup_event':
          sound.playWeaponPickup();
          break;

        case 'weapon_fire_event':
          sound.playWeaponFire(msg.weaponType);
          window.dispatchEvent(new CustomEvent('sf_weapon_fire', { detail: msg }));
          break;

        case 'explosion_event':
          sound.playExplosion();
          break;

        case 'hit_event':
          if (msg.isHeavy) {
            sound.playHeavyHit();
          } else {
            sound.playFastPunch();
          }

          // Spawn visual comic pop
          setComicPops((prev) => [
            ...prev.slice(-10),
            {
              id: 'pop_' + Math.random(),
              text: msg.popText,
              x: msg.x,
              y: msg.y,
              color: msg.isHeavy ? '#EF4444' : '#F59E0B',
              bgHex: '#FEF08A',
              size: msg.isHeavy ? 28 : 22,
              rotation: (Math.random() - 0.5) * 0.4,
              createdAt: Date.now(),
              duration: 700,
            },
          ]);
          break;

        case 'chat_broadcast':
          setChatMessages((prev) => [
            ...prev,
            { senderName: msg.senderName, message: msg.message, color: msg.color },
          ]);
          break;

        case 'game_over':
          setRoom(msg.room);
          break;

        case 'error':
          alert(msg.message);
          break;
      }
    });

    return () => {
      unsub();
    };
  }, [view, isPreviewMode, isLocalMode]);

  // Local engine game loop (for Solo Practice vs Bots & Map Preview Mode)
  useEffect(() => {
    if (!isLocalMode || view !== 'game' || !localEngineRef.current) return;

    let animId: number;

    const tickLocal = () => {
      if (localEngineRef.current) {
        const { room: nextRoom, hits, pops } = localEngineRef.current.tick(localInputRef.current);
        setRoom({ ...nextRoom });
        setComicPops([...pops]);

        for (const hit of hits) {
          if (hit.blocked) {
            sound.playShieldBlock();
          } else if (hit.isHeavy) {
            sound.playHeavyHit();
          } else {
            sound.playFastPunch();
          }
        }
      }
      animId = requestAnimationFrame(tickLocal);
    };

    animId = requestAnimationFrame(tickLocal);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [isLocalMode, view]);

  // Handlers
  const handleQuickMatch = (mode: GameMode) => {
    setIsLocalMode(false);
    setIsPreviewMode(false);
    network.quickMatch(customization, mode);
  };

  const handleCreateRoom = () => {
    setIsLocalMode(false);
    setIsPreviewMode(false);
    network.createRoom(customization, 'duel', 'park', false, 2, 0);
  };

  const handleJoinRoom = (roomId: string) => {
    setIsLocalMode(false);
    setIsPreviewMode(false);
    network.joinRoom(roomId, customization);
  };

  const handlePracticeBots = (botCount: number = 1, botDifficulty: BotDifficultyLevel = 3) => {
    setIsLocalMode(true);
    setIsPreviewMode(false);
    setPreviousView('home');
    setMyId('local_player');
    const engine = new LocalGameEngine(customization, 'duel', 'park', botCount, botDifficulty);
    localEngineRef.current = engine;
    setRoom(engine.room);
    setView('game');
  };

  const handlePreviewMap = (mapId: string) => {
    const fromLobby = view === 'lobby' || (previousView === 'lobby' && !!room && !room.roomId.startsWith('local'));
    if (fromLobby && room && !room.roomId.startsWith('local')) {
      savedLobbyRoomRef.current = room;
      savedLobbyMyIdRef.current = myId;
      setPreviousView('lobby');
    } else {
      setPreviousView('home');
    }
    setIsLocalMode(true);
    setIsPreviewMode(true);
    setMyId('local_player');
    // Bot count 0 for peaceful single-player map exploration
    const engine = new LocalGameEngine(customization, 'duel', mapId, 0);
    localEngineRef.current = engine;
    setRoom(engine.room);
    setView('game');
  };

  const handleSendInput = (input: PlayerInput) => {
    if (isLocalMode) {
      localInputRef.current = input;
    } else {
      network.sendInput(input);
    }
  };

  const handleReadyToggle = (isReady: boolean) => {
    network.setReady(isReady);
  };

  const handleStartGame = () => {
    network.startGame();
  };

  const handleUpdateRoomSettings = (settings: any) => {
    network.send({
      type: 'update_room_settings',
      ...settings,
    });
  };

  const handleLeaveRoom = () => {
    localEngineRef.current = null;
    savedLobbyRoomRef.current = null;
    savedLobbyMyIdRef.current = '';
    setIsLocalMode(false);
    setIsPreviewMode(false);
    if (!isLocalMode) {
      network.leaveRoom();
    }
    setRoom(null);
    setView('home');
  };

  const handleRestartMatch = () => {
    if (isLocalMode && localEngineRef.current) {
      localEngineRef.current.restart(customization);
      setRoom({ ...localEngineRef.current.room });
    } else {
      network.restartMatch();
    }
  };

  const handleSendChat = (message: string) => {
    network.sendChat(message);
  };

  const handleReturnFromGame = () => {
    if (isPreviewMode) {
      localEngineRef.current = null;
      setIsPreviewMode(false);
      if (previousView === 'lobby' && savedLobbyRoomRef.current) {
        setRoom(savedLobbyRoomRef.current);
        setMyId(savedLobbyMyIdRef.current);
        setIsLocalMode(false);
        setView('lobby');
      } else {
        setIsLocalMode(false);
        setRoom(null);
        setView('home');
      }
    } else if (isLocalMode) {
      localEngineRef.current = null;
      setIsLocalMode(false);
      setRoom(null);
      setView('home');
    } else {
      network.returnToLobby();
      setView('lobby');
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFBEB] text-black flex flex-col justify-between selection:bg-[#FFD700] font-sans">
      {/* Background Comic Halftone Texture Effect */}
      <div
        className="fixed inset-0 pointer-events-none opacity-10"
        style={{
          backgroundImage: 'radial-gradient(#000 1px, transparent 0)',
          backgroundSize: '20px 20px',
        }}
      />

      {/* Main View Router */}
      <main className={`relative z-10 flex-1 flex flex-col justify-center ${view === 'game' ? 'p-0 w-full h-full' : 'py-2 sm:py-4'}`}>
        <AnimatePresence mode="wait">
          {view === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
            >
              <HomeScreen
                customization={customization}
                isConnected={network.isConnected}
                onQuickMatch={handleQuickMatch}
                onCreateRoom={handleCreateRoom}
                onJoinRoom={handleJoinRoom}
                onPracticeBots={() => handlePracticeBots(1)}
                onOpenCustomizer={() => {
                  sound.playJump();
                  setPreviousView('home');
                  setView('studio');
                }}
                onOpenSettings={() => setShowSettings(true)}
              />
            </motion.div>
          )}

          {view === 'studio' && (
            <motion.div
              key="studio"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              <CharacterStudio
                customization={customization}
                previousView={previousView}
                onSave={handleSaveCustomization}
                onBack={() => {
                  if (previousView === 'lobby' && room) {
                    setView('lobby');
                  } else {
                    setView('home');
                  }
                }}
              />
            </motion.div>
          )}

          {view === 'lobby' && room && (
            <motion.div
              key="lobby"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              <LobbyScreen
                room={room}
                myId={myId}
                onReadyToggle={handleReadyToggle}
                onStartGame={handleStartGame}
                onUpdateSettings={handleUpdateRoomSettings}
                onLeaveRoom={handleLeaveRoom}
                onOpenCustomizer={() => {
                  sound.playJump();
                  setPreviousView('lobby');
                  setView('studio');
                }}
                onPreviewMap={handlePreviewMap}
                onSendChat={handleSendChat}
                chatMessages={chatMessages}
              />
            </motion.div>
          )}

          {view === 'game' && room && (
            <motion.div
              key="game"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 w-screen h-screen overflow-hidden z-50 bg-slate-950"
            >
              <GameCanvasView
                room={room}
                myId={myId}
                comicPops={comicPops}
                isPreviewMode={isPreviewMode}
                onSendInput={handleSendInput}
                onRestartMatch={handleRestartMatch}
                onReturnToLobby={handleReturnFromGame}
                onReadyToggle={handleReadyToggle}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Settings Modal */}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}

      {/* Comic Footer (Visible on Home, Studio, Lobby) */}
      {view !== 'game' && (
        <footer className="relative z-10 text-center py-2 text-xs font-bold text-black flex flex-wrap items-center justify-between max-w-5xl w-full mx-auto px-4 gap-3">
          <div className="flex items-center space-x-2">
            <span className="bg-black text-white px-2 py-0.5 text-[11px] font-black uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              STICK FIGHTERS
            </span>
            <span className="opacity-70 font-semibold italic">Natural Tones Edition • Ligne Claire Style</span>
          </div>
          <div className="flex items-center space-x-4 text-xs font-black uppercase">
            <span className="text-emerald-700">● MULTIPLAYER ENGINE READY</span>
            <span className="text-slate-500">MAX 10 PLAYERS</span>
          </div>
        </footer>
      )}
    </div>
  );
}
