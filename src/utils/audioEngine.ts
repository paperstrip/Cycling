/**
 * Advanced Humanized Audio Engine with Authentic Radio Tour / DS Earpiece Ambience
 * - Real-time Web Audio DSP: Bandpass radio filter (350Hz-3.2kHz), nasal mic resonance, preamp drive
 * - Analog Continuous Carrier Hiss & Cockpit Drone: Plays behind the coach voice for authentic transmission feel
 * - Motorola PTT Switch Clicks & Radio Tour Official Chimes
 * - Instant zero-latency speech handling on iOS Safari and Desktop
 * - Dual Engine: Instant Browser Speech & Gemini Studio HD Neural Voice
 */

import { VoiceSettings, CoachPersona, IntensityZone, RadioAmbienceStyle, VoiceEngineMode } from '../types';
import { getStoredVoiceSettings, saveStoredVoiceSettings, DEFAULT_VOICE_SETTINGS } from './profileStorage';

import { hasApiKey } from './apiKey';
import { synthesizeSpeech } from './geminiClient';
import { clipKey, getCachedClip, putCachedClip, voiceNameForPersona } from './voiceCache';

/** WAV silencieux de 100 ms, utilisé pour ouvrir la session audio média sur iOS. */
const SILENT_WAV_DATA_URI =
  'data:audio/wav;base64,UklGRmQGAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YUAGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

/**
 * Transforms technical cycling text into natural, spoken French with human rhythm
 */
