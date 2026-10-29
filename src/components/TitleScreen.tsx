import React from 'react';
import { Play, Trophy, Volume2, HelpCircle, Compass } from 'lucide-react';

interface TitleScreenProps {
  onStartGame: () => void;
  onOpenAchievements: () => void;
  onOpenSettings: () => void;
  unlockedCount: number;
  totalCount: number;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  onStartGame,
  onOpenAchievements,
  onOpenSettings,
  unlockedCount,
  totalCount,
}) => {
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-between p-6 sm:p-10 bg-slate-950/75 backdrop-blur-sm select-none">
      {/* Top Header */}
      <div className="w-full max-w-2xl flex justify-between items-center text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping inline-block" />
          <span className="font-mono uppercase tracking-widest text-slate-300">ROUTE 237 • LIVE</span>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={onOpenAchievements}
            className="hover:text-amber-400 transition flex items-center gap-1.5 cursor-pointer bg-slate-900/60 px-3 py-1 rounded border border-slate-800"
          >
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span>Achievements ({unlockedCount}/{totalCount})</span>
          </button>
          <button
            onClick={onOpenSettings}
            className="hover:text-cyan-400 transition flex items-center gap-1 cursor-pointer bg-slate-900/60 p-1.5 rounded border border-slate-800"
            title="Audio & Display Settings"
          >
            <Volume2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Title Centerpiece */}
      <div className="flex flex-col items-center text-center max-w-lg my-auto">
        <h1 className="text-4xl sm:text-6xl font-black font-pixel tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-slate-100 via-amber-200 to-amber-500 drop-shadow-[0_10px_20px_rgba(245,158,11,0.25)] mb-4">
          BOARD 237
        </h1>

        <p className="text-base sm:text-lg text-slate-300 italic font-serif leading-relaxed mb-8 max-w-md">
          “You have somewhere to be.<br />Your bus may already be coming.”
        </p>

        {/* Start Game Action */}
        <button
          onClick={onStartGame}
          className="group relative px-8 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-lg shadow-xl shadow-emerald-950/50 hover:shadow-emerald-500/30 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer flex items-center gap-3 border border-emerald-400/40"
        >
          <Play className="w-5 h-5 fill-current text-emerald-200 group-hover:scale-110 transition" />
          <span className="font-pixel text-sm tracking-wider">START GAME</span>
        </button>
        <span className="text-[11px] text-slate-500 mt-2 font-mono">Press [SPACE] or [ENTER] to start</span>

        {/* Essential Rules Brief */}
        <div className="mt-8 grid grid-cols-3 gap-2 w-full text-left bg-slate-900/80 border border-slate-800 p-3 rounded-lg text-slate-300 text-xs font-mono">
          <div className="border-r border-slate-800 pr-2">
            <div className="text-amber-400 font-bold mb-1">20 METRES</div>
            <div className="text-[10px] text-slate-400">Distance to shelter.</div>
          </div>
          <div className="border-r border-slate-800 pr-2">
            <div className="text-rose-400 font-bold mb-1">25 SECONDS</div>
            <div className="text-[10px] text-slate-400">Window before bus departs.</div>
          </div>
          <div>
            <div className="text-cyan-400 font-bold mb-1">BUS 237</div>
            <div className="text-[10px] text-slate-400">Check the route number.</div>
          </div>
        </div>
      </div>

      {/* Footer Controls Quick-guide */}
      <div className="w-full max-w-2xl bg-slate-900/70 border border-slate-800/80 rounded-lg p-3 text-xs text-slate-400 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-slate-200 font-semibold flex items-center gap-1">
            <Compass className="w-3.5 h-3.5 text-cyan-400" /> Controls:
          </span>
          <span><kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-300">W</kbd> Walk</span>
          <span><kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-300">Shift</kbd> Sprint (2s)</span>
          <span><kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-300">A / D</kbd> Turn around (1s)</span>
          <span><kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-300">Space</kbd> Board</span>
        </div>
        <div className="text-[10px] text-slate-500">
          Audio enabled on first interaction.
        </div>
      </div>
    </div>
  );
};
