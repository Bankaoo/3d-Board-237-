import React from 'react';
import { GameOverReason, GameRunStats, Achievement } from '../types/game';
import { RotateCcw, Trophy, CheckCircle, XCircle, ArrowRight } from 'lucide-react';

interface GameOverModalProps {
  reason: GameOverReason | null;
  stats: GameRunStats;
  achievements: Achievement[];
  onRestart: () => void;
  onOpenAchievements: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  reason,
  stats,
  achievements,
  onRestart,
  onOpenAchievements,
}) => {
  // Config for different outcomes
  const getOutcomeDetails = () => {
    switch (reason) {
      case 'SUCCESS_237':
        return {
          title: 'MADE IT!',
          subtitle: 'You stepped onto Bus 237 just before the doors folded shut.',
          badge: 'VICTORY',
          color: 'emerald',
          icon: '🚌',
        };
      case 'PATIENCE_BOARDED':
        return {
          title: 'PATIENCE PAYS!',
          subtitle: 'The driver pulled over right beside you. Sometimes standing still works.',
          badge: 'UNCONVENTIONAL SUCCESS',
          color: 'teal',
          icon: '🧘',
        };
      case 'IMPOSTER':
        return {
          title: 'IMPOSTER BUS!',
          subtitle: 'You hopped onto Bus 842. Next stop: Industrial Chemical Docks.',
          badge: 'WRONG BUS',
          color: 'rose',
          icon: '🛑',
        };
      case 'ALMOST_MISSED':
        return {
          title: 'SO CLOSE!',
          subtitle: 'The doors slammed in your face with a blast of air brakes. Heartbreak in the rain.',
          badge: 'NEAR MISS',
          color: 'amber',
          icon: '💨',
        };
      case 'SUPER_FATIGUE':
        return {
          title: 'COLLAPSED FROM EXHAUSTION!',
          subtitle: 'Three sprints took everything out of you. Your legs gave out in the cold rain.',
          badge: 'EXHAUSTED',
          color: 'rose',
          icon: '🏃',
        };
      case 'TOO_PATIENT':
        return {
          title: 'TOO PATIENT!',
          subtitle: 'You watched in silence as the tail lights disappeared into the dark.',
          badge: 'STRANDED',
          color: 'indigo',
          icon: '🌧️',
        };
      case 'TIME_EXPIRED':
      case 'MISSED_BUS':
      default:
        return {
          title: 'MISSED THE BUS!',
          subtitle: 'The time window closed. The street is cold, empty, and dark.',
          badge: 'OUT OF TIME',
          color: 'slate',
          icon: '⏳',
        };
    }
  };

  const outcome = getOutcomeDetails();
  const isSuccess = reason === 'SUCCESS_237' || reason === 'PATIENCE_BOARDED';

  // Recently unlocked achievements
  const recentUnlocked = achievements.filter((a) => a.unlocked);

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md select-none">
      <div className="max-w-md w-full bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl p-6 flex flex-col items-center text-center animate-scale-in">
        {/* Outcome Header Badge */}
        <div className={`text-4xl mb-2`}>{outcome.icon}</div>
        <div className={`px-2.5 py-0.5 rounded-full text-[10px] font-pixel uppercase tracking-widest mb-2 ${
          isSuccess ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
        }`}>
          {outcome.badge}
        </div>

        <h2 className="text-2xl sm:text-3xl font-black font-pixel text-white mb-2 tracking-tight">
          {outcome.title}
        </h2>
        <p className="text-xs sm:text-sm text-slate-300 font-mono mb-6">
          {outcome.subtitle}
        </p>

        {/* Run Stats Grid */}
        <div className="w-full bg-slate-950/60 border border-slate-800 rounded-lg p-3 grid grid-cols-3 gap-2 text-xs font-mono mb-6">
          <div className="border-r border-slate-800 pr-1">
            <div className="text-[10px] text-slate-400">Time Taken</div>
            <div className="text-amber-300 font-bold">{stats.elapsedTime.toFixed(1)}s</div>
          </div>
          <div className="border-r border-slate-800 pr-1">
            <div className="text-[10px] text-slate-400">Distance</div>
            <div className="text-cyan-300 font-bold">{stats.distanceCovered.toFixed(1)}m / 20m</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-400">Sprints Used</div>
            <div className="text-emerald-300 font-bold">{stats.sprintsUsed}</div>
          </div>
        </div>

        {/* Unlocked Achievements in this attempt */}
        <div className="w-full mb-6 text-left">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[11px] uppercase tracking-wider font-mono text-slate-400 flex items-center gap-1">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              Achievements ({recentUnlocked.length}/{achievements.length})
            </span>
            <button
              onClick={onOpenAchievements}
              className="text-[10px] text-cyan-400 hover:text-cyan-300 transition cursor-pointer flex items-center gap-0.5"
            >
              <span>View All</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {achievements.slice(0, 4).map((ach) => (
              <div
                key={ach.id}
                className={`p-2 rounded border text-left flex items-center gap-2 ${
                  ach.unlocked
                    ? 'bg-amber-950/30 border-amber-500/40 text-amber-200'
                    : 'bg-slate-950/40 border-slate-800 text-slate-600'
                }`}
              >
                <span className="text-lg">{ach.icon}</span>
                <div className="truncate">
                  <div className="text-[11px] font-bold truncate">{ach.title}</div>
                  <div className="text-[9px] text-slate-400 truncate">{ach.unlocked ? 'Unlocked' : 'Locked'}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <button
            onClick={onRestart}
            className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-lg shadow-emerald-950/50 transition flex items-center justify-center gap-2 cursor-pointer font-pixel text-xs tracking-wider border border-emerald-400/40"
          >
            <RotateCcw className="w-4 h-4" />
            <span>TRY AGAIN [R]</span>
          </button>
        </div>
      </div>
    </div>
  );
};