export function normalizeTextForSpeech(rawText: string): string {
  if (!rawText) return '';

  let text = rawText;

  // 1. Remove quotes or brackets
  text = text.replace(/^["']|["']$/g, '').trim();

  // 2. Expand common cycling abbreviations & units into natural spoken French
  text = text
    .replace(/(\d+)\s*km\/h\b/gi, '$1 kilomètres-heure')
    .replace(/(\d+)\s*km\b/gi, '$1 kilomètres')
    .replace(/(\d+)\s*rpm\b/gi, '$1 tours par minute')
    .replace(/(\d+)\s*bpm\b/gi, '$1 battements par minute')
    .replace(/(\d+)\s*watts?\b/gi, '$1 watts')
    .replace(/(\d+)\s*w\b/gi, '$1 watts')
    .replace(/(\d+)\s*m\b(?!\w)/gi, '$1 mètres');

  // 3. Expand interval notations
  text = text
    .replace(/\b(\d+)\s*x\s*\(?(\d+)['’](?:\s*\/\s*(\d+)['’])?\)?/gi, (match, rep, dur1, dur2) => {
      if (dur2) {
        return `${rep} séries de ${dur1} minutes avec ${dur2} minutes de récupération`;
      }
      return `${rep} séries de ${dur1} minutes`;
    })
    .replace(/\b(\d+)['’](\d{2})["”]?\b/g, '$1 minutes $2')
    .replace(/\b(\d+)['’]\b/g, '$1 minutes')
    .replace(/\b(\d+)\s*min\b/gi, '$1 minutes')
    .replace(/\b(\d+)\s*sec\b/gi, '$1 secondes')
    .replace(/\b(\d+)\s*s\b(?!\w)/gi, '$1 secondes')
    .replace(/\b30\/30\b/g, 'trente trente')
    .replace(/\b40\/20\b/g, 'quarante vingt')
    .replace(/\b15\/15\b/g, 'quinze quinze');

  // 4. Expand physiological abbreviations
  text = text
    .replace(/\bVO2max\b/gi, 'V O 2 max')
    .replace(/\bVO2\b/gi, 'V O 2')
    .replace(/\bPMA\b/g, 'P M A')
    .replace(/\bFTP\b/g, 'F T P')
    .replace(/\bTSS\b/g, 'T S S')
    .replace(/\bZ1\b/g, 'Zone 1 de récupération')
    .replace(/\bZ2\b/g, 'Zone 2 d\'endurance')
    .replace(/\bZ3\b/g, 'Zone 3 tempo')
    .replace(/\bZ4\b/g, 'Zone 4 au seuil')
    .replace(/\bZ5\b/g, 'Zone 5 à PMA')
    .replace(/\bZ6\b/g, 'Zone 6 anaérobie')
    .replace(/\bZ7\b/g, 'Zone 7 sprint maximal')
    .replace(/\bSweetSpot\b/gi, 'Sweet Spot');

  // 5. Add micro-breathing pauses around exclamations and transitions
  text = text
    .replace(/!+/g, ' ! ')
    .replace(/\?+/g, ' ? ')
    .replace(/\s+/g, ' ')
    .trim();

  return text;
}

class HumanizedAudioEngine {
  private isMuted: boolean = false;
  private audioCtx: AudioContext | null = null;
  private isUnlocked: boolean = false;
  private settings: VoiceSettings = getStoredVoiceSettings();
  private cachedVoices: SpeechSynthesisVoice[] = [];
  private selectedVoice: SpeechSynthesisVoice | null = null;
  private isSpeaking: boolean = false;
  private currentSourceNode: AudioBufferSourceNode | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private audioBufferCache: Map<string, AudioBuffer> = new Map();
  private activeUtteranceRef: any = null; // Prevents Chrome GC bug

  // Active continuous radio carrier nodes
  private activeCarrierNodes: {
    noiseSource?: AudioBufferSourceNode;
    humOsc?: OscillatorNode;
    gainNode?: GainNode;
  } | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      if ('speechSynthesis' in window) {
        this.refreshVoices();
        window.speechSynthesis.onvoiceschanged = () => {
          this.refreshVoices();
        };

        // Aggressively poll voices during the first 2 seconds on Chrome/Safari
        let voiceChecks = 0;
        const voiceInterval = setInterval(() => {
          voiceChecks++;
          const voices = this.refreshVoices();
          if (voices.length > 0 || voiceChecks > 20) {
            clearInterval(voiceInterval);
          }
        }, 100);
      }

      const handleTouch = () => {
        this.unlockAudio();
        window.removeEventListener('click', handleTouch);
        window.removeEventListener('touchstart', handleTouch);
      };
      window.addEventListener('click', handleTouch, { once: true });
      window.addEventListener('touchstart', handleTouch, { once: true });
    }
  }

  /** Mémorise un buffer décodé, en bornant le cache mémoire. */
  private rememberBuffer(key: string, buffer: AudioBuffer) {
    if (this.audioBufferCache.size > 60) {
      const firstKey = this.audioBufferCache.keys().next().value;
      if (firstKey) this.audioBufferCache.delete(firstKey);
    }
    this.audioBufferCache.set(key, buffer);
  }

  public getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        try {
          this.audioCtx = new AudioContextClass();
        } catch (e) {
          try {
            this.audioCtx = new AudioContextClass({ sampleRate: 24000 });
          } catch (e2) {
            console.error('AudioContext creation error:', e2);
          }
        }
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  /**
   * Refreshes and sorts French voices based on natural quality and persona appropriateness
   */
  public refreshVoices(): SpeechSynthesisVoice[] {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
    const allVoices = window.speechSynthesis.getVoices() || [];

    if (allVoices.length === 0) return [];

    // Filter strictly for French voices across locales (fr-FR, fr-BE, fr-CA, fr-CH, fr)
    let frVoices = allVoices.filter(
      (v) =>
        v.lang.toLowerCase().startsWith('fr') ||
        v.lang.toLowerCase().includes('fr-') ||
        v.name.toLowerCase().includes('french') ||
        v.name.toLowerCase().includes('français')
    );

    // Fallback if no explicit French tag is found (e.g. specialized system voices)
    if (frVoices.length === 0) {
      frVoices = allVoices;
    }

    const scoreVoice = (v: SpeechSynthesisVoice): number => {
      let score = 0;
      const name = v.name.toLowerCase();
      const lang = v.lang.toLowerCase();

      // Highest bonus for modern neural / natural voices
      if (name.includes('natural') || name.includes('naturelle')) score += 120;
      if (name.includes('online') || name.includes('en ligne')) score += 90;
      if (name.includes('enhanced') || name.includes('améliorée')) score += 80;
      if (name.includes('premium') || name.includes('haute qualité')) score += 75;
      if (name.includes('google')) score += 65;
      if (name.includes('siri')) score += 60;
      if (name.includes('microsoft')) score += 55;
      if (name.includes('apple')) score += 45;

      // Known high quality French voices on macOS, iOS, Windows, Android
      if (
        name.includes('thomas') ||
        name.includes('audrey') ||
        name.includes('aurelie') ||
        name.includes('aurélie') ||
        name.includes('denise') ||
        name.includes('henri') ||
        name.includes('paul') ||
        name.includes('amelie') ||
        name.includes('amélie') ||
        name.includes('julie') ||
        name.includes('bastien') ||
        name.includes('mathieu') ||
        name.includes('celine') ||
        name.includes('céline')
      ) {
        score += 50;
      }

      // Penalize known robotic/synthetic compact legacy voices
      if (name.includes('compact') || name.includes('espeak')) {
        score -= 50;
      }

      if (lang === 'fr-fr' || lang === 'fr_fr') score += 25;
      else if (lang.startsWith('fr')) score += 15;

      return score;
    };

    frVoices.sort((a, b) => scoreVoice(b) - scoreVoice(a));
    this.cachedVoices = frVoices;

    if (this.settings.voiceURI) {
      const match = frVoices.find((v) => v.voiceURI === this.settings.voiceURI);
      if (match) {
        this.selectedVoice = match;
        return frVoices;
      }
    }

    this.selectedVoice = frVoices[0] || null;
    return frVoices;
  }

  /**
   * Selects the best specific French voice matching the active persona
   */
  public getBestFrenchVoiceForPersona(persona: CoachPersona): SpeechSynthesisVoice | null {
    const voices = this.getAvailableFrenchVoices();
    if (voices.length === 0) return null;

    if (this.settings.voiceURI) {
      const customMatch = voices.find((v) => v.voiceURI === this.settings.voiceURI);
      if (customMatch) return customMatch;
    }

    const isFemalePersona = persona === 'emilie_punchy';

    if (isFemalePersona) {
      // Find highest ranked female French voice
      const femaleKeywords = ['audrey', 'aurelie', 'aurélie', 'denise', 'amelie', 'amélie', 'julie', 'celine', 'céline', 'female', 'femme', 'virginie', 'hortense'];
      const femaleMatch = voices.find((v) => {
        const name = v.name.toLowerCase();
        return femaleKeywords.some((kw) => name.includes(kw));
      });
      if (femaleMatch) return femaleMatch;
    } else {
      // Find highest ranked male French voice
      const maleKeywords = ['thomas', 'henri', 'paul', 'bastien', 'mathieu', 'male', 'homme', 'nicolas', 'alain'];
      const maleMatch = voices.find((v) => {
        const name = v.name.toLowerCase();
        return maleKeywords.some((kw) => name.includes(kw));
      });
      if (maleMatch) return maleMatch;
    }

    // Default to the highest scored French voice
    return voices[0] || null;
  }

  public getAvailableFrenchVoices(): SpeechSynthesisVoice[] {
    if (this.cachedVoices.length === 0) {
      this.refreshVoices();
    }
    return this.cachedVoices;
  }

  /**
   * État réel de la chaîne audio, affiché dans le panneau Oreillette.
   * Indispensable pour diagnostiquer sur un téléphone, sans console.
   */
  /** Voix française actuellement retenue, et si elle est de qualité améliorée. */
  public getActiveVoiceInfo(): { name: string | null; isEnhanced: boolean; total: number } {
    const voice = this.selectedVoice || this.cachedVoices[0] || null;
    const name = voice?.name || null;
    const lower = (name || '').toLowerCase();
    // iOS nomme ses voix de qualité « Améliorée » ou « Premium » ; les voix
    // d'origine sont dites « compactes » et sonnent nettement plus robotiques.
    const isEnhanced =
      lower.includes('enhanced') ||
      lower.includes('améliorée') ||
      lower.includes('amelioree') ||
      lower.includes('premium') ||
      lower.includes('natural') ||
      lower.includes('naturelle') ||
      lower.includes('siri');
    return { name, isEnhanced, total: this.cachedVoices.length };
  }

  public getAudioDiagnostics(): {
    contextState: string;
    mediaSession: string;
    hasGeminiKey: boolean;
    engine: string;
    frenchVoices: number;
  } {
    let contextState = 'non créé';
    try {
      if (this.audioCtx) contextState = this.audioCtx.state;
    } catch (e) {
      contextState = 'erreur';
    }

    let mediaSession = 'inactive';
    const el = this.mediaSessionKeepAlive;
    if (el) mediaSession = el.paused ? 'en pause' : 'active';

    return {
      contextState,
      mediaSession,
      hasGeminiKey: hasApiKey(),
      engine: this.settings.engineMode,
      frenchVoices: this.cachedVoices.length,
    };
  }

  public getSettings(): VoiceSettings {
    return { ...this.settings };
  }

  public updateSettings(partial: Partial<VoiceSettings>) {
    this.settings = { ...this.settings, ...partial };
    saveStoredVoiceSettings(this.settings);

    if (partial.voiceURI) {
      const match = this.cachedVoices.find((v) => v.voiceURI === partial.voiceURI);
      if (match) this.selectedVoice = match;
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted) {
      this.stopCurrentAudio();
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public stopCurrentAudio() {
    this.stopRadioCarrier();
    if (this.currentSourceNode) {
      try {
        this.currentSourceNode.stop();
        this.currentSourceNode.disconnect();
      } catch (e) {}
      this.currentSourceNode = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.currentUtterance = null;
    this.isSpeaking = false;
  }

  /**
   * Boucle audio silencieuse.
   *
   * Sur iOS, tout le son passant par l'AudioContext est coupé par
   * l'interrupteur silencieux physique de l'iPhone. Lire un élément <audio>
   * HTML place la session audio en catégorie "lecture média", ce qui route le
   * son sur le canal média : le coach reste audible même sonnerie coupée, et
   * la session ne s'endort pas entre deux consignes.
   */
  private mediaSessionKeepAlive: HTMLAudioElement | null = null;

  private startMediaSession() {
    if (typeof window === 'undefined') return;
    try {
      if (!this.mediaSessionKeepAlive) {
        const el = document.createElement('audio');
        el.src = SILENT_WAV_DATA_URI;
        el.loop = true;
        el.volume = 0.001;
        (el as any).playsInline = true;
        el.setAttribute('playsinline', '');
        el.setAttribute('aria-hidden', 'true');
        el.style.display = 'none';
        // Attaché au document : iOS ignore parfois les éléments média détachés.
        document.body.appendChild(el);
        this.mediaSessionKeepAlive = el;
      }
      const playPromise = this.mediaSessionKeepAlive.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        // Refusé hors geste utilisateur : sans gravité, on retentera au suivant.
        playPromise.catch(() => {});
      }
    } catch (e) {
      console.warn('Session média silencieuse indisponible:', e);
    }
  }

  public stopMediaSession() {
    try {
      this.mediaSessionKeepAlive?.pause();
    } catch (e) {}
  }

  public unlockAudio() {
    if (typeof window === 'undefined') return;

    // Doit être déclenché par un geste utilisateur pour être accepté par iOS.
    this.startMediaSession();

    try {
      const ctx = this.getAudioContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume();
      }
      if (ctx) {
        const buffer = ctx.createBuffer(1, 1, 24000);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start(0);
      }
    } catch (e) {
      console.warn('AudioContext unlock:', e);
    }

    try {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.resume();
        const silentUtterance = new SpeechSynthesisUtterance(' ');
        silentUtterance.volume = 0.01;
        silentUtterance.lang = 'fr-FR';
        window.speechSynthesis.speak(silentUtterance);
      }
    } catch (e) {
      console.warn('SpeechSynthesis prime:', e);
    }

    this.isUnlocked = true;
  }

  /**
   * Start authentic continuous radio carrier hiss & cockpit background noise
   */
  public startRadioCarrier() {
    if (this.isMuted || this.settings.radioAmbience === 'off') return;

    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      this.stopRadioCarrier();

      const baseVolume = (this.settings.radioStaticVolume ?? 0.35) * (this.settings.volume ?? 1.0);
      if (baseVolume <= 0.01) return;

      const now = ctx.currentTime;

      // 1. Generate 3-second looping analog white/pink radio noise buffer
      const bufferLength = ctx.sampleRate * 3;
      const noiseBuffer = ctx.createBuffer(1, bufferLength, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferLength; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.15;
      }

      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      noiseSource.loop = true;

      // 2. Bandpass filter the noise to sound like a VHF/UHF radio channel (400Hz - 2.8kHz)
      const bandpass = ctx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.setValueAtTime(1400, now);
      bandpass.Q.setValueAtTime(1.2, now);

      // 3. Cockpit hum / car alternator tone (120Hz + 240Hz harmonics) for DS Car preset
      let humOsc: OscillatorNode | undefined;
      let humGain: GainNode | undefined;

      if (this.settings.radioAmbience === 'ds_car') {
        humOsc = ctx.createOscillator();
        humOsc.type = 'triangle';
        humOsc.frequency.setValueAtTime(115, now);

        humGain = ctx.createGain();
        humGain.gain.setValueAtTime(0.018 * baseVolume, now);
        humOsc.connect(humGain);
      }

      // 4. Main master carrier gain
      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(0.001, now);
      gainNode.gain.linearRampToValueAtTime(0.09 * baseVolume, now + 0.05);

      noiseSource.connect(bandpass);
      bandpass.connect(gainNode);

      if (humGain) {
        humGain.connect(gainNode);
      }

      gainNode.connect(ctx.destination);

      noiseSource.start(now);
      if (humOsc) humOsc.start(now);

      this.activeCarrierNodes = {
        noiseSource,
        humOsc,
        gainNode,
      };
    } catch (e) {
      console.warn('Erreur carrier radio:', e);
    }
  }

  /**
   * Stop continuous carrier noise with smooth fade-out
   */
  public stopRadioCarrier() {
    if (!this.activeCarrierNodes) return;

    try {
      const ctx = this.getAudioContext();
      if (ctx && this.activeCarrierNodes.gainNode) {
        const now = ctx.currentTime;
        this.activeCarrierNodes.gainNode.gain.setValueAtTime(
          this.activeCarrierNodes.gainNode.gain.value,
          now
        );
        this.activeCarrierNodes.gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
      }

      const nodes = this.activeCarrierNodes;
      setTimeout(() => {
        try {
          nodes.noiseSource?.stop();
          nodes.noiseSource?.disconnect();
          nodes.humOsc?.stop();
          nodes.humOsc?.disconnect();
          nodes.gainNode?.disconnect();
        } catch (e) {}
      }, 100);

      this.activeCarrierNodes = null;
    } catch (e) {}
  }

  /**
   * Play an authentic Radio Tour / DS earpiece squelch chirp & sequence
   */
  public playRadioChirp(type: 'start' | 'end' = 'start') {
    if (this.isMuted || !this.settings.earpieceBeep || this.settings.radioAmbience === 'off') return;

    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const now = ctx.currentTime + 0.005;
      const vol = this.settings.volume ?? 1.0;
      const style = this.settings.radioAmbience;

      if (type === 'start') {
        // Start carrier background
        this.startRadioCarrier();

        // 1. Mechanical PTT switch click
        try {
          const clickOsc = ctx.createOscillator();
          const clickGain = ctx.createGain();
          clickOsc.type = 'square';
          clickOsc.frequency.setValueAtTime(140, now);
          clickOsc.frequency.exponentialRampToValueAtTime(40, now + 0.02);

          clickGain.gain.setValueAtTime(0.35 * vol, now);
          clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);

          clickOsc.connect(clickGain);
          clickGain.connect(ctx.destination);
          clickOsc.start(now);
          clickOsc.stop(now + 0.025);
        } catch (e) {}

        if (style === 'radio_tour_official') {
          // Iconic Tour de France Radio Tour 3-tone chime (F#5 740Hz -> A5 880Hz -> C#6 1108Hz)
          const playNote = (freq: number, startTime: number, dur: number) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, startTime);

            gain.gain.setValueAtTime(0.001, startTime);
            gain.gain.linearRampToValueAtTime(0.32 * vol, startTime + 0.015);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + dur);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(startTime);
            osc.stop(startTime + dur);
          };

          playNote(740, now + 0.02, 0.09);
          playNote(880, now + 0.11, 0.09);
          playNote(1108, now + 0.20, 0.15);
        } else if (style === 'walkie_talkie_intense') {
          // Harsh squelch burst (50ms noise burst + 1800Hz squelch tone)
          const squelchOsc = ctx.createOscillator();
          const squelchGain = ctx.createGain();
          squelchOsc.type = 'sawtooth';
          squelchOsc.frequency.setValueAtTime(2100, now + 0.01);
          squelchOsc.frequency.linearRampToValueAtTime(1400, now + 0.08);

          squelchGain.gain.setValueAtTime(0.38 * vol, now + 0.01);
          squelchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

          squelchOsc.connect(squelchGain);
          squelchGain.connect(ctx.destination);
          squelchOsc.start(now + 0.01);
          squelchOsc.stop(now + 0.09);
        } else if (style === 'modern_earpiece') {
          // Clean electronic dual-pip (2200Hz + 2800Hz)
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const gain = ctx.createGain();

          osc1.type = 'sine';
          osc1.frequency.setValueAtTime(2200, now + 0.01);
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(2800, now + 0.055);

          gain.gain.setValueAtTime(0.25 * vol, now + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.10);

          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(ctx.destination);

          osc1.start(now + 0.01);
          osc1.stop(now + 0.05);
          osc2.start(now + 0.055);
          osc2.stop(now + 0.10);
        } else {
          // Default: ds_car (Directeur Sportif Motorola Team Radio double-tone)
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const gain = ctx.createGain();

          osc1.type = 'sine';
          osc1.frequency.setValueAtTime(1760, now + 0.01);
          osc1.frequency.linearRampToValueAtTime(1980, now + 0.065);

          osc2.type = 'triangle';
          osc2.frequency.setValueAtTime(2637, now + 0.065);
          osc2.frequency.setValueAtTime(2349, now + 0.135);

          gain.gain.setValueAtTime(0.001, now + 0.01);
          gain.gain.linearRampToValueAtTime(0.42 * vol, now + 0.025);
          gain.gain.setValueAtTime(0.42 * vol, now + 0.065);
          gain.gain.linearRampToValueAtTime(0.48 * vol, now + 0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.145);

          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(ctx.destination);

          osc1.start(now + 0.01);
          osc1.stop(now + 0.065);
          osc2.start(now + 0.065);
          osc2.stop(now + 0.145);
        }
      } else {
        // End of transmission: Squelch tail burst + PTT release clack
        this.stopRadioCarrier();

        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(2093, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.07);

        gainNode.gain.setValueAtTime(0.32 * vol, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.08);

        // Squelch static snap
        try {
          const snapBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.04), ctx.sampleRate);
          const snapData = snapBuffer.getChannelData(0);
          for (let i = 0; i < snapBuffer.length; i++) {
            snapData[i] = (Math.random() * 2 - 1) * 0.25;
          }
          const snapSource = ctx.createBufferSource();
          snapSource.buffer = snapBuffer;
          const snapGain = ctx.createGain();
          snapGain.gain.setValueAtTime(0.3 * vol, now);
          snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
          snapSource.connect(snapGain);
          snapGain.connect(ctx.destination);
          snapSource.start(now);
        } catch (se) {}
      }
    } catch (e) {
      console.warn('Erreur bip radio:', e);
    }
  }

  /**
   * Builds an authentic Radio DSP filter chain:
   * 1. High-pass filter at 350 Hz (cuts chest bass)
   * 2. Peak resonant filter at 1.9 kHz (gives that metallic horn/radio mic presence)
   * 3. Low-pass filter at 3.2 kHz (limits HF bandwidth)
   */
  private createRadioDspChain(ctx: AudioContext): {
    input: AudioNode;
    output: AudioNode;
  } {
    if (!this.settings.radioDspFilter) {
      const passThrough = ctx.createGain();
      return { input: passThrough, output: passThrough };
    }

    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.setValueAtTime(360, ctx.currentTime);
    highpass.Q.setValueAtTime(0.8, ctx.currentTime);

    const peak = ctx.createBiquadFilter();
    peak.type = 'peaking';
    peak.frequency.setValueAtTime(1900, ctx.currentTime);
    peak.gain.setValueAtTime(6.0, ctx.currentTime);
    peak.Q.setValueAtTime(2.2, ctx.currentTime);

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(3200, ctx.currentTime);
    lowpass.Q.setValueAtTime(0.8, ctx.currentTime);

    highpass.connect(peak);
    peak.connect(lowpass);

    return {
      input: highpass,
      output: lowpass,
    };
  }

  private decodePcmToAudioBuffer(
    base64Data: string,
    sampleRate: number = 24000
  ): AudioBuffer | null {
    const ctx = this.getAudioContext();
    if (!ctx) return null;

    try {
      const binaryString = atob(base64Data);
      const len = binaryString.length;
      const numSamples = Math.floor(len / 2);
      if (numSamples <= 0) return null;

      const float32Array = new Float32Array(numSamples);

      for (let i = 0; i < numSamples; i++) {
        const byteIndex = i * 2;
        const low = binaryString.charCodeAt(byteIndex);
        const high = binaryString.charCodeAt(byteIndex + 1);
        let sample = (high << 8) | low;
        if (sample >= 0x8000) {
          sample -= 0x10000;
        }
        float32Array[i] = sample / 32768.0;
      }

      const audioBuffer = ctx.createBuffer(1, float32Array.length, sampleRate);
      audioBuffer.getChannelData(0).set(float32Array);
      return audioBuffer;
    } catch (e) {
      console.error('Erreur décodage PCM AudioBuffer:', e);
      return null;
    }
  }

  public async speakViaGeminiTTS(
    rawText: string,
    options?: {
      priority?: 'high' | 'normal';
      intensity?: IntensityZone;
      personaOverride?: CoachPersona;
      engineOverride?: VoiceEngineMode;
      onEnd?: () => void;
      onError?: (err: any) => void;
    }
  ): Promise<boolean> {
    if (this.isMuted) {
      if (options?.onEnd) options.onEnd();
      return true;
    }

    // Sans clé Gemini configurée, on utilise directement la voix locale du navigateur.
    if (!hasApiKey()) {
      if (options?.onError) {
        options.onError(new Error('Aucune clé API Gemini enregistrée'));
      }
      this.speakViaSpeechSynthesis(rawText, options);
      return false;
    }

    const ctx = this.getAudioContext();
    if (!ctx) {
      if (options?.onError) options.onError(new Error("AudioContext indisponible"));
      this.speakViaSpeechSynthesis(rawText, options);
      return false;
    }

    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch (e) {}
    }

    if (options?.priority === 'high') {
      this.stopCurrentAudio();
    }

    const textToSpeak = this.settings.naturalProsody ? normalizeTextForSpeech(rawText) : rawText;
    const persona = options?.personaOverride || this.settings.persona;
    const intensity = options?.intensity || 'moyen';
    const cacheKey = `${persona}_${intensity}_${textToSpeak}`;

    try {
      let audioBuffer: AudioBuffer | null = this.audioBufferCache.get(cacheKey) || null;

      // 1. Cache persistant (IndexedDB), rempli avant le départ : lecture
      //    immédiate, sans appel réseau, donc sans décalage avec le chrono.
      if (!audioBuffer) {
        const stored = await getCachedClip(clipKey(voiceNameForPersona(persona), textToSpeak));
        if (stored) {
          audioBuffer = this.decodePcmToAudioBuffer(stored.audioBase64, stored.sampleRate || 24000);
          if (audioBuffer) this.rememberBuffer(cacheKey, audioBuffer);
        }
      }

      // 2. Sinon, génération à la volée puis mise en cache pour la prochaine fois.
      if (!audioBuffer) {
        const data = await synthesizeSpeech({
          text: textToSpeak,
          persona,
        });

        if (data.audioBase64) {
          audioBuffer = this.decodePcmToAudioBuffer(data.audioBase64, data.sampleRate || 24000);
          if (audioBuffer) {
            this.rememberBuffer(cacheKey, audioBuffer);
            putCachedClip({
              key: clipKey(data.voiceName, textToSpeak),
              audioBase64: data.audioBase64,
              sampleRate: data.sampleRate,
              voiceName: data.voiceName,
              text: textToSpeak,
              createdAt: Date.now(),
            });
          }
        }
      }

      if (!audioBuffer) {
        throw new Error('AudioBuffer decoding failed');
      }

      // Play start chirp & begin carrier
      this.playRadioChirp('start');
      this.startRadioCarrier();

      const source = ctx.createBufferSource();
      const gainNode = ctx.createGain();
      const dspChain = this.createRadioDspChain(ctx);

      source.buffer = audioBuffer;

      const rate = this.settings.speedRate || 1.0;
      source.playbackRate.setValueAtTime(rate, ctx.currentTime);

      const targetVolume = Math.max(0.1, Math.min(1.0, this.settings.volume || 1.0));
      gainNode.gain.setValueAtTime(targetVolume, ctx.currentTime);

      source.connect(dspChain.input);
      dspChain.output.connect(gainNode);
      gainNode.connect(ctx.destination);

      this.currentSourceNode = source;
      this.isSpeaking = true;

      source.onended = () => {
        this.isSpeaking = false;
        this.currentSourceNode = null;
        this.stopRadioCarrier();
        this.playRadioChirp('end');
        if (options?.onEnd) options.onEnd();
      };

      source.start();
      return true;
    } catch (err: any) {
      console.warn('Gemini Studio TTS indisponible, bascule sur la synthèse locale:', err);
      if (options?.onError) {
        options.onError(err);
      }
      this.stopRadioCarrier();
      this.speakViaSpeechSynthesis(rawText, options);
      return false;
    }
  }

  public speakViaSpeechSynthesis(
    rawText: string,
    options?: {
      priority?: 'high' | 'normal';
      intensity?: IntensityZone;
      personaOverride?: CoachPersona;
      onEnd?: () => void;
    }
  ) {
    if (this.isMuted || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      if (options?.onEnd) options.onEnd();
      return;
    }

    if (!rawText || rawText.trim().length === 0) {
      if (options?.onEnd) options.onEnd();
      return;
    }

    try {
      window.speechSynthesis.cancel();
      this.isSpeaking = false;

      const textToSpeak = this.settings.naturalProsody ? normalizeTextForSpeech(rawText) : rawText;
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = 'fr-FR';

      const persona = options?.personaOverride || this.settings.persona;
      let baseRate = this.settings.speedRate || 1.05;
      let basePitch = this.settings.pitch || 1.0;

      switch (persona) {
        case 'jean_marc_dynamique':
          baseRate *= 1.04;
          basePitch *= 1.0;
          break;
        case 'marc_pose':
          baseRate *= 0.95;
          basePitch *= 0.94;
          break;
        case 'emilie_punchy':
          baseRate *= 1.06;
          basePitch *= 1.08;
          break;
        case 'radio_tour':
          baseRate *= 1.02;
          basePitch *= 0.98;
          break;
      }

      if (this.settings.effortModulation && options?.intensity) {
        if (options.intensity === 'a_fond') {
          baseRate *= 1.06;
          basePitch *= 1.05;
        } else if (options.intensity === 'seuil') {
          baseRate *= 1.02;
          basePitch *= 1.01;
        } else if (options.intensity === 'facile') {
          baseRate *= 0.95;
          basePitch *= 0.96;
        }
      }

      utterance.rate = Math.max(0.75, Math.min(1.4, baseRate));
      utterance.pitch = Math.max(0.7, Math.min(1.3, basePitch));
      utterance.volume = Math.max(0.1, Math.min(1.0, this.settings.volume));

      // Always force-select the best natural French voice matching the persona
      const personaVoice = this.getBestFrenchVoiceForPersona(persona);
      if (personaVoice) {
        utterance.voice = personaVoice;
        utterance.lang = personaVoice.lang || 'fr-FR';
      } else if (this.selectedVoice) {
        utterance.voice = this.selectedVoice;
        utterance.lang = this.selectedVoice.lang || 'fr-FR';
      }

      this.currentUtterance = utterance;
      this.activeUtteranceRef = utterance; // Prevent GC in Chrome
      this.playRadioChirp('start');

      utterance.onstart = () => {
        this.isSpeaking = true;
      };

      utterance.onend = () => {
        this.isSpeaking = false;
        this.currentUtterance = null;
        this.activeUtteranceRef = null;
        this.playRadioChirp('end');
        if (options?.onEnd) options.onEnd();
      };

      utterance.onerror = (e) => {
        console.warn('SpeechSynthesis event error:', e);
        this.isSpeaking = false;
        this.currentUtterance = null;
        this.activeUtteranceRef = null;
        this.stopRadioCarrier();
        if (options?.onEnd) options.onEnd();
      };

      // Ensure speech synthesis engine is active & unpaused
      window.speechSynthesis.resume();
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error('Erreur synthèse vocale navigateur:', err);
      this.stopRadioCarrier();
      if (options?.onEnd) options.onEnd();
    }
  }

  /**
   * Voix Kokoro synthétisée localement (gratuite, illimitée, hors connexion).
   * Le rendu passe par la même chaîne radio que Gemini, et un échec bascule
   * sur la synthèse du navigateur comme pour les autres moteurs.
   */
  public async speakViaKokoro(
    rawText: string,
    options?: {
      priority?: 'high' | 'normal';
      intensity?: IntensityZone;
      personaOverride?: CoachPersona;
      onEnd?: () => void;
      onError?: (err: any) => void;
      onModelProgress?: (percent: number, status: string) => void;
    }
  ): Promise<boolean> {
    if (this.isMuted) {
      if (options?.onEnd) options.onEnd();
      return true;
    }

    const ctx = this.getAudioContext();
    if (!ctx) {
      if (options?.onError) options.onError(new Error('AudioContext indisponible'));
      this.speakViaSpeechSynthesis(rawText, options);
      return false;
    }
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch (e) {}
    }
    if (options?.priority === 'high') this.stopCurrentAudio();

    const textToSpeak = this.settings.naturalProsody ? normalizeTextForSpeech(rawText) : rawText;
    const cacheKey = `kokoro_${textToSpeak}`;

    try {
      let audioBuffer = this.audioBufferCache.get(cacheKey) || null;

      if (!audioBuffer) {
        const { synthesizeFrench } = await import('./kokoroEngine');
        const { samples, sampleRate } = await synthesizeFrench(textToSpeak, (p) =>
          options?.onModelProgress?.(p.percent, p.status)
        );
        audioBuffer = ctx.createBuffer(1, samples.length, sampleRate);
        audioBuffer.getChannelData(0).set(samples);
        this.rememberBuffer(cacheKey, audioBuffer);
      }

      this.playRadioChirp('start');
      this.startRadioCarrier();

      const source = ctx.createBufferSource();
      const gainNode = ctx.createGain();
      const dspChain = this.createRadioDspChain(ctx);

      source.buffer = audioBuffer;
      source.playbackRate.setValueAtTime(this.settings.speedRate || 1.0, ctx.currentTime);
      gainNode.gain.setValueAtTime(
        Math.max(0.1, Math.min(1.0, this.settings.volume || 1.0)),
        ctx.currentTime
      );

      source.connect(dspChain.input);
      dspChain.output.connect(gainNode);
      gainNode.connect(ctx.destination);

      this.currentSourceNode = source;
      this.isSpeaking = true;
      source.onended = () => {
        this.isSpeaking = false;
        this.currentSourceNode = null;
        this.stopRadioCarrier();
        this.playRadioChirp('end');
        if (options?.onEnd) options.onEnd();
      };
      source.start();
      return true;
    } catch (err: any) {
      console.warn('Voix Kokoro indisponible, bascule sur la synthèse locale:', err);
      if (options?.onError) options.onError(err);
      this.stopRadioCarrier();
      this.speakViaSpeechSynthesis(rawText, options);
      return false;
    }
  }

  public speak(
    rawText: string,
    options?: {
      priority?: 'high' | 'normal';
      intensity?: IntensityZone;
      personaOverride?: CoachPersona;
      engineOverride?: VoiceEngineMode;
      onEnd?: () => void;
      onError?: (err: any) => void;
      onModelProgress?: (percent: number, status: string) => void;
    }
  ) {
    if (this.isMuted) {
      if (options?.onEnd) options.onEnd();
      return;
    }

    const engineToUse = options?.engineOverride || this.settings.engineMode;

    if (engineToUse === 'gemini_neural') {
      this.speakViaGeminiTTS(rawText, options);
    } else if (engineToUse === 'kokoro_local') {
      this.speakViaKokoro(rawText, options);
    } else {
      this.speakViaSpeechSynthesis(rawText, options);
    }
  }

  public testVoice(
    sampleType: 'effort' | 'recup' | 'conseil' = 'effort',
    options?: {
      forcedEngine?: VoiceEngineMode;
      onEnd?: () => void;
      onError?: (err: any) => void;
      onModelProgress?: (percent: number, status: string) => void;
    }
  ) {
    let sample = "Allez champion, on s'accroche ! Relance souple à 95 tours par minute, buste stable !";
    let intensity: IntensityZone = 'a_fond';

    if (sampleType === 'recup') {
      sample =
        "Très beau travail sur ce bloc. Récupération active pendant 2 minutes en Zone 1. Relâche les épaules et hydrate-toi.";
      intensity = 'facile';
    } else if (sampleType === 'conseil') {
      sample =
        "Ici Jean-Marc dans l'oreillette. Conserve du braquet dans le faux-plat pour maintenir tes 280 watts.";
      intensity = 'seuil';
    }

    this.speak(sample, {
      priority: 'high',
      intensity,
      engineOverride: options?.forcedEngine,
      onEnd: options?.onEnd,
      onError: options?.onError,
      onModelProgress: options?.onModelProgress,
    });
  }

  public playTone(freq: number = 880, durationMs: number = 150, type: OscillatorType = 'sine') {
    if (this.isMuted) return;

    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.28, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + durationMs / 1000);
    } catch (e) {}
  }

  public playCountdownTone(secondsLeft: number) {
    if (secondsLeft === 3) {
      this.playTone(523.25, 120);
    } else if (secondsLeft === 2) {
      this.playTone(587.33, 120);
    } else if (secondsLeft === 1) {
      this.playTone(659.25, 150);
    } else if (secondsLeft === 0) {
      this.playTone(1046.5, 350, 'triangle');
    }
  }
}

export const audioEngine = new HumanizedAudioEngine();
