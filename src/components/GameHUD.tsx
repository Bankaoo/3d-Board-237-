import React from 'react';
import { Achievement, BusEntity, MovementState, PlayerState } from '../types/game';
import { Clock, Footprints, Wind, Eye, CheckCircle2, AlertTriangle } from 'lucide-react';

interface GameHUDProps {
  timeRemaining: number;
  player: PlayerState;
  buses: BusEntity[];
  feedbackMessage: string | null;
  newAchievement: Achievement | null;
  onClearAchievement: () => void;
  onOpenSettings: () => void;
  onOpenAchievements: () => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  timeRemaining,
  player,
  buses,
  feedbackMessage,
  newAchievement,
  onClearAchievement,
  onOpenSettings,
  onOpenAchievements,
}) => {
  // Check if player is near open bus doors
  let nearbyBus: BusEntity | null = null;
  for (const b of buses) {
    const doorZ = b.z + 1.2;
    if (Math.abs(player.z - doorZ) < 2.8 && (b.doorsOpen || b.doorsProgress > 0.2)) {
      nearbyBus = b;
      break;
    }
  }

  // Calculate distance to destination (20m)
  const distRemaining = Math.max(0, 20.0 - player.z);

  // Time percentage
  const timePct = Math.max(0, Math.min(100, (timeRemaining / 25.0) * 100));

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-3 sm:p-5 select-none font-terminal">
      {/* Top Status Bar */}
      <div className="flex items-start justify-between w-full gap-2">
        {/* Time Remaining Counter */}
        <div className="bg-slate-950/80 backdrop-blur-md border border-slate-700/60 rounded px-3 py-1.5 shadow-lg flex items-center gap-3">
          <Clock className={`w-4 h-4 ${timeRemaining < 3 ? 'text-rose-400 animate-pulse' : 'text-amber-400'}`} />
          <div>
            <div className="text-[10px] text-slate-400 uppercase tracking-widest font-mono">Time Left</div>
            <div className={`text-base sm:text-lg font-bold font-mono tracking-wider ${timeRemaining < 3 ? 'text-rose-400 font-pixel text-sm' : 'text-amber-300'}`}>
              {timeRemaining.toFixed(1)}s
            </div>
          </div>
          {/* Circular or bar progress */}
          <div className="w-16 h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
            <div
              className={`h-full transition-all duration-100 ${timeRemaining < 3 ? 'bg-rose-500' : 'bg-amber-400'}`}
              style={{ width: `${timePct}%` }}
            />
          </div>
        </div>

        {/* Distance to Shelter & Facing */}
        <div className="bg-slate-950/80 backdrop-blur-md border border-slate-700/60 rounded px-3 py-1.5 shadow-lg flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Footprints className="w-4 h-4 text-emerald-400" />
            <div>
              <div className="text-[10px] text-slate-400 uppercase tracking-widest font-mono">To Shelter</div>
              <div className="text-base font-bold text-emerald-300 font-mono">
                {distRemaining.toFixed(1)}m
              </div>
            </div>
          </div>

          <div className="h-6 w-px bg-slate-800" />

          <div className="flex items-center gap-2">
            <Eye className={`w-4 h-4 ${player.facing === 'REAR' ? 'text-amber-400' : 'text-cyan-400'}`} />
            <div>
              <div className="text-[10px] text-slate-400 uppercase tracking-widest font-mono">Facing</div>
              <div className="text-xs font-semibold text-slate-200">
                {player.turningTimer > 0 ? 'TURNING...' : player.facing === 'FORWARD' ? 'FORWARD (STOP)' : 'BEHIND (ROAD)'}
              </div>
            </div>
          </div>
        </div>

        {/* Top-Right Mini Buttons */}
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            onClick={onOpenAchievements}
            className="bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-amber-300 px-2.5 py-1.5 rounded border border-slate-700/80 text-xs transition cursor-pointer flex items-center gap-1.5 shadow"
            title="View Achievements"
          >
            <span>🏆</span>
            <span className="hidden sm:inline">Achievements</span>
          </button>
          <button
            onClick={onOpenSettings}
            className="bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 px-2.5 py-1.5 rounded border border-slate-700/80 text-xs transition cursor-pointer shadow"
            title="Settings & Audio"
          >
            ⚙️
          </button>
        </div>
      </div>

      {/* Center: Interactive Boarding Alert or Feedback Toast */}
      <div className="flex flex-col items-center justify-center gap-2 my-auto">
        {nearbyBus && (
          <div className="pointer-events-auto animate-bounce bg-emerald-950/90 border-2 border-emerald-400 text-emerald-200 px-6 py-2.5 rounded-lg shadow-2xl flex items-center gap-3 backdrop-blur-md">
            <span className="text-2xl">🚌</span>
            <div>
              <div className="text-xs font-pixel text-emerald-400">DOORS OPEN!</div>
              <div className="text-sm font-bold text-white tracking-wide">
                PRESS <span className="px-2 py-0.5 bg-emerald-500 text-slate-950 rounded font-pixel text-xs mx-1">SPACE</span> TO BOARD {nearbyBus.routeNumber}
              </div>
            </div>
          </div>
        )}

        {feedbackMessage && (
          <div className="bg-slate-950/90 border border-slate-700/80 text-amber-200 px-4 py-2 rounded-md shadow-xl text-xs sm:text-sm font-semibold tracking-wide backdrop-blur-md flex items-center gap-2 animate-fade-in">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>{feedbackMessage}</span>
          </div>
        )}
      </div>

      {/* Bottom Status / Fatigue Meter & Control Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between w-full gap-3">
        {/* Fatigue & Movement Status */}
        <div className="bg-slate-950/85 backdrop-blur-md border border-slate-700/70 rounded-md px-3 py-2 shadow-lg flex items-center gap-4 w-full sm:w-auto">
          <div className="flex items-center gap-2">
            <Wind className={`w-4 h-4 ${player.isSuperFatigued ? 'text-rose-500 animate-pulse' : player.fatigueTimer > 0 ? 'text-amber-400' : 'text-cyan-400'}`} />
            <div>
              <div className="text-[10px] text-slate-400 uppercase tracking-widest font-mono">Stamina State</div>
              <div className={`text-xs font-bold ${
                player.isSuperFatigued
                  ? 'text-rose-400 font-pixel text-[10px]'
                  : player.fatigueTimer > 0
                  ? 'text-amber-300'
                  : player.movementState === 'SPRINTING'
                  ? 'text-cyan-300 font-bold'
                  : 'text-slate-300'
              }`}>
                {player.isSuperFatigued
                  ? `SUPER-FATIGUE (${player.fatigueTimer.toFixed(1)}s)`
                  : player.fatigueTimer > 0
                  ? `FATIGUED (${player.fatigueTimer.toFixed(1)}s)`
                  : player.movementState === 'SPRINTING'
                  ? `SPRINTING (${player.sprintTimer.toFixed(1)}s)`
                  : 'NORMAL'}
              </div>
            </div>
          </div>

          {/* Sprints used gauge */}
          <div className="flex flex-col items-end">
            <div className="text-[9px] text-slate-400 font-mono">Sprints Used</div>
            <div className="flex gap-1 mt-0.5">
              {[1, 2, 3].map((num) => (
                <div
                  key={num}
                  className={`w-3.5 h-2 rounded-sm border ${
                    player.sprintCount >= num
                      ? num === 3
                        ? 'bg-rose-500 border-rose-400'
                        : 'bg-cyan-500 border-cyan-400'
                      : 'bg-slate-800 border-slate-700'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Controls Legend */}
        <div className="bg-slate-950/80 backdrop-blur-md border border-slate-800 rounded px-3 py-1.5 text-[10px] sm:text-xs text-slate-300 flex items-center gap-3">
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-600 rounded text-slate-200 font-mono">W</kbd> Walk
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-600 rounded text-slate-200 font-mono">Shift</kbd> Sprint (2s)
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-600 rounded text-slate-200 font-mono">A / D</kbd> Turn (1s)
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-600 rounded text-slate-200 font-mono">Space</kbd> Board
          </span>
        </div>
      </div>

      {/* Achievement Unlocked Toast Notification */}
      {newAchievement && (
        <div
          onClick={onClearAchievement}
          className="pointer-events-auto absolute top-16 right-4 sm:right-8 bg-amber-950/95 border-2 border-amber-400 text-amber-100 p-3.5 rounded-lg shadow-2xl flex items-center gap-3.5 cursor-pointer hover:scale-105 transition transform animate-bounce backdrop-blur-md"
        >
          <span className="text-3xl">{newAchievement.icon}</span>
          <div>
            <div className="text-[10px] font-pixel text-amber-400 uppercase tracking-widest flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-amber-400" />
              ACHIEVEMENT UNLOCKED!
            </div>
            <div className="text-sm font-bold text-white">{newAchievement.title}</div>
            <div className="text-[11px] text-amber-200/90 max-w-[220px]">{newAchievement.description}</div>
          </div>
        </div>
      )}
    </div>
  );
};
