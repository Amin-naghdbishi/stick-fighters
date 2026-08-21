// Procedural Web Audio Sound & Music Engine for Stick Fighters
// Custom synthesizers for cartoon/epic adventure themes, dynamic battle tracks, and responsive SFX.

export type MusicTrack = 'menu' | 'lobby' | 'map_select' | 'map_preview' | 'studio' | 'battle';

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
  private isMusicRunning: boolean = false;
  private musicInterval: any = null;
  private musicActiveNodes: (AudioNode | number)[] = [];
  private trackGainNode: GainNode | null = null;

  // Battle danger layer
  private isDangerActive: boolean = false;
  private dangerGainNode: GainNode | null = null;
  private dangerInterval: any = null;

  // Track step pointers
  private stepIndex: number = 0;

  constructor() {
    this.loadSettings();
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

        this.applyGains();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
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
    this.initCtx();
    if (!this.ctx || !this.musicGainNode) return;

    // If same track is already playing, keep it going
    if (this.currentTrack === track && this.isMusicRunning) {
      return;
    }

    this.currentTrack = track;

    if (!this.settings.musicEnabled) {
      return;
    }

    // Stop current track with quick fade-out
    this.stopMusic(true);

    this.isMusicRunning = true;
    this.stepIndex = 0;

    // Create a sub-gain for this track to handle fade-in
    const trackGain = this.ctx.createGain();
    const now = this.ctx.currentTime;
    trackGain.gain.setValueAtTime(0, now);
    trackGain.gain.linearRampToValueAtTime(1, now + 0.35); // 350ms smooth fade in
    trackGain.connect(this.musicGainNode);
    this.trackGainNode = trackGain;

    // Launch specific procedural track generator
    switch (track) {
      case 'menu':
        this.startMenuTheme(trackGain);
        break;
      case 'lobby':
        this.startLobbyTheme(trackGain);
        break;
      case 'map_select':
        this.startMapSelectTheme(trackGain);
        break;
      case 'map_preview':
        this.startMapPreviewTheme(trackGain);
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

    if (this.trackGainNode && this.ctx) {
      if (fade) {
        const now = this.ctx.currentTime;
        try {
          this.trackGainNode.gain.cancelScheduledValues(now);
          this.trackGainNode.gain.setValueAtTime(this.trackGainNode.gain.value, now);
          this.trackGainNode.gain.linearRampToValueAtTime(0.001, now + 0.3);
        } catch (e) {
          // ignore
        }
      }
      const oldGain = this.trackGainNode;
      setTimeout(() => {
        try {
          oldGain.disconnect();
        } catch (e) {}
      }, fade ? 350 : 50);
      this.trackGainNode = null;
    }

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
        osc2.stop(now + 0.36);
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
      }
    }, tempoMs);
  }

  // 5. CHARACTER STUDIO: Relaxing, Whimsical, Creative Workshop (Marimba / Kalimba Style)
  private startStudioTheme(outputGain: GainNode) {
    if (!this.ctx) return;

    // Playful, cheerful, cute workshop melody
    const studioNotes = [
      523.25, 0, 587.33, 659.25, 0, 523.25, 0, 659.25,
      783.99, 0, 659.25, 0, 587.33, 523.25, 587.33, 0,
      440.00, 0, 523.25, 659.25, 0, 440.00, 0, 523.25,
      587.33, 0, 523.25, 0, 440.00, 392.00, 440.00, 0,
    ];

    const studioBass = [
      261.63, 261.63, 329.63, 392.00, // C
      220.00, 220.00, 261.63, 329.63, // Am
    ];

    const tempoMs = 230;

    this.musicInterval = setInterval(() => {
      if (!this.ctx || !this.isMusicRunning) return;
      const now = this.ctx.currentTime;
      const step = this.stepIndex;
      this.stepIndex = (this.stepIndex + 1) % studioNotes.length;

      const note = studioNotes[step];
      if (note > 0) {
        // Warm wooden kalimba pluck (sine + quick triangle harmonic)
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(note, now);

        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

        osc.connect(gain);
        gain.connect(outputGain);

        osc.start(now);
        osc.stop(now + 0.24);
      }

      // Gentle acoustic bass note every 4 beats
      if (step % 4 === 0) {
        const bassNote = studioBass[Math.floor(step / 4) % studioBass.length];
        const bassOsc = this.ctx.createOscillator();
        const bassGain = this.ctx.createGain();
        bassOsc.type = 'sine';
        bassOsc.frequency.setValueAtTime(bassNote / 2, now);

        bassGain.gain.setValueAtTime(0.14, now);
        bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

        bassOsc.connect(bassGain);
        bassGain.connect(outputGain);
        bassOsc.start(now);
        bassOsc.stop(now + 0.42);
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
      osc2.stop(startTime + dur + 0.05);
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
        break;
      }
      case 'flame_gun': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.linearRampToValueAtTime(120, now + 0.15);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.connect(gain);
        gain.connect(this.sfxGainNode);
        osc.start();
        osc.stop(now + 0.16);
        break;
      }
      case 'grenade_launcher':
      case 'heavy_cannon': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.25);
        gain.gain.setValueAtTime(0.6, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
        osc.connect(gain);
        gain.connect(this.sfxGainNode);
        osc.start();
        osc.stop(now + 0.26);
        break;
      }
      case 'rocket_launcher': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(60, now + 0.35);
        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
        osc.connect(gain);
        gain.connect(this.sfxGainNode);
        osc.start();
        osc.stop(now + 0.36);
        break;
      }
      case 'railgun': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(1200, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.3);
        gain.gain.setValueAtTime(0.6, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.connect(gain);
        gain.connect(this.sfxGainNode);
        osc.start();
        osc.stop(now + 0.32);
        break;
      }
      case 'infinite_gun': {
        // Heavy Metallic Machine Gun Rotary Snap (Short, punchy, per-shot)
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(750, now);
        osc.frequency.exponentialRampToValueAtTime(120, now + 0.05);
        gain.gain.setValueAtTime(0.45, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
        osc.connect(gain);
        gain.connect(this.sfxGainNode);
        osc.start(now);
        osc.stop(now + 0.06);

        // Bass thud
        const thud = this.ctx.createOscillator();
        const thudGain = this.ctx.createGain();
        thud.type = 'triangle';
        thud.frequency.setValueAtTime(220, now);
        thud.frequency.exponentialRampToValueAtTime(50, now + 0.05);
        thudGain.gain.setValueAtTime(0.35, now);
        thudGain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
        thud.connect(thudGain);
        thudGain.connect(this.sfxGainNode);
        thud.start(now);
        thud.stop(now + 0.06);
        break;
      }
      case 'thunder_sword': {
        // Thunder Lightning Boom
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(45, now + 0.4);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(3000, now);
        filter.frequency.exponentialRampToValueAtTime(150, now + 0.4);

        gain.gain.setValueAtTime(0.7, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGainNode);
        osc.start(now);
        osc.stop(now + 0.45);

        // Electric Spark Zing Layer
        const spark = this.ctx.createOscillator();
        const sparkGain = this.ctx.createGain();
        spark.type = 'square';
        spark.frequency.setValueAtTime(1600, now);
        spark.frequency.exponentialRampToValueAtTime(300, now + 0.2);
        sparkGain.gain.setValueAtTime(0.3, now);
        sparkGain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        spark.connect(sparkGain);
        sparkGain.connect(this.sfxGainNode);
        spark.start(now);
        spark.stop(now + 0.22);
        break;
      }
      case 'inferno_cannon': {
        // Massive Dragon Flame Roar
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(240, now);
        osc.frequency.linearRampToValueAtTime(80, now + 0.25);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1200, now);
        filter.frequency.exponentialRampToValueAtTime(200, now + 0.25);

        gain.gain.setValueAtTime(0.55, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGainNode);
        osc.start(now);
        osc.stop(now + 0.26);
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
  }

  private playHiHatTick(output: GainNode, vol: number) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'highpass' as any; // fallback
    osc.frequency.setValueAtTime(1200, now);

    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

    osc.connect(gain);
    gain.connect(output);
    osc.start(now);
    osc.stop(now + 0.035);
  }
}

export const sound = new SoundEngine();
