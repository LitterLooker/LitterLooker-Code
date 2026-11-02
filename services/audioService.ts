/**
 * AudioService is a lightweight, responsive, client-side Web Audio API synthesizer.
 * It provides custom-designed, retro-modern sound effects without requiring heavy audio assets,
 * and respects the user's enabled/volume audio settings.
 */

class AudioService {
  private enabled: boolean = true;
  private volume: number = 0.5;
  private audioCtx: AudioContext | null = null;

  private audioBuffer: AudioBuffer | null = null;
  private currentSourceNode: AudioBufferSourceNode | null = null;
  private bgGainNode: GainNode | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;

  private bgMusicEnabled: boolean = false;
  private bgMusicVolume: number = 0.3;
  private isBgPlaying: boolean = false;
  private isFetchingBg: boolean = false;

  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  public setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
  }

  public setBgMusicEnabled(enabled: boolean) {
    this.bgMusicEnabled = enabled;
    if (enabled) {
      this.playBgMusic();
    } else {
      this.pauseBgMusic();
    }
  }

  public setBgMusicVolume(volume: number) {
    this.bgMusicVolume = Math.max(0, Math.min(1, volume));
    if (this.bgGainNode && this.audioCtx) {
      this.bgGainNode.gain.setTargetAtTime(this.bgMusicVolume * 0.5, this.audioCtx.currentTime, 0.05);
    }
  }

  private handleUserGesture = () => {
    if (this.bgMusicEnabled && !this.isBgPlaying) {
      this.playBgMusic();
    }
  };

  private getMasterDestination(ctx: AudioContext): AudioNode {
    if (!this.compressor) {
      try {
        this.compressor = ctx.createDynamicsCompressor();
        this.compressor.threshold.setValueAtTime(-14, ctx.currentTime);
        this.compressor.knee.setValueAtTime(4, ctx.currentTime);
        this.compressor.ratio.setValueAtTime(12, ctx.currentTime);
        this.compressor.attack.setValueAtTime(0.003, ctx.currentTime);
        this.compressor.release.setValueAtTime(0.25, ctx.currentTime);

        this.masterGain = ctx.createGain();
        this.masterGain.gain.setValueAtTime(1.0, ctx.currentTime);

        this.masterGain.connect(this.compressor);
        this.compressor.connect(ctx.destination);
      } catch (e) {
        return ctx.destination;
      }
    }
    return this.masterGain || ctx.destination;
  }

  public async playBgMusic() {
    if (!this.bgMusicEnabled) return;
    if (this.isBgPlaying) return;
    
    const ctx = this.initContext();
    if (!ctx) return;

    if (!this.audioBuffer) {
      if (this.isFetchingBg) return;
      this.isFetchingBg = true;
      try {
        const response = await fetch('/newLobbyBG.mp3');
        const arrayBuffer = await response.arrayBuffer();
        this.audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      } catch (e) {
        console.warn('Failed to load ambient background audio buffer:', e);
        window.addEventListener('click', this.handleUserGesture, { once: true });
        window.addEventListener('touchstart', this.handleUserGesture, { once: true });
        window.addEventListener('keydown', this.handleUserGesture, { once: true });
        return;
      } finally {
        this.isFetchingBg = false;
      }
    }

    if (!this.bgMusicEnabled) return;
    if (this.isBgPlaying) return;

    if (this.audioBuffer) {
      try {
        if (ctx.state === 'suspended') {
          await ctx.resume();
        }
        
        if (this.currentSourceNode) {
          try {
            this.currentSourceNode.stop();
            this.currentSourceNode.disconnect();
          } catch (e) {}
          this.currentSourceNode = null;
        }

        const source = ctx.createBufferSource();
        source.buffer = this.audioBuffer;
        source.loop = true;

        if (!this.bgGainNode) {
          this.bgGainNode = ctx.createGain();
        }
        this.bgGainNode.gain.setValueAtTime(0, ctx.currentTime);
        this.bgGainNode.gain.linearRampToValueAtTime(this.bgMusicVolume * 0.5, ctx.currentTime + 0.1);

        source.connect(this.bgGainNode);
        this.bgGainNode.connect(this.getMasterDestination(ctx));

        source.start(0);
        this.currentSourceNode = source;
        this.isBgPlaying = true;

        source.onended = () => {
          if (this.currentSourceNode === source) {
            this.isBgPlaying = false;
          }
        };
      } catch (e) {
        console.warn('Background audio playback blocked or error:', e);
        window.addEventListener('click', this.handleUserGesture, { once: true });
        window.addEventListener('touchstart', this.handleUserGesture, { once: true });
        window.addEventListener('keydown', this.handleUserGesture, { once: true });
      }
    } else if (ctx.state === 'suspended') {
      window.addEventListener('click', this.handleUserGesture, { once: true });
      window.addEventListener('touchstart', this.handleUserGesture, { once: true });
      window.addEventListener('keydown', this.handleUserGesture, { once: true });
    }
  }

  public pauseBgMusic() {
    if (this.currentSourceNode) {
      try {
        this.currentSourceNode.stop();
        this.currentSourceNode.disconnect();
      } catch (e) {}
      this.currentSourceNode = null;
    }
    this.isBgPlaying = false;
  }

  private initContext(): AudioContext | null {
    try {
      if (!this.audioCtx) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) return null;
        this.audioCtx = new AudioContextClass();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      return this.audioCtx;
    } catch (e) {
      console.warn('Web Audio API not supported or blocked:', e);
      return null;
    }
  }

  /**
   * Play a clean tap / click sound
   */
  public playClick() {
    if (!this.enabled || this.volume <= 0) return;
    const ctx = this.initContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = 'sine';
    // Fast frequency sweep for a crisp tap
    osc.frequency.setValueAtTime(450, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.08);

    // Fast volume envelope with smooth start
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(Math.min(0.2, this.volume * 0.25), ctx.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08);

    osc.connect(gainNode);
    gainNode.connect(this.getMasterDestination(ctx));

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.09);
  }

  /**
   * Play a bubble / pop sound (excellent for UI selections, toggles, submenus)
   */
  public playPop() {
    if (!this.enabled || this.volume <= 0) return;
    const ctx = this.initContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = 'sine';
    // Bubble-like sweep upwards
    osc.frequency.setValueAtTime(120, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(550, ctx.currentTime + 0.12);

    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(Math.min(0.25, this.volume * 0.3), ctx.currentTime + 0.015);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);

    osc.connect(gainNode);
    gainNode.connect(this.getMasterDestination(ctx));

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.13);
  }

  /**
   * Play a clean / swipe upward sound (perfect for clearing trash, resolving a pin)
   */
  public playClean() {
    if (!this.enabled || this.volume <= 0) return;
    const ctx = this.initContext();
    if (!ctx) return;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(300, ctx.currentTime);
    osc1.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.25);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(600, ctx.currentTime);
    osc2.frequency.exponentialRampToValueAtTime(1800, ctx.currentTime + 0.25);

    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(Math.min(0.2, this.volume * 0.25), ctx.currentTime + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(this.getMasterDestination(ctx));

    osc1.start(ctx.currentTime);
    osc2.start(ctx.currentTime);
    
    osc1.stop(ctx.currentTime + 0.26);
    osc2.stop(ctx.currentTime + 0.26);
  }

  /**
   * Play a bright positive major success chime (perfect for completing challenges, quests, adding pins)
   */
  public playSuccess() {
    if (!this.enabled || this.volume <= 0) return;
    const ctx = this.initContext();
    if (!ctx) return;

    const playNote = (freq: number, start: number, duration: number, volMultiplier = 1.0) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(Math.min(0.2, this.volume * 0.2 * volMultiplier), start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      
      osc.connect(gain);
      gain.connect(this.getMasterDestination(ctx));
      
      osc.start(start);
      osc.stop(start + duration + 0.02);
    };

    const now = ctx.currentTime;
    // C major chord: C5 -> E5 -> G5 -> C6
    playNote(523.25, now, 0.3, 0.8);
    playNote(659.25, now + 0.08, 0.3, 0.8);
    playNote(783.99, now + 0.16, 0.3, 0.8);
    playNote(1046.50, now + 0.24, 0.4, 0.9);
  }

  /**
   * Play a celebratory mega fan-fare chord progression (perfect for leveling up or buying shop rewards)
   */
  public playLevelUp() {
    if (!this.enabled || this.volume <= 0) return;
    const ctx = this.initContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    
    const playNote = (freq: number, start: number, duration: number, type: 'sine'|'triangle'|'sawtooth' = 'sine') => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = type;
      osc.frequency.setValueAtTime(freq, start);
      osc.frequency.linearRampToValueAtTime(freq * 1.01, start + duration);
      
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(Math.min(0.18, this.volume * 0.2), start + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      
      osc.connect(gain);
      gain.connect(this.getMasterDestination(ctx));
      
      osc.start(start);
      osc.stop(start + duration + 0.05);
    };

    // Upward sweep chord
    playNote(261.63, now, 0.8, 'triangle'); // C4
    playNote(329.63, now + 0.08, 0.8, 'triangle'); // E4
    playNote(392.00, now + 0.16, 0.8, 'triangle'); // G4
    playNote(523.25, now + 0.24, 0.8, 'sine'); // C5
    playNote(659.25, now + 0.32, 1.2, 'sine'); // E5
    playNote(1046.50, now + 0.40, 1.4, 'sine'); // C6
  }

  /**
   * Play a warning / error buzz (for invalid inputs, limits, warning screens)
   */
  public playWarning() {
    if (!this.enabled || this.volume <= 0) return;
    const ctx = this.initContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    const playBuzz = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, start);
      
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(Math.min(0.12, this.volume * 0.12), start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(700, start);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.getMasterDestination(ctx));
      
      osc.start(start);
      osc.stop(start + duration + 0.02);
    };

    playBuzz(130.81, now, 0.12); // C3
    playBuzz(110.00, now + 0.14, 0.18); // A2
  }

  /**
   * Play a gentle, calm pinging sound (for standard notifications)
   */
  public playCalmPing() {
    if (!this.enabled || this.volume <= 0) return;
    const ctx = this.initContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1760, now + 0.15);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(Math.min(0.18, this.volume * 0.2), now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);

    osc.connect(gain);
    gain.connect(this.getMasterDestination(ctx));

    osc.start(now);
    osc.stop(now + 0.32);
  }
}

export const audioService = new AudioService();
