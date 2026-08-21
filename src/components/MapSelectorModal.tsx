import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MapPin,
  Compass,
  Check,
  X,
  Layers,
  Sparkles,
  Maximize2,
  Users,
  Search,
} from 'lucide-react';
import { ARENAS } from '../game/arenas';
import { getCustomMaps } from '../game/customMaps';
import { Arena, MapSize } from '../types/game';
import { sound } from '../game/audio';

interface MapSelectorModalProps {
  currentMapId: string;
  isHost: boolean;
  onSelectMap: (mapId: string) => void;
  onPreviewMap: (mapId: string) => void;
  onOpenEditor?: (mapId?: string) => void;
  onClose: () => void;
}

export const MapSelectorModal: React.FC<MapSelectorModalProps> = ({
  currentMapId,
  isHost,
  onSelectMap,
  onPreviewMap,
  onOpenEditor,
  onClose,
}) => {
  const [selectedId, setSelectedId] = useState<string>(currentMapId);
  const [sizeFilter, setSizeFilter] = useState<'all' | MapSize>('all');
  const lastClickTimeRef = useRef<{ [key: string]: number }>({});

  const customMaps = getCustomMaps();
  const allArenas = [...Object.values(ARENAS), ...customMaps];
  const filteredArenas = allArenas.filter((a) => {
    if (sizeFilter === 'all') return true;
    return a.size === sizeFilter;
  });

  const handleCardClick = (arenaId: string) => {
    const now = Date.now();
    const lastTime = lastClickTimeRef.current[arenaId] || 0;

    // Double click detection (< 380ms)
    if (now - lastTime < 380) {
      sound.playCountdownBeep(true);
      onClose();
      onPreviewMap(arenaId);
      return;
    }

    lastClickTimeRef.current[arenaId] = now;
    setSelectedId(arenaId);
    sound.playComicPop();

    if (isHost) {
      onSelectMap(arenaId);
    }
  };

  const handlePreviewDirect = (e: React.MouseEvent, arenaId: string) => {
    e.stopPropagation();
    sound.playCountdownBeep(true);
    onPreviewMap(arenaId);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-[#FFFBEB] rounded-3xl border-6 border-black max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]"
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-white border-b-4 border-black space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-[#FFD700] rounded-xl border-3 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <Compass className="w-6 h-6 text-black" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-black uppercase tracking-tight">
                  Battle Map Selector
                </h2>
                <p className="text-xs font-bold text-slate-600">
                  Double-click any map or click 'Explore Solo' to freely roam and inspect the arena.
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                sound.playJump();
                onClose();
              }}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-black rounded-xl border-3 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Size Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {[
              { id: 'all', label: `All Maps (${allArenas.length})` },
              { id: 'small', label: 'Small' },
              { id: 'medium', label: 'Medium' },
              { id: 'large', label: 'Large' },
              { id: 'xlarge', label: '⭐ Extra Large (XL)' },
              { id: 'mystery', label: '🌌 Mystery Maps ⚡' },
              { id: 'custom', label: `🎨 Custom (${customMaps.length})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  sound.playComicPop();
                  setSizeFilter(tab.id as any);
                }}
                className={`px-3 py-1.5 rounded-xl border-2 border-black font-black text-xs transition-all cursor-pointer ${
                  sizeFilter === tab.id
                    ? 'bg-[#FFD700] text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                    : 'bg-white text-slate-700 hover:bg-amber-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Maps Grid Container */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredArenas.map((arena) => {
              const isSelected = selectedId === arena.id;
              const isMystery = arena.size === 'mystery';

              const isCustom = arena.isCustom;

              return (
                <div
                  key={arena.id}
                  id={`map_card_${arena.id}`}
                  onClick={() => handleCardClick(arena.id)}
                  className={`p-4 rounded-2xl border-4 border-black transition-all cursor-pointer select-none flex flex-col justify-between gap-3 relative ${
                    isSelected
                      ? isMystery
                        ? 'bg-gradient-to-br from-indigo-50 to-purple-50 ring-4 ring-purple-600 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]'
                        : isCustom
                        ? 'bg-gradient-to-br from-emerald-50 to-teal-50 ring-4 ring-emerald-500 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]'
                        : 'bg-white ring-4 ring-[#FFD700] shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]'
                      : isMystery
                      ? 'bg-gradient-to-br from-purple-50/90 to-indigo-50/90 hover:from-purple-100 hover:to-indigo-100 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] border-purple-900'
                      : isCustom
                      ? 'bg-gradient-to-br from-emerald-50/90 to-teal-50/90 hover:from-emerald-100 hover:to-teal-100 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] border-emerald-800'
                      : 'bg-white/90 hover:bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
                  }`}
                >
                  {/* Top Bar: Name, Size Badge & Selected Check */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-black text-base sm:text-lg text-black uppercase">
                          {arena.name}
                        </h3>
                        <span
                          className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border border-black shadow-xs ${
                            arena.isCustom
                              ? 'bg-emerald-400 text-black font-black'
                              : arena.size === 'small'
                              ? 'bg-amber-200 text-amber-900'
                              : arena.size === 'medium'
                              ? 'bg-sky-200 text-sky-900'
                              : arena.size === 'large'
                              ? 'bg-purple-200 text-purple-900'
                              : arena.size === 'xlarge'
                              ? 'bg-rose-500 text-white'
                              : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md font-black animate-pulse'
                          }`}
                        >
                          {arena.isCustom ? '🎨 CUSTOM MAP' : arena.size === 'xlarge' ? 'EXTRA LARGE (XL)' : arena.size === 'mystery' ? '🌌 MYSTERY MAP' : arena.size}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-slate-600 mt-1 leading-snug">
                        {arena.description}
                      </p>
                    </div>

                    {isSelected && (
                      <div className="p-1.5 bg-[#10B981] text-white rounded-xl border-2 border-black shrink-0 shadow-xs">
                        <Check className="w-4 h-4" />
                      </div>
                    )}
                  </div>

                  {/* Features & Dimensions */}
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap gap-1.5">
                      {arena.features?.map((feat, fIdx) => (
                        <span
                          key={fIdx}
                          className="text-[10px] font-black bg-[#FFFBEB] text-slate-800 px-2 py-0.5 rounded-lg border border-black/60 shadow-xs"
                        >
                          ⚡ {feat}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 pt-0.5">
                      <span>📐 Size: {arena.width} × {arena.height} px</span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" /> Up to 10 players
                      </span>
                    </div>
                  </div>

                  {/* Bottom Action Footer */}
                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-amber-700">
                      💡 Double-click to explore
                    </span>

                    <div className="flex items-center gap-2">
                      {isCustom && onOpenEditor && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            sound.playJump();
                            onClose();
                            onOpenEditor(arena.id);
                          }}
                          className="px-3 py-1.5 bg-[#F59E0B] hover:bg-amber-400 text-black font-black text-xs rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer flex items-center gap-1"
                        >
                          <span>Edit ✏️</span>
                        </button>
                      )}

                      <button
                        id={`btn_preview_${arena.id}`}
                        onClick={(e) => handlePreviewDirect(e, arena.id)}
                        className="px-3.5 py-1.5 bg-[#3498DB] hover:bg-sky-400 text-white font-black text-xs rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                        <span>Explore Solo 🧭</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Action Footer */}
        <div className="p-4 bg-white border-t-4 border-black flex items-center justify-between gap-3">
          <button
            onClick={() => {
              sound.playJump();
              onClose();
            }}
            className="px-5 py-2.5 bg-slate-100 text-black font-bold text-sm rounded-xl border-3 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-slate-200 cursor-pointer"
          >
            Cancel
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={() => onPreviewMap(selectedId)}
              className="px-5 py-2.5 bg-[#FFD700] hover:bg-[#ffe234] text-black font-black text-sm rounded-xl border-3 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] cursor-pointer flex items-center gap-2"
            >
              <Compass className="w-4 h-4" />
              <span>Explore Selected Map</span>
            </button>

            {isHost && (
              <button
                onClick={() => {
                  sound.playCountdownBeep(true);
                  onSelectMap(selectedId);
                  onClose();
                }}
                className="px-6 py-2.5 bg-[#10B981] hover:bg-emerald-400 text-white font-black text-sm rounded-xl border-3 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] cursor-pointer flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                <span>Confirm Map Choice</span>
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

