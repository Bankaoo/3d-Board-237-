import React, { useState } from 'react';
import { Achievement } from '../types/game';
import { X, Trophy, CheckCircle2, Lock, RotateCcw, Play } from 'lucide-react';

interface AchievementsModalProps {
  achievements: Achievement[];
  onClose: () => void;
  onResetAchievements?: () => void;
  isPlaying?: boolean;
}

export const AchievementsModal: React.FC<AchievementsModalProps> = ({
  achievements,
  onClose,
  onResetAchievements,
  isPlaying,
}) => {
  const [confirmReset, setConfirmReset] = useState(false);
  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const progressPct = Math.round((unlockedCount / achievements.length) * 100);

  const handleResetClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    if (onResetAchievements) {
      onResetAchievements();
      setConfirmReset(false);
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md select-none font-terminal pointer-events-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-w-xl w-full bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-6 flex flex-col max-h-[90vh] relative"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <Trophy className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold font-pixel text-white">ACHIEVEMENTS</h3>
              <p className="text-xs text-slate-400 font-mono">
                {unlockedCount} of {achievements.length} unlocked ({progressPct}%)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer flex items-center justify-center"
            title="Close"
            aria-label="Close modal"
          >
            <X className="w-5 h-5 pointer-events-none" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mb-5 border border-slate-700">
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-yellow-300 transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Achievement List */}
        <div className="overflow-y-auto space-y-2.5 pr-1 flex-1">
          {achievements.map((ach) => (
            <div
              key={ach.id}
              className={`p-3 rounded-lg border flex items-center justify-between gap-3 transition ${
                ach.unlocked
                  ? 'bg-amber-950/20 border-amber-500/40 text-slate-100'
                  : 'bg-slate-950/40 border-slate-800/80 text-slate-500'
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`text-xl p-1.5 rounded-lg border ${
                    ach.unlocked
                      ? 'bg-amber-500/20 border-amber-500/40'
                      : 'bg-slate-900 border-slate-800 grayscale opacity-40'
                  }`}
                >
                  {ach.unlocked ? ach.icon : '🔒'}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs sm:text-sm font-bold font-mono ${
                        ach.unlocked ? 'text-amber-200' : 'text-slate-400'
                      }`}
                    >
                      {ach.unlocked ? ach.title : '???'}
                    </span>
                    {ach.unlocked && (
                      <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-400 border border-amber-500/40 rounded text-[9px] font-pixel">
                        UNLOCKED
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                    {ach.unlocked ? ach.description : 'Hidden achievement — play to discover.'}
                  </p>
                </div>
              </div>

              <div>
                {ach.unlocked ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ) : (
                  <Lock className="w-4 h-4 text-slate-600" />
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer Actions */}
        <div className="border-t border-slate-800 pt-4 mt-4 flex flex-wrap gap-2 justify-between items-center text-xs text-slate-400 font-mono">
          <button
            type="button"
            onClick={handleResetClick}
            className={`px-3 py-1.5 rounded border transition flex items-center gap-1.5 cursor-pointer text-xs ${
              confirmReset
                ? 'bg-rose-950/80 border-rose-500 text-rose-300 font-bold'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{confirmReset ? 'Confirm Reset?' : 'Reset Achievements'}</span>
          </button>

          <div className="flex items-center gap-2">
            {isPlaying && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded cursor-pointer transition flex items-center gap-1.5 text-xs"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Resume Game</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded cursor-pointer transition text-xs"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
