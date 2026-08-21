// Procedural Web Audio Sound & Music Engine for Stick Fighters
// Custom synthesizers for cartoon/epic adventure themes, dynamic battle tracks, and responsive SFX.

export type MusicTrack = 'menu' | 'studio' | 'battle' | 'lobby' | 'map_select' | 'map_preview';

// Map screen/alias tracks to the exactly 3 distinct musical identities
export function getCanonicalTrack(track: MusicTrack): 'menu' | 'studio' | 'battle' {
  if (track === 'studio') return 'studio';
  if (track === 'battle') return 'battle';
  return 'menu'; // 'menu', 'lobby', 'map_select', 'map_preview' map to home/menu identity
}

interface AudioSettings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  musicEnabled: boolean;
  sfxEnabled: boolean;
}

const STORAGE_KEY = 'stick_fighters_audio_v2';

const DEFAULT_SETTINGS: AudioSettings = {
  masterVolume: 1.0,
  musicVolume: 0.65,
  sfxVolume: 0.75,
  musicEnabled: true,
  sfxEnabled: true,
};

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGainNode: GainNode | null = null;
  private musicGainNode: GainNode | null = null;
  private sfxGainNode: GainNode | null = null;

  private settings: AudioSettings = { ...DEFAULT_SETTINGS };

  private currentTrack: MusicTrack | null = null;
  private activeTrack: 'menu' | 'studio' | 'battle' | null = null;
  private isMusicRunning: boolean = false;
  private musicInterval: any = null;
  private musicActiveNodes: (AudioNode | number)[] = [];
  private trackGainNode: GainNode | null = null;
  private fadeTimeout: any = null;

  // Battle danger layer
  private isDangerActive: boolean = false;
  private dangerGainNode: GainNode | null = null;
  private dangerInterval: any = null;

  // Track step pointers
  private stepIndex: number = 0;
  private userInteracted: boolean = false;
  private cachedWhiteNoiseBuffer: AudioBuffer | null = null;

  constructor() {
    this.loadSettings();
    this.setupGestureListeners();
  }

  private setupGestureListeners() {
    if (typeof window === 'undefined') return;
    const unlock = () => {
      this.unlockAudio();
    };

    const options = { capture: true, passive: true };
    window.addEventListener('pointerdown', unlock, options);
    window.addEventListener('keydown', unlock, options);
    window.addEventListener('touchstart', unlock, options);
    window.addEventListener('click', unlock, options);
  }

  public unlockAudio() {
    if (!this.userInteracted) {
      this.userInteracted = true;
      this.initCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (this.currentTrack && !this.isMusicRunning && this.settings.musicEnabled) {
      const track = this.currentTrack;
      this.activeTrack = null;
      this.playTrack(track);
    }
  }

  private loadSettings() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      }
    } catch (e) {
      this.settings = { ...DEFAULT_SETTINGS };
    }
  }

  private saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch (e) {
      // ignore
    }
  }

  private initCtx() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.masterGainNode = this.ctx.createGain();
        this.musicGainNode = this.ctx.createGain();
        this.sfxGainNode = this.ctx.createGain();

        this.musicGainNode.connect(this.masterGainNode);
        this.sfxGainNode.connect(this.masterGainNode);
        this.masterGainNode.connect(this.ctx.destination);

        const sampleRate = this.ctx.sampleRate;
        this.cachedWhiteNoiseBuffer = this.ctx.createBuffer(1, sampleRate, sampleRate);
        const data = this.cachedWhiteNoiseBuffer.getChannelData(0);
        for (let i = 0; i < sampleRate; i++) {
          data[i] = Math.random() * 2 - 1;
        }

        this.applyGains();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended' && this.userInteracted) {
      this.ctx.resume().catch(() => {});
    }
  }

  private applyGains() {
    if (!this.ctx || !this.masterGainNode || !this.musicGainNode || !this.sfxGainNode) return;
    const now = this.ctx.currentTime;

    const master = this.settings.masterVolume;
    const music = this.settings.musicEnabled ? this.settings.musicVolume : 0;
    const sfx = this.settings.sfxEnabled ? this.settings.sfxVolume : 0;

    this.masterGainNode.gain.cancelScheduledValues(now);
    this.masterGainNode.gain.setValueAtTime(master, now);

    this.musicGainNode.gain.cancelScheduledValues(now);
    this.musicGainNode.gain.setValueAtTime(music, now);

    this.sfxGainNode.gain.cancelScheduledValues(now);
    this.sfxGainNode.gain.setValueAtTime(sfx, now);
  }

  // Public Settings API
  public getSettings(): AudioSettings {
    return { ...this.settings };
  }

  public setMasterVolume(vol: number) {
    this.initCtx();
    this.settings.masterVolume = Math.max(0, Math.min(1, vol));
    this.applyGains();
    this.saveSettings();
  }

  public setMusicVolume(vol: number) {
    this.initCtx();
    this.settings.musicVolume = Math.max(0, Math.min(1, vol));
    this.applyGains();
    this.saveSettings();
  }

  public setSfxVolume(vol: number) {
    this.initCtx();
    this.settings.sfxVolume = Math.max(0, Math.min(1, vol));
    this.applyGains();
    this.saveSettings();
  }

  public toggleMusic(enable?: boolean): boolean {
    this.initCtx();
    this.settings.musicEnabled = enable !== undefined ? enable : !this.settings.musicEnabled;
    this.applyGains();
    this.saveSettings();
    if (!this.settings.musicEnabled) {
      this.stopMusic(false);
    } else if (this.currentTrack) {
      this.playTrack(this.currentTrack);
    }
    return this.settings.musicEnabled;
  }

  public toggleSfx(enable?: boolean): boolean {
    this.initCtx();
    this.settings.sfxEnabled = enable !== undefined ? enable : !this.settings.sfxEnabled;
    this.applyGains();
    this.saveSettings();
    return this.settings.sfxEnabled;
  }

  public setVolumes(sfx: number, music: number) {
    this.setSfxVolume(sfx);
    this.setMusicVolume(music);
  }

  public setMuted(muted: boolean) {
    this.initCtx();
    this.settings.masterVolume = muted ? 0 : 1;
    this.applyGains();
  }

  // ==========================================
  // MUSIC ENGINE WITH SEAMLESS CROSS-FADING
  // ==========================================

  public playTrack(track: MusicTrack) {
    const canonical = getCanonicalTrack(track);
    this.currentTrack = track;

    if (!this.userInteracted) {
      return; // Defer music startup until first user gesture
    }

    this.initCtx();
    if (!this.ctx || !this.musicGainNode) return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    // If the same canonical music identity is ALREADY active and running, keep it going smoothly
    if (this.isMusicRunning && this.activeTrack === canonical && this.trackGainNode) {
      return;
    }

    if (!this.settings.musicEnabled) {
      this.stopMusic(false);
      return;
    }

    // Terminate existing note scheduler loops immediately
    if (this.musicInterval) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
    if (this.dangerInterval) {
      clearInterval(this.dangerInterval);
      this.dangerInterval = null;
    }
    this.isDangerActive = false;

    if (this.fadeTimeout) {
      clearTimeout(this.fadeTimeout);
      this.fadeTimeout = null;
    }

    // Smoothly fade out previous track's gain node (no audio pops/clicks)
    if (this.trackGainNode && this.ctx) {
      const oldGain = this.trackGainNode;
      const now = this.ctx.currentTime;
      try {
        oldGain.gain.cancelScheduledValues(now);
        oldGain.gain.setValueAtTime(oldGain.gain.value, now);
        oldGain.gain.linearRampToValueAtTime(0.0001, now + 0.25);
      } catch (e) {}
      this.fadeTimeout = setTimeout(() => {
        try {
          oldGain.disconnect();
        } catch (e) {}
      }, 280);
      this.trackGainNode = null;
    }

    this.isMusicRunning = true;
    this.activeTrack = canonical;
    this.stepIndex = 0;

    // Create a sub-gain for the incoming track to handle smooth fade-in
    const trackGain = this.ctx.createGain();
    const now = this.ctx.currentTime;
    trackGain.gain.setValueAtTime(0.0001, now);
    trackGain.gain.linearRampToValueAtTime(1, now + 0.35); // 350ms smooth fade in
    trackGain.connect(this.musicGainNode);
    this.trackGainNode = trackGain;

    // Launch specific procedural track generator for canonical identity
    switch (canonical) {
      case 'menu':
        this.startMenuTheme(trackGain);
        break;
      case 'studio':
        this.startStudioTheme(trackGain);
        break;
      case 'battle':
        this.startBattleTheme(trackGain);
        break;
    }
  }

  public stopMusic(fade: boolean = false) {
    if (this.musicInterval) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
    if (this.dangerInterval) {
      clearInterval(this.dangerInterval);
      this.dangerInterval = null;
    }
    this.isDangerActive = false;

    if (this.fadeTimeout) {
      clearTimeout(this.fadeTimeout);
      this.fadeTimeout = null;
    }

    if (this.trackGainNode && this.ctx) {
      const oldGain = this.trackGainNode;
      if (fade) {
        const now = this.ctx.currentTime;
        try {
          oldGain.gain.cancelScheduledValues(now);
          oldGain.gain.setValueAtTime(oldGain.gain.value, now);
          oldGain.gain.linearRampToValueAtTime(0.0001, now + 0.25);
        } catch (e) {}
      }
      this.fadeTimeout = setTimeout(() => {
        try {
          oldGain.disconnect();
        } catch (e) {}
      }, fade ? 280 : 30);
      this.trackGainNode = null;
    }

    this.activeTrack = null;
    this.isMusicRunning = false;
  }

  public getCurrentTrack(): MusicTrack | null {
    return this.currentTrack;
  }

  public isMusicOn(): boolean {
    return this.settings.musicEnabled && this.isMusicRunning;
  }

  // ==========================================
  // INDIVIDUAL PROCEDURAL TRACK COMPOSITIONS
  // ==========================================

  // 1. MAIN MENU: Epic, Inspiring, Heroic Adventure (D Major / G Major Fanfare)
  private startMenuTheme(outputGain: GainNode) {
    if (!this.ctx) return;

    // Heroic melodic phrases: D4, F#4, A4, B4, D5, C#5, A4, F#4, G4, A4, B4, D5
    const leadNotes = [
      293.66, 0, 369.99, 440.00, 493.88, 0, 587.33, 554.37,
      440.00, 0, 369.99, 392.00, 440.00, 493.88, 587.33, 0,
      440.00, 0, 493.88, 587.33, 659.25, 0, 587.33, 440.00,
      369.99, 0, 392.00, 440.00, 293.66, 0, 293.66, 0,
    ];

    const chordBass = [
      146.83, 146.83, 146.83, 146.83, // D3
      196.00, 196.00, 196.00, 196.00, // G3
      220.00, 220.00, 220.00, 220.00, // A3
      146.83, 146.83, 146.83, 146.83, // D3
    ];

    const tempoMs = 280;

    this.musicInterval = setInterval(() => {
      if (!this.ctx || !this.isMusicRunning) return;
      const now = this.ctx.currentTime;
      const step = this.stepIndex;
      this.stepIndex = (this.stepIndex + 1) % leadNotes.length;

      const noteFreq = leadNotes[step];
      const bassFreq = chordBass[Math.floor((step % 16) / 4) % chordBass.length];

      // Play Heroic Brass/Synth Lead
      if (noteFreq > 0) {
        const osc = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const noteGain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = 'sawtooth';
        osc2.type = 'triangle';
        osc.frequency.setValueAtTime(noteFreq, now);
        osc2.frequency.setValueAtTime(noteFreq * 1.004, now); // slight chorus detune

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1600, now);
        filter.frequency.exponentialRampToValueAtTime(700, now + 0.35);

        noteGain.gain.setValueAtTime(0.001, now);
        noteGain.gain.linearRampToValueAtTime(0.13, now + 0.04);
        noteGain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);

        osc.connect(filter);
        osc2.connect(filter);
        filter.connect(noteGain);
        noteGain.connect(outputGain);

        osc.start(now);
        osc2.start(now);
        osc.stop(now + 0.36);
        osc.onended = () => { osc.disconnect(); noteGain.disconnect(); if (filter) filter.disconnect(); };
        osc2.stop(now + 0.36);
        osc2.onended = () => { osc2.disconnect(); noteGain.disconnect(); if (filter) filter.disconnect(); };
      }

      // Play Orchestral Bass & Timpani Pulse on beat
      if (step % 2 === 0) {
        const bassOsc = this.ctx.createOscillator();
        const bassGain = this.ctx.createGain();
        bassOsc.type = 'triangle';
        bassOsc.frequency.setValueAtTime(bassFreq, now);

        bassGain.gain.setValueAtTime(0.18, now);
        bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

        bassOsc.connect(bassGain);
        bassGain.connect(outputGain);
        bassOsc.start(now);
        bassOsc.stop(now + 0.48);
        bassOsc.onended = () => { bassOsc.disconnect(); bassGain.disconnect(); };
      }

      // Subtle high sparkle chime on bar start
      if (step % 8 === 0) {
        this.playSubtleChime(outputGain, 880, 0.05);
      }
    }, tempoMs);
  }

  // 2. LOBBY & GAME MODE: Energetic, Bouncy, Martial Anticipation (130 BPM vibe)
  private startLobbyTheme(outputGain: GainNode) {
    if (!this.ctx) return;

    const bassGroove = [
      130.81, 130.81, 155.56, 174.61, 196.00, 174.61, 155.56, 130.81, // C - Eb - F - G
      116.54, 116.54, 130.81, 155.56, 174.61, 155.56, 130.81, 116.54, // Bb - C - Eb - F
    ];

    const arps = [
      523.25, 0, 659.25, 783.99, 0, 659.25, 523.25, 0,
      466.16, 0, 587.33, 698.46, 0, 587.33, 466.16, 0,
    ];

    const tempoMs = 210;

    this.musicInterval = setInterval(() => {
      if (!this.ctx || !this.isMusicRunning) return;
      const now = this.ctx.currentTime;
      const step = this.stepIndex;
      this.stepIndex = (this.stepIndex + 1) % arps.length;

      // Punchy Funk Synth Bass
      const bassNote = bassGroove[step % bassGroove.length];
      const bassOsc = this.ctx.createOscillator();
      const bassFilter = this.ctx.createBiquadFilter();
      const bassGain = this.ctx.createGain();

      bassOsc.type = 'sawtooth';
      bassOsc.frequency.setValueAtTime(bassNote, now);

      bassFilter.type = 'lowpass';
      bassFilter.frequency.setValueAtTime(900, now);
      bassFilter.frequency.exponentialRampToValueAtTime(180, now + 0.18);

      bassGain.gain.setValueAtTime(0.16, now);
      bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      bassOsc.connect(bassFilter);
      bassFilter.connect(bassGain);
      bassGain.connect(outputGain);

      bassOsc.start(now);
      bassOsc.stop(now + 0.2);
      bassOsc.onended = () => { bassOsc.disconnect(); bassGain.disconnect(); if (bassFilter) bassFilter.disconnect(); };

      // Bright comic arpeggio synth
      const arpNote = arps[step % arps.length];
      if (arpNote > 0) {
        const arpOsc = this.ctx.createOscillator();
        const arpGain = this.ctx.createGain();
        arpOsc.type = 'sine';
        arpOsc.frequency.setValueAtTime(arpNote, now);

        arpGain.gain.setValueAtTime(0.08, now);
        arpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

        arpOsc.connect(arpGain);
        arpGain.connect(outputGain);

        arpOsc.start(now);
        arpOsc.stop(now + 0.18);
        arpOsc.onended = () => { arpOsc.disconnect(); arpGain.disconnect(); };
      }

      // Comic woodblock pulse on every 4th step
      if (step % 4 === 2) {
        this.playWoodblockTick(outputGain, 0.04);
      }
    }, tempoMs);
  }

  // 3. MAP SELECTION: Discovery, Wonder, Journey Planning
  private startMapSelectTheme(outputGain: GainNode) {
    if (!this.ctx) return;

    // Ethereal adventurous pentatonic intervals
    const melody = [
      440.00, 523.25, 659.25, 0, 783.99, 659.25, 523.25, 0,
      392.00, 493.88, 587.33, 0, 783.99, 587.33, 493.88, 0,
    ];

    const tempoMs = 320;

    this.musicInterval = setInterval(() => {
      if (!this.ctx || !this.isMusicRunning) return;
      const now = this.ctx.currentTime;
      const step = this.stepIndex;
      this.stepIndex = (this.stepIndex + 1) % melody.length;

      const note = melody[step];
      if (note > 0) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(note, now);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.12, now + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);

        osc.connect(gain);
        gain.connect(outputGain);

        osc.start(now);
        osc.stop(now + 0.45);
        osc.onended = () => { osc.disconnect(); gain.disconnect(); };
      }

      // Warm ambient pad every 8 steps
      if (step % 8 === 0) {
        const padOsc = this.ctx.createOscillator();
        const padGain = this.ctx.createGain();
        padOsc.type = 'sine';
        padOsc.frequency.setValueAtTime(note ? note / 2 : 220, now);

        padGain.gain.setValueAtTime(0.001, now);
        padGain.gain.linearRampToValueAtTime(0.09, now + 0.5);
        padGain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);

        padOsc.connect(padGain);
        padGain.connect(outputGain);
        padOsc.start(now);
        padOsc.stop(now + 1.9);
        padOsc.onended = () => { padOsc.disconnect(); padGain.disconnect(); };
      }
    }, tempoMs);
  }

  // 4. MAP PREVIEW: Calm, Ambient, Exploratory, Zero Stress
  private startMapPreviewTheme(outputGain: GainNode) {
    if (!this.ctx) return;

    const ambientNotes = [
      329.63, 0, 392.00, 0, 493.88, 0, 392.00, 0,
      293.66, 0, 369.99, 0, 440.00, 0, 369.99, 0,
    ];

    const tempoMs = 380;

    this.musicInterval = setInterval(() => {
      if (!this.ctx || !this.isMusicRunning) return;
      const now = this.ctx.currentTime;
      const step = this.stepIndex;
      this.stepIndex = (this.stepIndex + 1) % ambientNotes.length;

      const note = ambientNotes[step];
      if (note > 0) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(note, now);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.08, now + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

        osc.connect(gain);
        gain.connect(outputGain);

        osc.start(now);
        osc.stop(now + 0.65);
        osc.onended = () => { osc.disconnect(); gain.disconnect(); };
      }
    }, tempoMs);
  }

  // 1. CHARACTER CUSTOMIZATION: Calm, Relaxing, Cozy, Comfortable Workshop (Acoustic Kalimba & Warm Ambient Pad)
  private startStudioTheme(outputGain: GainNode) {
    if (!this.ctx) return;

    // Peaceful, serene acoustic melody in C Major 9 / A Minor 9 / F Major 7 / G6
    const studioKalimbaMelody = [
      // Measure 1: C Major 9 (Gentle rising & falling arpeggio)
      523.25, 0, 659.25, 0, 783.99, 987.77, 783.99, 0,
      // Measure 2: A Minor 9 (Mellow reflective notes)
      440.00, 0, 523.25, 0, 659.25, 783.99, 659.25, 0,
      // Measure 3: F Major 7 (Serene comforting warmth)
      349.23, 0, 440.00, 0, 523.25, 659.25, 523.25, 0,
      // Measure 4: G6 / G Sus (Sweet resolution back to C)
      392.00, 0, 493.88, 0, 587.33, 659.25, 493.88, 0,
    ];

    const studioChords = [
      // Cmaj7 (C3, E3, G3, B3)
      [130.81, 164.81, 196.00, 246.94],
      // Am9 (A2, C3, E3, G3)
      [110.00, 130.81, 164.81, 196.00],
      // Fmaj7 (F2, A2, C3, E3)
      [87.31, 110.00, 130.81, 164.81],
      // G6 (G2, B2, D3, E3)
      [98.00, 123.47, 146.83, 164.81],
    ];

    const tempoMs = 340; // Relaxed ~70 BPM unhurried tempo

    this.musicInterval = setInterval(() => {
      if (!this.ctx || !this.isMusicRunning) return;
      const now = this.ctx.currentTime;
      const step = this.stepIndex;
      this.stepIndex = (this.stepIndex + 1) % studioKalimbaMelody.length;

      const barIndex = Math.floor(step / 8) % studioChords.length;

      // 1. Warm Kalimba Pluck (Soft Sine + Triangle with gentle wooden resonance)
      const noteFreq = studioKalimbaMelody[step];
      if (noteFreq > 0) {
        const osc = this.ctx.createOscillator();
        const noteGain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(noteFreq, now);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1800, now);
        filter.frequency.exponentialRampToValueAtTime(450, now + 0.35);

        noteGain.gain.setValueAtTime(0.001, now);
        noteGain.gain.linearRampToValueAtTime(0.09, now + 0.02);
        noteGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

        osc.connect(filter);
        filter.connect(noteGain);
        noteGain.connect(outputGain);

        osc.start(now);
        osc.stop(now + 0.48);
        osc.onended = () => { osc.disconnect(); noteGain.disconnect(); if (filter) filter.disconnect(); };
      }

      // 2. Lush, Calm Ambient Chord Pad (Swells softly at the start of each 8-step measure)
      if (step % 8 === 0) {
        const chordNotes = studioChords[barIndex];
        chordNotes.forEach((freq) => {
          if (!this.ctx) return;
          const padOsc = this.ctx.createOscillator();
          const padFilter = this.ctx.createBiquadFilter();
          const padGain = this.ctx.createGain();

          padOsc.type = 'sine';
          padOsc.frequency.setValueAtTime(freq * 2, now); // Sweet warm octave

          padFilter.type = 'lowpass';
          padFilter.frequency.setValueAtTime(900, now);

          padGain.gain.setValueAtTime(0.001, now);
          padGain.gain.linearRampToValueAtTime(0.035, now + 0.6); // Slow soothing swell
          padGain.gain.exponentialRampToValueAtTime(0.001, now + 2.6); // Long serene decay

          padOsc.connect(padFilter);
          padFilter.connect(padGain);
          padGain.connect(outputGain);

          padOsc.start(now);
          padOsc.stop(now + 2.7);
          padOsc.onended = () => { padOsc.disconnect(); padGain.disconnect(); if (padFilter) padFilter.disconnect(); };
        });

        // 3. Gentle Acoustic Sub-Bass (Anchors the root note with zero harshness)
        const rootFreq = chordNotes[0];
        const bassOsc = this.ctx.createOscillator();
        const bassGain = this.ctx.createGain();
        bassOsc.type = 'sine';
        bassOsc.frequency.setValueAtTime(rootFreq, now);

        bassGain.gain.setValueAtTime(0.12, now);
        bassGain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

        bassOsc.connect(bassGain);
        bassGain.connect(outputGain);
        bassOsc.start(now);
        bassOsc.stop(now + 1.25);
        bassOsc.onended = () => { bassOsc.disconnect(); bassGain.disconnect(); };

        // 4. Subtle, Dreamy Sparkle Chime Accent on bar 1 and bar 3
        if (step === 0 || step === 16) {
          this.playSubtleChime(outputGain, step === 0 ? 1046.5 : 1318.51, 0.025);
        }
      }
    }, tempoMs);
  }

  // 6. BATTLE THEME: High-Octane Martial Comic Groove (145 BPM feel)
  private startBattleTheme(outputGain: GainNode) {
    if (!this.ctx) return;

    // Driving battle riff in E Minor / A Minor comic rock
    const bassRiff = [
      164.81, 164.81, 196.00, 164.81, 220.00, 164.81, 196.00, 146.83, // E3 - G3 - A3 - D3
      164.81, 164.81, 196.00, 220.00, 246.94, 220.00, 196.00, 164.81, // E3 - B3 - A3 - G3
    ];

    const leadStabs = [
      329.63, 0, 392.00, 0, 440.00, 0, 392.00, 0,
      493.88, 0, 440.00, 0, 392.00, 0, 329.63, 0,
    ];

    const tempoMs = 175; // Fast 145 BPM driving rhythm

    this.musicInterval = setInterval(() => {
      if (!this.ctx || !this.isMusicRunning) return;
      const now = this.ctx.currentTime;
      const step = this.stepIndex;
      this.stepIndex = (this.stepIndex + 1) % bassRiff.length;

      // Heavy Comic Battle Bass
      const bassFreq = bassRiff[step % bassRiff.length];
      const bassOsc = this.ctx.createOscillator();
      const bassFilter = this.ctx.createBiquadFilter();
      const bassGain = this.ctx.createGain();

      bassOsc.type = 'sawtooth';
      bassOsc.frequency.setValueAtTime(bassFreq, now);

      bassFilter.type = 'lowpass';
      bassFilter.frequency.setValueAtTime(1100, now);
      bassFilter.frequency.exponentialRampToValueAtTime(140, now + 0.15);

      bassGain.gain.setValueAtTime(0.17, now);
      bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

      bassOsc.connect(bassFilter);
      bassFilter.connect(bassGain);
      bassGain.connect(outputGain);

      bassOsc.start(now);
      bassOsc.stop(now + 0.17);
      bassOsc.onended = () => { bassOsc.disconnect(); bassGain.disconnect(); if (bassFilter) bassFilter.disconnect(); };

      // Punchy Drum Kick on 0, 4, 8, 12
      if (step % 4 === 0) {
        this.playPunchyDrumKick(outputGain, 0.22);
      }

      // Snare on 2, 6, 10, 14
      if (step % 4 === 2) {
        this.playComicSnare(outputGain, 0.14);
      }

      // Hi-Hat on every step
      this.playHiHatTick(outputGain, step % 2 === 0 ? 0.03 : 0.015);

      // Energetic Brass Lead Stabs
      const leadNote = leadStabs[step % leadStabs.length];
      if (leadNote > 0 && step % 2 === 0) {
        const leadOsc = this.ctx.createOscillator();
        const leadGain = this.ctx.createGain();
        leadOsc.type = 'square';
        leadOsc.frequency.setValueAtTime(leadNote, now);

        leadGain.gain.setValueAtTime(0.08, now);
        leadGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

        leadOsc.connect(leadGain);
        leadGain.connect(outputGain);

        leadOsc.start(now);
        leadOsc.stop(now + 0.14);
        leadOsc.onended = () => { leadOsc.disconnect(); leadGain.disconnect(); };
      }
    }, tempoMs);
  }

  // DYNAMIC BATTLE DANGER LAYER (Health < 35%)
  public setBattleIntensity(isDanger: boolean) {
    if (this.isDangerActive === isDanger) return;
    this.isDangerActive = isDanger;

    if (!this.ctx || !this.isMusicRunning || this.currentTrack !== 'battle') return;

    if (isDanger) {
      // Start rapid tension heartbeat pulse
      if (this.dangerInterval) clearInterval(this.dangerInterval);
      this.dangerInterval = setInterval(() => {
        if (!this.ctx || !this.isDangerActive || !this.trackGainNode) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.1);

        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

        osc.connect(gain);
        gain.connect(this.trackGainNode);
        osc.start(now);
        osc.stop(now + 0.12);
        osc.onended = () => { osc.disconnect(); gain.disconnect(); };
      }, 350);
    } else {
      if (this.dangerInterval) {
        clearInterval(this.dangerInterval);
        this.dangerInterval = null;
      }
    }
  }

  // ==========================================
  // DISTINCT STINGERS: VICTORY vs DEFEAT vs REPLAY
  // ==========================================

  // 1. VICTORY: Ascending, Triumphant, Bright Brass & Chimes ("I Won! Grand Success!")
  public playVictoryFanfare() {
    this.initCtx();
    if (!this.ctx || !this.settings.sfxEnabled) return;

    const now = this.ctx.currentTime;
    // Ascending bright fanfare: C5 -> E5 -> G5 -> C6 (Held) -> E6 Shimmer
    const notes = [
      { freq: 523.25, time: 0.0, dur: 0.14, gain: 0.35 },
      { freq: 659.25, time: 0.13, dur: 0.14, gain: 0.35 },
      { freq: 783.99, time: 0.26, dur: 0.16, gain: 0.4 },
      { freq: 1046.5, time: 0.42, dur: 0.65, gain: 0.5 },
      { freq: 1318.5, time: 0.55, dur: 0.55, gain: 0.3 },
    ];

    notes.forEach(({ freq, time, dur, gain }) => {
      if (!this.ctx || !this.sfxGainNode) return;
      const startTime = now + time;

      const osc = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const noteGain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = 'sawtooth';
      osc2.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);
      osc2.frequency.setValueAtTime(freq * 1.003, startTime);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2400, startTime);

      noteGain.gain.setValueAtTime(0.001, startTime);
      noteGain.gain.linearRampToValueAtTime(gain, startTime + 0.03);
      noteGain.gain.exponentialRampToValueAtTime(0.001, startTime + dur);

      osc.connect(filter);
      osc2.connect(filter);
      filter.connect(noteGain);
      noteGain.connect(this.sfxGainNode);

      osc.start(startTime);
      osc2.start(startTime);
      osc.stop(startTime + dur + 0.05);
      osc.onended = () => { osc.disconnect(); noteGain.disconnect(); if (filter) filter.disconnect(); };
      osc2.stop(startTime + dur + 0.05);
      osc2.onended = () => { osc2.disconnect(); noteGain.disconnect(); if (filter) filter.disconnect(); };
    });
  }

  // 2. DEFEAT: Resilient, Soft Whimsical Descending Chords ("I lost this round, but I'll try again!")
  public playDefeatStinger() {
    this.initCtx();
    if (!this.ctx || !this.settings.sfxEnabled) return;

    const now = this.ctx.currentTime;
    // Descending comic chords with soft warm resolve: G4 -> F4 -> Eb4 -> D4 -> Bb3
    const notes = [
      { freq: 392.00, time: 0.0, dur: 0.22, gain: 0.3 },
      { freq: 349.23, time: 0.18, dur: 0.22, gain: 0.28 },
      { freq: 311.13, time: 0.36, dur: 0.24, gain: 0.25 },
      { freq: 293.66, time: 0.55, dur: 0.35, gain: 0.25 },
      { freq: 233.08, time: 0.72, dur: 0.55, gain: 0.22 },
    ];

    notes.forEach(({ freq, time, dur, gain }) => {
      if (!this.ctx || !this.sfxGainNode) return;
      const startTime = now + time;

      const osc = this.ctx.createOscillator();
      const noteGain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      noteGain.gain.setValueAtTime(0.001, startTime);
      noteGain.gain.linearRampToValueAtTime(gain, startTime + 0.04);
      noteGain.gain.exponentialRampToValueAtTime(0.001, startTime + dur);

      osc.connect(noteGain);
      noteGain.connect(this.sfxGainNode);

      osc.start(startTime);
      osc.stop(startTime + dur + 0.05);
      osc.onended = () => { osc.disconnect(); noteGain.disconnect(); };
    });
  }

  // 3. REPLAY STINGER: Energetic Rising Roll + Ready Gong ("Let's go again!")
  public playReplayStinger() {
    this.initCtx();
    if (!this.ctx || !this.settings.sfxEnabled) return;

    const now = this.ctx.currentTime;

    // Rising drum roll burst
    for (let i = 0; i < 4; i++) {
      const rollTime = now + i * 0.05;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140 + i * 40, rollTime);

      gain.gain.setValueAtTime(0.18 + i * 0.04, rollTime);
      gain.gain.exponentialRampToValueAtTime(0.001, rollTime + 0.06);

      osc.connect(gain);
      gain.connect(this.sfxGainNode!);
      osc.start(rollTime);
      osc.stop(rollTime + 0.07);
      osc.onended = () => { osc.disconnect(); gain.disconnect(); };
    }

    // Bright dual chime strike at the end
    setTimeout(() => {
      if (!this.ctx || !this.sfxGainNode) return;
      const strikeTime = this.ctx.currentTime;
      const chime = this.ctx.createOscillator();
      const chimeGain = this.ctx.createGain();
      chime.type = 'sine';
      chime.frequency.setValueAtTime(880, strikeTime);
      chime.frequency.exponentialRampToValueAtTime(1320, strikeTime + 0.15);

      chimeGain.gain.setValueAtTime(0.35, strikeTime);
      chimeGain.gain.exponentialRampToValueAtTime(0.001, strikeTime + 0.35);

      chime.connect(chimeGain);
      chimeGain.connect(this.sfxGainNode);
      chime.start(strikeTime);
      chime.stop(strikeTime + 0.38);
      chime.onended = () => { chime.disconnect(); chimeGain.disconnect(); };
    }, 220);
  }

  // 4. DRAW / TIE STINGER
  public playTieStinger() {
    this.initCtx();
    if (!this.ctx || !this.settings.sfxEnabled) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.setValueAtTime(415.3, now + 0.25); // Minor neutral resolve

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    osc.connect(gain);
    gain.connect(this.sfxGainNode!);
    osc.start(now);
    osc.stop(now + 0.65);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }

  // ==========================================
  // UI SOUND EFFECTS
  // ==========================================

  // Light, crisp 30ms hover tick
  public playHover() {
    if (!this.settings.sfxEnabled) return;
    this.initCtx();
    if (!this.ctx || !this.sfxGainNode) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.exponentialRampToValueAtTime(1800, now + 0.035);

    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

    osc.connect(gain);
    gain.connect(this.sfxGainNode);
    osc.start(now);
    osc.stop(now + 0.04);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }

  // Crisp satisfying comic click
  public playClick() {
    if (!this.settings.sfxEnabled) return;
    this.initCtx();
    if (!this.ctx || !this.sfxGainNode) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(750, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.06);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc.connect(gain);
    gain.connect(this.sfxGainNode);
    osc.start(now);
    osc.stop(now + 0.07);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }

  // Map Selection Sparkle Chime
  public playMapSelect() {
    if (!this.settings.sfxEnabled) return;
    this.initCtx();
    if (!this.ctx || !this.sfxGainNode) return;

    const now = this.ctx.currentTime;
    [659.25, 987.77].forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const t = now + idx * 0.08;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

      osc.connect(gain);
      gain.connect(this.sfxGainNode!);
      osc.start(t);
      osc.stop(t + 0.25);
      osc.onended = () => { osc.disconnect(); gain.disconnect(); };
    });
  }

  // Character Customization Tap / Pop
  public playCharacterTap() {
    if (!this.settings.sfxEnabled) return;
    this.initCtx();
    if (!this.ctx || !this.sfxGainNode) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(540, now);
    osc.frequency.exponentialRampToValueAtTime(1100, now + 0.08);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(this.sfxGainNode);
    osc.start(now);
    osc.stop(now + 0.09);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }

  // Back / Exit Soft Whoosh
  public playBack() {
    if (!this.settings.sfxEnabled) return;
    this.initCtx();
    if (!this.ctx || !this.sfxGainNode) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(480, now);
    osc.frequency.exponentialRampToValueAtTime(210, now + 0.12);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(this.sfxGainNode);
    osc.start(now);
    osc.stop(now + 0.14);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }

  // Error / Alert Gentle Double Tap
  public playError() {
    if (!this.settings.sfxEnabled) return;
    this.initCtx();
    if (!this.ctx || !this.sfxGainNode) return;

    const now = this.ctx.currentTime;
    [240, 200].forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const t = now + idx * 0.09;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

      osc.connect(gain);
      gain.connect(this.sfxGainNode!);
      osc.start(t);
      osc.stop(t + 0.1);
      osc.onended = () => { osc.disconnect(); };
    });
  }

  // Toggle switch
  public playToggle() {
    this.playClick();
  }

  // Match start power gong
  public playBrawlStart() {
    if (!this.settings.sfxEnabled) return;
    this.initCtx();
    if (!this.ctx || !this.sfxGainNode) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.5);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, now);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGainNode);

    osc.start(now);
    osc.stop(now + 0.6);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); if (filter) filter.disconnect(); };
  }

  // ==========================================
  // GAMEPLAY ACTION SOUNDS
  // ==========================================

  public playFastPunch() {
    if (!this.settings.sfxEnabled) return;
    this.initCtx();
    if (!this.ctx || !this.sfxGainNode) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(360, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.12);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, now);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGainNode);

    osc.start();
    osc.stop(now + 0.14);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); if (filter) filter.disconnect(); };
  }

  public playHeavyHit() {
    if (!this.settings.sfxEnabled) return;
    this.initCtx();
    if (!this.ctx || !this.sfxGainNode) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(35, now + 0.28);

    gain.gain.setValueAtTime(0.55, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.28);

    osc.connect(gain);
    gain.connect(this.sfxGainNode);
    osc.start();
    osc.stop(now + 0.3);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };

    // Comic slap layer
    const slap = this.ctx.createOscillator();
    const slapGain = this.ctx.createGain();
    slap.type = 'square';
    slap.frequency.setValueAtTime(580, now);
    slap.frequency.exponentialRampToValueAtTime(120, now + 0.15);
    slapGain.gain.setValueAtTime(0.3, now);
    slapGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    slap.connect(slapGain);
    slapGain.connect(this.sfxGainNode);
    slap.start();
    slap.stop(now + 0.16);
    slap.onended = () => { slap.disconnect(); slapGain.disconnect(); };
  }

  public playJump() {
    if (!this.settings.sfxEnabled) return;
    this.initCtx();
    if (!this.ctx || !this.sfxGainNode) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(620, now + 0.16);

    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.16);

    osc.connect(gain);
    gain.connect(this.sfxGainNode);

    osc.start();
    osc.stop(now + 0.18);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }

  public playDoubleJump() {
    if (!this.settings.sfxEnabled) return;
    this.initCtx();
    if (!this.ctx || !this.sfxGainNode) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(920, now + 0.14);

    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.14);

    osc.connect(gain);
    gain.connect(this.sfxGainNode);

    osc.start();
    osc.stop(now + 0.16);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }

  public playShieldBlock() {
    if (!this.settings.sfxEnabled) return;
    this.initCtx();
    if (!this.ctx || !this.sfxGainNode) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(840, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.18);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);

    osc.connect(gain);
    gain.connect(this.sfxGainNode);

    osc.start();
    osc.stop(now + 0.2);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }

  public playCountdownBeep(highPitch: boolean = false) {
    if (!this.settings.sfxEnabled) return;
    this.initCtx();
    if (!this.ctx || !this.sfxGainNode) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(highPitch ? 920 : 460, now);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + (highPitch ? 0.4 : 0.18));

    osc.connect(gain);
    gain.connect(this.sfxGainNode);

    osc.start();
    osc.stop(now + (highPitch ? 0.45 : 0.22));
  }

  public playComicPop() {
    if (!this.settings.sfxEnabled) return;
    this.initCtx();
    if (!this.ctx || !this.sfxGainNode) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(620, now);
    osc.frequency.exponentialRampToValueAtTime(1450, now + 0.08);

    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

    osc.connect(gain);
    gain.connect(this.sfxGainNode);

    osc.start();
    osc.stop(now + 0.09);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }

  public playExplosion() {
    if (!this.settings.sfxEnabled) return;
    this.initCtx();
    if (!this.ctx || !this.sfxGainNode) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(25, now + 0.5);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, now);
    filter.frequency.exponentialRampToValueAtTime(80, now + 0.5);

    gain.gain.setValueAtTime(0.65, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGainNode);

    osc.start();
    osc.stop(now + 0.6);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); if (filter) filter.disconnect(); };
  }

  public playWeaponPickup() {
    if (!this.settings.sfxEnabled) return;
    this.initCtx();
    if (!this.ctx || !this.sfxGainNode) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    osc.connect(gain);
    gain.connect(this.sfxGainNode);
    osc.start();
    osc.stop(now + 0.16);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }

  public playWeaponFire(weaponType?: string) {
    if (!this.settings.sfxEnabled) return;
    this.initCtx();
    if (!this.ctx || !this.sfxGainNode) return;

    const now = this.ctx.currentTime;

    switch (weaponType) {
      case 'pebble_blaster': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(200, now + 0.08);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
        osc.connect(gain);
        gain.connect(this.sfxGainNode);
        osc.start();
        osc.stop(now + 0.09);
        osc.onended = () => { osc.disconnect(); gain.disconnect(); };
        break;
      }
      case 'pistol': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.12);
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
        osc.connect(gain);
        gain.connect(this.sfxGainNode);
        osc.start();
        osc.stop(now + 0.13);
        osc.onended = () => { osc.disconnect(); gain.disconnect(); };
        break;
      }
      case 'burst_smg': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(520, now);
        osc.frequency.exponentialRampToValueAtTime(140, now + 0.06);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);
        osc.connect(gain);
        gain.connect(this.sfxGainNode);
        osc.start();
        osc.stop(now + 0.07);
        osc.onended = () => { osc.disconnect(); gain.disconnect(); };
        break;
      }
      case 'shotgun': {
        this.playHeavyHit();
        break;
      }
      case 'rifle': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(900, now);
        osc.frequency.exponentialRampToValueAtTime(120, now + 0.2);
        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.connect(gain);
        gain.connect(this.sfxGainNode);
        osc.start();
        osc.stop(now + 0.22);
        osc.onended = () => { osc.disconnect(); gain.disconnect(); };
        break;
      }
      case 'flame_gun':
      case 'inferno_cannon': {
        // Massive Roaring Flamethrower / Fire Combustion Blast (Real Noise + Sub-Bass Roar)
        const duration = weaponType === 'inferno_cannon' ? 0.35 : 0.18;
        const noise = this.ctx.createBufferSource();
        if (this.cachedWhiteNoiseBuffer) {
          noise.buffer = this.cachedWhiteNoiseBuffer;
          noise.loop = true;
        }

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(weaponType === 'inferno_cannon' ? 1000 : 700, now);
        filter.frequency.exponentialRampToValueAtTime(180, now + duration);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(weaponType === 'inferno_cannon' ? 0.70 : 0.40, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGainNode);
        noise.start(now);
        noise.stop(now + duration);
        noise.onended = () => { noise.disconnect(); gain.disconnect(); filter.disconnect(); };

        // Deep Sub-Bass Combustion Pulse Layer
        const thud = this.ctx.createOscillator();
        const thudGain = this.ctx.createGain();
        thud.type = 'triangle';
        thud.frequency.setValueAtTime(160, now);
        thud.frequency.exponentialRampToValueAtTime(40, now + duration);
        thudGain.gain.setValueAtTime(weaponType === 'inferno_cannon' ? 0.55 : 0.30, now);
        thudGain.gain.exponentialRampToValueAtTime(0.01, now + duration);

        thud.connect(thudGain);
        thudGain.connect(this.sfxGainNode);
        thud.start(now);
        thud.stop(now + duration);
        thud.onended = () => { thud.disconnect(); thudGain.disconnect(); };
        break;
      }
      case 'thunder_sword': {
        // Supersonic Lightning Strike + Thunder Crack + Electric Discharge
        const duration = 0.45;
        // 1. Supersonic High-Pitch Lightning Snap / Crack (Filtered Noise Transient)
        const snapLen = 0.05;
        const snap = this.ctx.createBufferSource();
        if (this.cachedWhiteNoiseBuffer) {
          snap.buffer = this.cachedWhiteNoiseBuffer;
          snap.loop = true;
        }

        const snapFilter = this.ctx.createBiquadFilter();
        snapFilter.type = 'highpass';
        snapFilter.frequency.setValueAtTime(2800, now);

        const snapGain = this.ctx.createGain();
        snapGain.gain.setValueAtTime(0.85, now);
        snapGain.gain.exponentialRampToValueAtTime(0.01, now + snapLen);

        snap.connect(snapFilter);
        snapFilter.connect(snapGain);
        snapGain.connect(this.sfxGainNode);
        snap.start(now);
        snap.stop(now + snapLen);
        snap.onended = () => { snap.disconnect(); snapGain.disconnect(); snapFilter.disconnect(); };

        // 2. Deep Atmospheric Thunder Boom Impact
        const thunder = this.ctx.createOscillator();
        const thunderFilter = this.ctx.createBiquadFilter();
        const thunderGain = this.ctx.createGain();

        thunder.type = 'sine';
        thunder.frequency.setValueAtTime(240, now);
        thunder.frequency.exponentialRampToValueAtTime(25, now + duration);

        thunderFilter.type = 'lowpass';
        thunderFilter.frequency.setValueAtTime(1800, now);
        thunderFilter.frequency.exponentialRampToValueAtTime(70, now + duration);

        thunderGain.gain.setValueAtTime(0.85, now);
        thunderGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        thunder.connect(thunderFilter);
        thunderFilter.connect(thunderGain);
        thunderGain.connect(this.sfxGainNode);
        thunder.start(now);
        thunder.stop(now + duration);
        thunder.onended = () => { thunder.disconnect(); thunderGain.disconnect(); if (thunderFilter) thunderFilter.disconnect(); };

        // 3. Electric Spark Zing Modulation
        const spark = this.ctx.createOscillator();
        const sparkGain = this.ctx.createGain();
        spark.type = 'sawtooth';
        spark.frequency.setValueAtTime(2600, now);
        spark.frequency.exponentialRampToValueAtTime(450, now + 0.16);
        sparkGain.gain.setValueAtTime(0.35, now);
        sparkGain.gain.exponentialRampToValueAtTime(0.01, now + 0.16);

        spark.connect(sparkGain);
        sparkGain.connect(this.sfxGainNode);
        spark.start(now);
        spark.stop(now + 0.16);
        spark.onended = () => { spark.disconnect(); sparkGain.disconnect(); };
        break;
      }
      default: {
        this.playFastPunch();
      }
    }
  }

  // Helpers for procedural drum & chime accents
  private playSubtleChime(output: GainNode, freq: number, vol: number) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.connect(gain);
    gain.connect(output);
    osc.start(now);
    osc.stop(now + 0.32);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }

  private playWoodblockTick(output: GainNode, vol: number) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(800, now);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(gain);
    gain.connect(output);
    osc.start(now);
    osc.stop(now + 0.06);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }

  private playPunchyDrumKick(output: GainNode, vol: number) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.12);

    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc.connect(gain);
    gain.connect(output);
    osc.start(now);
    osc.stop(now + 0.15);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }

  private playComicSnare(output: GainNode, vol: number) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.09);

    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(gain);
    gain.connect(output);
    osc.start(now);
    osc.stop(now + 0.11);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }

  private playHiHatTick(output: GainNode, vol: number) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(8000, now);

    filter.type = 'highpass';
    filter.frequency.setValueAtTime(7000, now);

    gain.gain.setValueAtTime(vol * 0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(output);
    osc.start(now);
    osc.stop(now + 0.035);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); if (filter) filter.disconnect(); };
  }
}

export const sound = new SoundEngine();
