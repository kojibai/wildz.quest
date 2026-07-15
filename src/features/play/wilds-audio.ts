export type WildsAudioSettings = {
  master: number;
  effects: number;
  ambience: number;
  music: number;
  muted: boolean;
};

export type WildsAudioCue =
  | "search"
  | "proximity-warm"
  | "proximity-hot"
  | "rustle"
  | "emerge"
  | "battle-hit"
  | "capture"
  | "seal"
  | "reveal"
  | "evolve"
  | "lineage"
  | "player-arrival"
  | "weather-pollen"
  | "landmark-near"
  | "foliage-surge"
  | "confirm"
  | "error";

export type WildsEncounterAudioState = {
  phase: string;
  proximity?: string;
};

export const DEFAULT_WILDS_AUDIO_SETTINGS: WildsAudioSettings = {
  master: 0.72,
  effects: 0.82,
  ambience: 0.42,
  music: 0.3,
  muted: false
};

type AudioParamLike = {
  setValueAtTime(value: number, time: number): void;
  exponentialRampToValueAtTime(value: number, time: number): void;
};

type OscillatorLike = {
  type: string;
  frequency: AudioParamLike;
  connect(target: unknown): void;
  disconnect(): void;
  start(time?: number): void;
  stop(time?: number): void;
};

type GainLike = {
  gain: AudioParamLike;
  connect(target: unknown): void;
  disconnect(): void;
};

export type WildsAudioContextLike = {
  currentTime: number;
  destination: unknown;
  resume(): Promise<void>;
  close(): Promise<void>;
  createOscillator(): OscillatorLike;
  createGain(): GainLike;
};

type CueVoice = {
  frequency: number;
  endFrequency: number;
  duration: number;
  gain: number;
  type: "sine" | "triangle" | "square" | "sawtooth";
};

const CUE_VOICES: Readonly<Record<WildsAudioCue, CueVoice>> = {
  search: { frequency: 440, endFrequency: 760, duration: 0.28, gain: 0.18, type: "sine" },
  "proximity-warm": { frequency: 520, endFrequency: 620, duration: 0.34, gain: 0.16, type: "triangle" },
  "proximity-hot": { frequency: 620, endFrequency: 920, duration: 0.42, gain: 0.2, type: "triangle" },
  rustle: { frequency: 180, endFrequency: 260, duration: 0.24, gain: 0.12, type: "sawtooth" },
  emerge: { frequency: 220, endFrequency: 740, duration: 0.58, gain: 0.22, type: "triangle" },
  "battle-hit": { frequency: 150, endFrequency: 72, duration: 0.2, gain: 0.28, type: "square" },
  capture: { frequency: 380, endFrequency: 720, duration: 0.5, gain: 0.22, type: "triangle" },
  seal: { frequency: 660, endFrequency: 1_180, duration: 0.48, gain: 0.2, type: "sine" },
  reveal: { frequency: 520, endFrequency: 1_320, duration: 0.78, gain: 0.2, type: "triangle" },
  evolve: { frequency: 420, endFrequency: 1_480, duration: 1.1, gain: 0.2, type: "sine" },
  lineage: { frequency: 360, endFrequency: 1_040, duration: 1.15, gain: 0.18, type: "triangle" },
  "player-arrival": { frequency: 490, endFrequency: 820, duration: 0.36, gain: 0.14, type: "sine" },
  "weather-pollen": { frequency: 310, endFrequency: 470, duration: 0.7, gain: 0.08, type: "sine" },
  "landmark-near": { frequency: 330, endFrequency: 880, duration: 0.72, gain: 0.14, type: "triangle" },
  "foliage-surge": { frequency: 170, endFrequency: 390, duration: 0.34, gain: 0.11, type: "sawtooth" },
  confirm: { frequency: 540, endFrequency: 760, duration: 0.18, gain: 0.14, type: "sine" },
  error: { frequency: 210, endFrequency: 130, duration: 0.24, gain: 0.16, type: "square" }
};

function clampUnit(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : fallback;
}

