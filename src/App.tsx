import React, { useEffect, useRef, useState } from 'react';
import { GameSettings, GameStateStatus } from './types/game';
import { gameSim } from './game/GameSimulation';
import { PerspectiveRenderer } from './render/PerspectiveRenderer';
import { GameHUD } from './components/GameHUD';
import { TitleScreen } from './components/TitleScreen';
import { GameOverModal } from './components/GameOverModal';
import { AchievementsModal } from './components/AchievementsModal';
import { SettingsModal } from './components/SettingsModal';
import { soundManager } from './audio/SoundManager';
import { Footprints, Wind, Eye } from 'lucide-react';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<PerspectiveRenderer | null>(null);
  const lastTimeRef = useRef<number>(performance.now());
  const animationFrameIdRef = useRef<number | null>(null);

  // React state for UI rendering synchronization
  const [gameStatus, setGameStatus] = useState<GameStateStatus>('TITLE');
  const [timeRemaining, setTimeRemaining] = useState<number>(25.0);
  const [playerState, setPlayerState] = useState({ ...gameSim.player });
  const [busesState, setBusesState] = useState([...gameSim.buses]);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [newAchievement, setNewAchievement] = useState(gameSim.newlyUnlockedAchievement);
  const [achievements, setAchievements] = useState([...gameSim.achievements]);

  // Modals state
  const [showAchievements, setShowAchievements] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);

  // Settings
  const [settings, setSettings] = useState<GameSettings>({
    masterVolume: 0.8,
    rainVolume: 0.6,
    engineVolume: 0.8,
    sfxVolume: 0.7,
    crtEffect: true,
    screenShake: true,
  });

  // Initialize Canvas Renderer
  useEffect(() => {
    if (!canvasRef.current) return;
    rendererRef.current = new PerspectiveRenderer(canvasRef.current);

    // Initial draw
    if (rendererRef.current) {
      rendererRef.current.render(gameSim.player, gameSim.buses, 0.016, false);
    }
  }, []);

  // Keyboard Event Handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If modal is open and Esc pressed, close it
      if (e.code === 'Escape') {
        if (showAchievements) {
          setShowAchievements(false);
          return;
        }
        if (showSettings) {
          setShowSettings(false);
          return;
        }
      }

      // Prevent default page scrolling for gaming keys
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }

      gameSim.onKeyDown(e.code);

      // Sync state for immediate feedback
      setGameStatus(gameSim.status);
      setPlayerState({ ...gameSim.player });
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      gameSim.onKeyUp(e.code);
      setPlayerState({ ...gameSim.player });
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [showAchievements, showSettings]);

  // Main Game Loop (fixed-step delta-time simulation + canvas rendering)
  useEffect(() => {
    let lastUiSync = performance.now();

    const loop = (currentTime: number) => {
      const rawDt = (currentTime - lastTimeRef.current) / 1000;
      lastTimeRef.current = currentTime;

      const dt = Math.min(rawDt, 0.05);

      // Update Simulation only when playing and modals closed
      if (gameSim.status === 'PLAYING' && !showAchievements && !showSettings) {
        gameSim.update(dt);
      }

      // Render World on Canvas
      if (rendererRef.current) {
        rendererRef.current.render(
          gameSim.player,
          gameSim.buses,
          dt,
          gameSim.player.isSuperFatigued
        );
      }

      // Sync React UI at ~30Hz
      if (currentTime - lastUiSync > 33) {
        lastUiSync = currentTime;
        setGameStatus(gameSim.status);
        setTimeRemaining(gameSim.timeRemaining);
        setPlayerState({ ...gameSim.player });
        setBusesState([...gameSim.buses]);
        setFeedbackMsg(gameSim.feedbackMessage);

        if (gameSim.newlyUnlockedAchievement) {
          setNewAchievement(gameSim.newlyUnlockedAchievement);
          setAchievements([...gameSim.achievements]);
        }
      }

      animationFrameIdRef.current = requestAnimationFrame(loop);
    };

    lastTimeRef.current = performance.now();
    animationFrameIdRef.current = requestAnimationFrame(loop);

    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, [showAchievements, showSettings]);

  const handleStartGame = () => {
    soundManager.init();
    gameSim.startNewGame();
    setGameStatus(gameSim.status);
    setAchievements([...gameSim.achievements]);
    setTimeRemaining(gameSim.timeRemaining);
  };

  const handleRestart = () => {
    gameSim.startNewGame();
    setGameStatus(gameSim.status);
    setTimeRemaining(gameSim.timeRemaining);
    setNewAchievement(null);
  };

  const handleClearAchievement = () => {
    gameSim.newlyUnlockedAchievement = null;
    setNewAchievement(null);
  };

  const handleOpenAchievements = () => {
    if (gameSim.status === 'PLAYING') {
      gameSim.status = 'PAUSED';
      setGameStatus('PAUSED');
    }
    setShowAchievements(true);
  };

  const handleCloseAchievements = () => {
    setShowAchievements(false);
  };

  const handleOpenSettings = () => {
    if (gameSim.status === 'PLAYING') {
      gameSim.status = 'PAUSED';
      setGameStatus('PAUSED');
    }
    setShowSettings(true);
  };

  const handleCloseSettings = () => {
    setShowSettings(false);
  };

  const handleResetAchievements = () => {
    gameSim.resetAchievements();
    setAchievements([...gameSim.achievements]);
    setNewAchievement(null);
  };

  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  return (
    <div className="relative w-screen h-screen bg-[#040711] overflow-hidden flex items-center justify-center select-none font-terminal">
      {/* 16:9 Canvas Game Container */}
      <div className="relative w-full h-full max-w-[1280px] max-h-[720px] aspect-video flex items-center justify-center bg-black shadow-2xl overflow-hidden border border-slate-800/80">
        <canvas
          ref={canvasRef}
          width={640}
          height={360}
          className="w-full h-full object-contain pixel-art"
        />

        {/* CRT Scanline Filter */}
        {settings.crtEffect && (
          <div className="absolute inset-0 scanlines pointer-events-none z-10 opacity-70" />
        )}

        {/* Ambient Dark Vignette */}
        <div className="absolute inset-0 vignette pointer-events-none z-10" />

        {/* TITLE SCREEN */}
        {gameStatus === 'TITLE' && (
          <TitleScreen
            onStartGame={handleStartGame}
            onOpenAchievements={handleOpenAchievements}
            onOpenSettings={handleOpenSettings}
            unlockedCount={unlockedCount}
            totalCount={achievements.length}
          />
        )}

        {/* GAME HUD (Active during PLAYING or PAUSED) */}
        {(gameStatus === 'PLAYING' || gameStatus === 'PAUSED') && (
          <GameHUD
            timeRemaining={timeRemaining}
            player={playerState}
            buses={busesState}
            feedbackMessage={feedbackMsg}
            newAchievement={newAchievement}
            onClearAchievement={handleClearAchievement}
            onOpenSettings={handleOpenSettings}
            onOpenAchievements={handleOpenAchievements}
          />
        )}

        {/* PAUSE OVERLAY */}
        {gameStatus === 'PAUSED' && !showAchievements && !showSettings && (
          <div className="absolute inset-0 z-30 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center">
            <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl shadow-2xl text-center max-w-xs w-full">
              <h2 className="text-xl font-bold font-pixel text-white mb-2">PAUSED</h2>
              <p className="text-xs text-slate-400 font-mono mb-6">Press [ESC] to resume</p>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => {
                    gameSim.status = 'PLAYING';
                    setGameStatus('PLAYING');
                  }}
                  className="py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded cursor-pointer transition text-xs font-pixel"
                >
                  RESUME
                </button>
                <button
                  type="button"
                  onClick={handleRestart}
                  className="py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded cursor-pointer transition text-xs"
                >
                  RESTART ATTEMPT
                </button>
              </div>
            </div>
          </div>
        )}

        {/* GAME OVER SCREEN */}
        {gameStatus === 'GAMEOVER' && (
          <GameOverModal
            reason={gameSim.gameOverReason}
            stats={gameSim.runStats}
            achievements={achievements}
            onRestart={handleRestart}
            onOpenAchievements={handleOpenAchievements}
          />
        )}

        {/* ACHIEVEMENTS MODAL */}
        {showAchievements && (
          <AchievementsModal
            achievements={achievements}
            onClose={handleCloseAchievements}
            onResetAchievements={handleResetAchievements}
            isPlaying={gameStatus === 'PLAYING' || gameStatus === 'PAUSED'}
          />
        )}

        {/* SETTINGS MODAL */}
        {showSettings && (
          <SettingsModal
            settings={settings}
            onUpdateSettings={(newSettings) => setSettings((prev) => ({ ...prev, ...newSettings }))}
            onClose={handleCloseSettings}
          />
        )}

        {/* Touch & Click Virtual Control Pad */}
        {gameStatus === 'PLAYING' && (
          <div className="absolute bottom-16 right-4 sm:hidden flex flex-col items-end gap-2 z-20 pointer-events-auto">
            <div className="flex gap-2">
              <button
                onTouchStart={() => { gameSim.keys.forward = true; }}
                onTouchEnd={() => { gameSim.keys.forward = false; }}
                onMouseDown={() => { gameSim.keys.forward = true; }}
                onMouseUp={() => { gameSim.keys.forward = false; }}
                className="w-12 h-12 bg-slate-900/90 border border-slate-700 rounded-lg flex items-center justify-center text-white active:bg-cyan-600"
              >
                <Footprints className="w-5 h-5 text-cyan-300" />
              </button>
              <button
                onClick={() => gameSim.onKeyDown('ShiftLeft')}
                className="w-12 h-12 bg-slate-900/90 border border-slate-700 rounded-lg flex items-center justify-center text-white active:bg-emerald-600"
              >
                <Wind className="w-5 h-5 text-emerald-300" />
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => gameSim.onKeyDown('KeyA')}
                className="w-12 h-12 bg-slate-900/90 border border-slate-700 rounded-lg flex items-center justify-center text-white active:bg-amber-600"
              >
                <Eye className="w-5 h-5 text-amber-300" />
              </button>
              <button
                onClick={() => gameSim.attemptBoarding()}
                className="w-12 h-12 bg-emerald-700 border border-emerald-500 rounded-lg flex items-center justify-center text-white active:bg-emerald-500 font-pixel text-xs"
              >
                GO
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
