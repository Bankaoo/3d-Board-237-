import React from 'react';
import { GameSettings } from '../types/game';
import { X, Volume2, Monitor, Keyboard } from 'lucide-react';
import { soundManager } from '../audio/SoundManager';

interface SettingsModalProps {
  settings: GameSettings;
  onUpdateSettings: (newSettings: Partial<GameSettings>) => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  onUpdateSettings,
  onClose,
}) => {
  const handleVolumeChange = (key: keyof GameSettings, val: number) => {
    onUpdateSettings({ [key]: val });
    soundManager.updateSettings({ [key]: val });
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
        className="max-w-md w-full bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-6 flex flex-col relative"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Volume2 className="w-5 h-5 text-cyan-400" />
            <h3 className="text-base font-bold font-pixel text-white">SETTINGS</h3>
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

        {/* Audio Sliders */}
        <div className="space-y-4 mb-6">
          <div className="text-xs uppercase tracking-wider text-slate-400 font-bold font-mono">
            Audio Levels
          </div>

          <div>
            <div className="flex justify-between text-xs text-slate-300 font-mono mb-1">
              <span>Master Volume</span>
              <span>{Math.round(settings.masterVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={settings.masterVolume}
              onChange={(e) => handleVolumeChange('masterVolume', parseFloat(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs text-slate-300 font-mono mb-1">
              <span>Rain & Ambient</span>
              <span>{Math.round(settings.rainVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={settings.rainVolume}
              onChange={(e) => handleVolumeChange('rainVolume', parseFloat(e.target.value))}
              className="w-full accent-teal-400 cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs text-slate-300 font-mono mb-1">
              <span>Bus Engine</span>
              <span>{Math.round(settings.engineVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={settings.engineVolume}
              onChange={(e) => handleVolumeChange('engineVolume', parseFloat(e.target.value))}
              className="w-full accent-amber-400 cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs text-slate-300 font-mono mb-1">
              <span>Sound Effects</span>
              <span>{Math.round(settings.sfxVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={settings.sfxVolume}
              onChange={(e) => handleVolumeChange('sfxVolume', parseFloat(e.target.value))}
              className="w-full accent-emerald-400 cursor-pointer"
            />
          </div>
        </div>

        {/* Display Options */}
        <div className="border-t border-slate-800 pt-4 mb-6 space-y-3">
          <div className="text-xs uppercase tracking-wider text-slate-400 font-bold font-mono flex items-center gap-1.5">
            <Monitor className="w-4 h-4 text-slate-400" />
            <span>Display Effects</span>
          </div>

          <label className="flex items-center justify-between cursor-pointer p-2 rounded hover:bg-slate-800/50">
            <span className="text-xs text-slate-300">Retro CRT Scanlines</span>
            <input
              type="checkbox"
              checked={settings.crtEffect}
              onChange={(e) => onUpdateSettings({ crtEffect: e.target.checked })}
              className="accent-cyan-400 w-4 h-4 cursor-pointer"
            />
          </label>
        </div>

        {/* Controls Reference */}
        <div className="border-t border-slate-800 pt-3 text-[11px] text-slate-400 font-mono space-y-1">
          <div className="font-bold text-slate-300 flex items-center gap-1 mb-1">
            <Keyboard className="w-3.5 h-3.5" /> Key Map
          </div>
          <div><b className="text-slate-200">W / Up</b> : Walk forward (1 m/s)</div>
          <div><b className="text-slate-200">Shift</b> : Sprint (2.5 m/s, 2s max)</div>
          <div><b className="text-slate-200">A / Left or D / Right</b> : Turn 180° (1s)</div>
          <div><b className="text-slate-200">Space</b> : Board Bus</div>
          <div><b className="text-slate-200">Esc</b> : Pause / Resume</div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800 pt-4 mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded cursor-pointer transition text-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