export function normalizeWildsAudioSettings(value: unknown): WildsAudioSettings {
  if (!value || typeof value !== "object") return { ...DEFAULT_WILDS_AUDIO_SETTINGS };
  const candidate = value as Partial<WildsAudioSettings>;
  return {
    master: clampUnit(candidate.master, DEFAULT_WILDS_AUDIO_SETTINGS.master),
    effects: clampUnit(candidate.effects, DEFAULT_WILDS_AUDIO_SETTINGS.effects),
    ambience: clampUnit(candidate.ambience, DEFAULT_WILDS_AUDIO_SETTINGS.ambience),
    music: clampUnit(candidate.music, DEFAULT_WILDS_AUDIO_SETTINGS.music),
    muted: typeof candidate.muted === "boolean" ? candidate.muted : DEFAULT_WILDS_AUDIO_SETTINGS.muted
  };
}

export function audioCuesForTransition(
  previous: WildsEncounterAudioState,
  next: WildsEncounterAudioState
): WildsAudioCue[] {
  if (previous.phase === next.phase && previous.proximity === next.proximity) return [];
  if (previous.phase === "hint" && next.phase === "hint") {
    if (next.proximity === "hot") return ["proximity-hot", "foliage-surge"];
    if (next.proximity === "warm") return ["proximity-warm"];
  }
  if (next.phase === "searching") return ["search"];
  if (next.phase === "hint") {
    const proximityCue = next.proximity === "hot"
      ? "proximity-hot"
      : next.proximity === "warm" ? "proximity-warm" : null;
    return ["search", proximityCue, "rustle"].filter((cue): cue is WildsAudioCue => cue !== null);
  }
  if (next.phase === "emerging") return ["emerge"];
  if (next.phase === "capsule") return ["capture"];
  if (next.phase === "sealed") return ["seal"];
  if (next.phase === "revealed") return ["reveal"];
  return [];
}

export function createWildsAudioRuntime(factory: () => WildsAudioContextLike) {
  let context: WildsAudioContextLike | null = null;
  let settings = { ...DEFAULT_WILDS_AUDIO_SETTINGS };
  let destroyed = false;
  let ambience: Array<{ oscillator: OscillatorLike; gain: GainLike }> = [];

  const play = (cue: WildsAudioCue) => {
    if (!context || destroyed || settings.muted) return;
    const voice = CUE_VOICES[cue];
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    const volume = Math.max(0.0001, voice.gain * settings.master * settings.effects);
    oscillator.type = voice.type;
    oscillator.frequency.setValueAtTime(voice.frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(voice.endFrequency, now + voice.duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + voice.duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + voice.duration);
  };

  const stopAmbience = () => {
    ambience.forEach(({ oscillator, gain }) => {
      try { oscillator.stop(); } catch { /* The oscillator may already be stopped. */ }
      oscillator.disconnect();
      gain.disconnect();
    });
    ambience = [];
  };

  return {
    async unlock() {
      if (destroyed) return;
      context ??= factory();
      await context.resume();
    },
    setSettings(next: WildsAudioSettings) {
      settings = normalizeWildsAudioSettings(next);
      if (settings.muted) stopAmbience();
    },
    play,
    startAmbience() {
      if (!context || destroyed || settings.muted || ambience.length > 0) return;
      ambience = [98, 147].map((frequency, index) => {
        const oscillator = context!.createOscillator();
        const gain = context!.createGain();
        oscillator.type = index === 0 ? "sine" : "triangle";
        oscillator.frequency.setValueAtTime(frequency, context!.currentTime);
        const volume = Math.max(0.0001, settings.master * settings.ambience * (index === 0 ? 0.025 : 0.012));
        gain.gain.setValueAtTime(volume, context!.currentTime);
        oscillator.connect(gain);
        gain.connect(context!.destination);
        oscillator.start(context!.currentTime);
        return { oscillator, gain };
      });
    },
    stopAmbience,
    async destroy() {
      if (destroyed) return;
      destroyed = true;
      stopAmbience();
      const activeContext = context;
      context = null;
      if (activeContext) await activeContext.close();
    }
  };
}
