import { GameSettings } from '../types/game';

class SoundManager {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private settings: GameSettings = {
    masterVolume: 0.8,
    rainVolume: 0.6,
    engineVolume: 0.8,
    sfxVolume: 0.7,
    crtEffect: true,
    screenShake: true,
  };

  // Ambient nodes
  private masterGain: GainNode | null = null;
  private rainGain: GainNode | null = null;
  private rainSource: AudioBufferSourceNode | null = null;

  // Engine nodes
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineOsc1: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private engineSub: OscillatorNode | null = null;
  private enginePanner: StereoPannerNode | null = null;

  // Fatigue breath/heartbeat
  private fatigueGain: GainNode | null = null;
  private lastFootstepTime: number = 0;
  private initialized: boolean = false;

  public init() {
    if (this.initialized && this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return;
    }

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      // Master Gain
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.settings.masterVolume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      // Start Ambient Rain
      this.startRain();

      // Start Bus Engine setup
      this.setupEngineSynth();

      this.initialized = true;
    } catch (e) {
      console.warn('Web Audio not supported or blocked:', e);
    }
  }

  public updateSettings(newSettings: Partial<GameSettings>) {
    this.settings = { ...this.settings, ...newSettings };
    if (!this.ctx || !this.masterGain) return;

    this.masterGain.gain.setValueAtTime(this.settings.masterVolume, this.ctx.currentTime);
    if (this.rainGain) {
      this.rainGain.gain.setValueAtTime(this.settings.rainVolume * 0.4, this.ctx.currentTime);
    }
  }

  private startRain() {
    if (!this.ctx || !this.masterGain) return;

    // Generate 3 seconds of pink/brown noise buffer for natural rain
    const bufferSize = this.ctx.sampleRate * 3;
    const noiseBuffer = this.ctx.createBuffer(2, bufferSize, this.ctx.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = noiseBuffer.getChannelData(channel);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      }
    }

    this.rainSource = this.ctx.createBufferSource();
    this.rainSource.buffer = noiseBuffer;
    this.rainSource.loop = true;

    // Bandpass filter to sound like soft street rain
    const rainFilter = this.ctx.createBiquadFilter();
    rainFilter.type = 'lowpass';
    rainFilter.frequency.setValueAtTime(1400, this.ctx.currentTime);

    this.rainGain = this.ctx.createGain();
    this.rainGain.gain.setValueAtTime(this.settings.rainVolume * 0.35, this.ctx.currentTime);

    this.rainSource.connect(rainFilter);
    rainFilter.connect(this.rainGain);
    this.rainGain.connect(this.masterGain);

    this.rainSource.start(0);
  }

  private setupEngineSynth() {
    if (!this.ctx || !this.masterGain) return;

    // Master Engine nodes
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.setValueAtTime(0, this.ctx.currentTime); // silent initially

    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.setValueAtTime(180, this.ctx.currentTime);

    // Stereo Panner (if available)
    if (this.ctx.createStereoPanner) {
      this.enginePanner = this.ctx.createStereoPanner();
      this.engineFilter.connect(this.enginePanner);
      this.enginePanner.connect(this.engineGain);
    } else {
      this.engineFilter.connect(this.engineGain);
    }
    this.engineGain.connect(this.masterGain);

    // Diesel Engine Low Oscillators
    this.engineOsc1 = this.ctx.createOscillator();
    this.engineOsc1.type = 'sawtooth';
    this.engineOsc1.frequency.setValueAtTime(54, this.ctx.currentTime); // low hum

    this.engineOsc2 = this.ctx.createOscillator();
    this.engineOsc2.type = 'triangle';
    this.engineOsc2.frequency.setValueAtTime(108, this.ctx.currentTime);

    this.engineSub = this.ctx.createOscillator();
    this.engineSub.type = 'sine';
    this.engineSub.frequency.setValueAtTime(27, this.ctx.currentTime);

    this.engineOsc1.connect(this.engineFilter);
    this.engineOsc2.connect(this.engineFilter);
    this.engineSub.connect(this.engineFilter);

    this.engineOsc1.start();
    this.engineOsc2.start();
    this.engineSub.start();
  }

  // Real-time engine sound update based on bus position relative to player
  public updateBusEngine(busZ: number, playerZ: number, busSpeed: number, isApproaching: boolean) {
    if (!this.ctx || !this.engineGain || !this.engineFilter) return;

    const distance = Math.abs(busZ - playerZ);
    // Attenuation over 160 meters for distant rumble
    const maxRange = 160;
    const factor = Math.max(0, 1 - distance / maxRange);
    // Muffled low presence even at far distances
    const volume = Math.max(0.04, Math.pow(factor, 2.0)) * this.settings.engineVolume * 0.75;

    // Deep sub-bass filter when far away, opens up into full diesel roar when close
    const targetFreq = 80 + Math.pow(factor, 2.5) * 720;
    // Doppler effect: slight pitch raise when approaching, lower when receding
    const doppler = isApproaching ? (busSpeed > 1 ? 1.08 : 1.0) : 0.94;
    const baseFreq = 52 * (1 + (busSpeed / 20) * 0.3) * doppler;

    const now = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(volume, now, 0.1);
    this.engineFilter.frequency.setTargetAtTime(targetFreq, now, 0.1);

    if (this.engineOsc1) this.engineOsc1.frequency.setTargetAtTime(baseFreq, now, 0.1);
    if (this.engineOsc2) this.engineOsc2.frequency.setTargetAtTime(baseFreq * 2, now, 0.1);
    if (this.engineSub) this.engineSub.frequency.setTargetAtTime(baseFreq * 0.5, now, 0.1);

    // Pan: if bus is behind or passing to player's left
    if (this.enginePanner) {
      // bus drives on left side of road relative to forward direction
      const pan = busZ < playerZ ? -0.3 : 0.2;
      this.enginePanner.pan.setTargetAtTime(pan, now, 0.1);
    }
  }

  public playAirBrake() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    // Hiss sound
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.7);
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2500, now);
    filter.Q.setValueAtTime(2.0, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(this.settings.sfxVolume * 0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

    whiteNoise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    whiteNoise.start(now);
  }

  public playDoorsOpen() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    // Two-tone friendly chime: E5 -> B5
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';

    osc.frequency.setValueAtTime(659.25, now); // E5
    osc.frequency.setValueAtTime(987.77, now + 0.15); // B5

    gain.gain.setValueAtTime(this.settings.sfxVolume * 0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.55);

    // Mechanical latch click
    this.playClick(0.3, 300);
  }

  public playDoorsClose() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    // Reverse chime: B5 -> E5
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';

    osc.frequency.setValueAtTime(987.77, now);
    osc.frequency.setValueAtTime(659.25, now + 0.15);

    gain.gain.setValueAtTime(this.settings.sfxVolume * 0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.5);
  }

  public playHorn() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    // Deep dual-tone bus horn
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc2.type = 'sawtooth';
    osc1.frequency.setValueAtTime(220, now); // A3
    osc2.frequency.setValueAtTime(277.18, now); // C#4

    gain.gain.setValueAtTime(this.settings.sfxVolume * 0.5, now);
    gain.gain.setValueAtTime(this.settings.sfxVolume * 0.5, now + 0.5);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, now);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.75);
    osc2.stop(now + 0.75);
  }

  public playFootstep(isSprinting: boolean, isFatigued: boolean) {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    // Minimum gap between footstep triggers
    const minInterval = isSprinting ? 0.35 : (isFatigued ? 0.8 : 0.55);
    if (now - this.lastFootstepTime < minInterval) return;
    this.lastFootstepTime = now;

    // Sloshing wet shoe noise: soft filtered noise + thud
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(isFatigued ? 80 : 120, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.08);

    oscGain.gain.setValueAtTime(this.settings.sfxVolume * (isSprinting ? 0.35 : 0.22), now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(oscGain);
    oscGain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.1);

    // Wet splash noise
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.08);
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;

    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1200 + Math.random() * 400, now);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(this.settings.sfxVolume * (isSprinting ? 0.25 : 0.14), now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.masterGain);

    noise.start(now);
  }

  public playTurnWhoosh() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    // Coat rustle and low whoosh
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.4);

    gain.gain.setValueAtTime(this.settings.sfxVolume * 0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.45);
  }

  public playFatigueGasp(isSuper: boolean) {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    // Breath sound
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.4);
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) output[i] = (Math.random() * 2 - 1) * 0.5;

    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800, now);
    filter.Q.setValueAtTime(1.5, now);

    const gain = this.ctx.createGain();
    const vol = isSuper ? 0.4 : 0.25;
    gain.gain.setValueAtTime(this.settings.sfxVolume * vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start(now);

    // Heartbeat thump
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(90, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.12);

    oscGain.gain.setValueAtTime(this.settings.sfxVolume * (isSuper ? 0.5 : 0.3), now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc.connect(oscGain);
    oscGain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  public playCollision() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    // Dull impact thud
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.2);

    oscGain.gain.setValueAtTime(this.settings.sfxVolume * 0.6, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(oscGain);
    oscGain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.3);

    // Umbrella spring twang
    const twang = this.ctx.createOscillator();
    const twangGain = this.ctx.createGain();
    twang.type = 'sawtooth';
    twang.frequency.setValueAtTime(440, now);
    twang.frequency.exponentialRampToValueAtTime(120, now + 0.3);

    twangGain.gain.setValueAtTime(this.settings.sfxVolume * 0.3, now);
    twangGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    twang.connect(twangGain);
    twangGain.connect(this.masterGain);

    twang.start(now);
    twang.stop(now + 0.32);
  }

  public playSuccessChime() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    // Cheerful ascending arpeggio (C5 -> E5 -> G5 -> C6)
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const t = now + idx * 0.12;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(this.settings.sfxVolume * 0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + 0.45);
    });
  }

  public playBuzzer() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(130, now); // Low buzz

    gain.gain.setValueAtTime(this.settings.sfxVolume * 0.4, now);
    gain.gain.setValueAtTime(this.settings.sfxVolume * 0.4, now + 0.25);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.4);
  }

  public playAchievementUnlock() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    // Retro 8-bit fanfare
    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const t = now + idx * 0.08;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(this.settings.sfxVolume * 0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + 0.25);
    });
  }

  public playClick(vol: number = 0.2, freq: number = 600) {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.04);

    gain.gain.setValueAtTime(this.settings.sfxVolume * vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.05);
  }

  public stopEngine() {
    if (!this.ctx || !this.engineGain) return;
    this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
  }
}

export const soundManager = new SoundManager();
