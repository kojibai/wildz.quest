import type { WildsEcologyFamilyId } from "./wilds-ecology";
import type { WildsBossFamilyId } from "./wilds-boss-ecology";
import { WILDS_AUDIO_BY_ID } from "./wilds-audio-catalog";
import { selectWildsAudioProgram, type WildsAudioMemory } from "./wilds-audio-director";
import type { WildsAudioScene } from "./wilds-audio-scene";

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
  | "settlement-arrival"
  | "settlement-service"
  | "route-step"
  | "route-complete"
  | "foliage-surge"
  | "ecology-rumor"
  | "ecology-step"
  | "ecology-resolved"
  | "ecology-market"
  | "ecology-ruin"
  | "ecology-portal"
  | "ecology-festival"
  | "ecology-migration"
  | "ecology-bloom"
  | "ecology-storm"
  | "ecology-distress"
  | "boss-crystal"
  | "boss-skycoil"
  | "boss-mirecrown"
  | "boss-embermane"
  | "boss-tidal"
  | "boss-echo"
  | "boss-lumen"
  | "boss-voidroot"
  | "boss-action"
  | "boss-transform"
  | "boss-vulnerable"
  | "boss-defeat"
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

type AudioBufferSourceLike = {
  buffer: unknown;
  loop?: boolean;
  onended?: (() => void) | null;
  connect(target: unknown): void;
  disconnect(): void;
  start(time?: number): void;
  stop(time?: number): void;
};

type WildsAudioFetchResponse = {
  ok: boolean;
  arrayBuffer(): Promise<ArrayBuffer>;
};

export type WildsAudioContextLike = {
  currentTime: number;
  destination: unknown;
  resume(): Promise<void>;
  close(): Promise<void>;
  createOscillator(): OscillatorLike;
  createGain(): GainLike;
  createBufferSource?(): AudioBufferSourceLike;
  decodeAudioData?(data: ArrayBuffer): Promise<unknown>;
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
  "settlement-arrival": { frequency: 294, endFrequency: 784, duration: 0.82, gain: 0.16, type: "triangle" },
  "settlement-service": { frequency: 587, endFrequency: 988, duration: 0.42, gain: 0.13, type: "sine" },
  "route-step": { frequency: 440, endFrequency: 554, duration: 0.16, gain: 0.1, type: "triangle" },
  "route-complete": { frequency: 523, endFrequency: 1_176, duration: 0.72, gain: 0.17, type: "sine" },
  "foliage-surge": { frequency: 170, endFrequency: 390, duration: 0.34, gain: 0.11, type: "sawtooth" },
  "ecology-rumor": { frequency: 196, endFrequency: 294, duration: 0.55, gain: 0.09, type: "sine" },
  "ecology-step": { frequency: 392, endFrequency: 523, duration: 0.22, gain: 0.11, type: "triangle" },
  "ecology-resolved": { frequency: 523, endFrequency: 1_318, duration: 0.92, gain: 0.17, type: "sine" },
  "ecology-market": { frequency: 330, endFrequency: 659, duration: 0.58, gain: 0.13, type: "triangle" },
  "ecology-ruin": { frequency: 174, endFrequency: 349, duration: 0.78, gain: 0.12, type: "sine" },
  "ecology-portal": { frequency: 277, endFrequency: 1_109, duration: 0.7, gain: 0.14, type: "sawtooth" },
  "ecology-festival": { frequency: 440, endFrequency: 880, duration: 0.68, gain: 0.13, type: "triangle" },
  "ecology-migration": { frequency: 220, endFrequency: 440, duration: 0.64, gain: 0.12, type: "triangle" },
  "ecology-bloom": { frequency: 349, endFrequency: 988, duration: 0.72, gain: 0.12, type: "sine" },
  "ecology-storm": { frequency: 123, endFrequency: 247, duration: 0.66, gain: 0.15, type: "sawtooth" },
  "ecology-distress": { frequency: 262, endFrequency: 196, duration: 0.48, gain: 0.14, type: "square" },
  "boss-crystal": { frequency: 196, endFrequency: 988, duration: .72, gain: .17, type: "triangle" },
  "boss-skycoil": { frequency: 147, endFrequency: 1_176, duration: .66, gain: .17, type: "sawtooth" },
  "boss-mirecrown": { frequency: 82, endFrequency: 220, duration: .88, gain: .18, type: "triangle" },
  "boss-embermane": { frequency: 110, endFrequency: 659, duration: .58, gain: .19, type: "square" },
  "boss-tidal": { frequency: 123, endFrequency: 523, duration: .82, gain: .16, type: "sine" },
  "boss-echo": { frequency: 174, endFrequency: 698, duration: .9, gain: .15, type: "sine" },
  "boss-lumen": { frequency: 392, endFrequency: 1_318, duration: .78, gain: .14, type: "triangle" },
  "boss-voidroot": { frequency: 73, endFrequency: 294, duration: 1.05, gain: .2, type: "sawtooth" },
  "boss-action": { frequency: 220, endFrequency: 440, duration: .18, gain: .18, type: "square" },
  "boss-transform": { frequency: 147, endFrequency: 880, duration: .94, gain: .2, type: "sawtooth" },
  "boss-vulnerable": { frequency: 523, endFrequency: 1_397, duration: .6, gain: .18, type: "triangle" },
  "boss-defeat": { frequency: 196, endFrequency: 1_568, duration: 1.35, gain: .22, type: "sine" },
  confirm: { frequency: 540, endFrequency: 760, duration: 0.18, gain: 0.14, type: "sine" },
  error: { frequency: 210, endFrequency: 130, duration: 0.24, gain: 0.16, type: "square" }
};

const CUE_ASSETS: Partial<Record<WildsAudioCue, string>> = {
  seal: "receiz-kai-turah-signature",
  confirm: "ui-confirm",
  error: "ui-error",
  "battle-hit": "strike-slice",
  "landmark-near": "door-open",
  "settlement-arrival": "door-open",
  "settlement-service": "receiz-kai-turah-signature",
  "route-step": "step-2",
  "route-complete": "proof-latch"
};

export function audioAssetIdForCue(cue: WildsAudioCue): string | null {
  return CUE_ASSETS[cue] ?? null;
}

export function settlementAudioCue(action: "arrival" | "service" | "route-step" | "route-complete"): WildsAudioCue {
  return action === "arrival" ? "settlement-arrival"
    : action === "service" ? "settlement-service"
      : action === "route-step" ? "route-step"
        : "route-complete";
}

const ECOLOGY_FAMILY_CUES: Record<WildsEcologyFamilyId, WildsAudioCue> = {
  "wandering-market": "ecology-market",
  "echo-ruin": "ecology-ruin",
  "unstable-portal": "ecology-portal",
  "convergence-festival": "ecology-festival",
  "creature-migration": "ecology-migration",
  "resource-bloom": "ecology-bloom",
  stormfront: "ecology-storm",
  "settlement-distress": "ecology-distress"
};

export function ecologyAudioCue(action: "rumor" | "discovered" | "step" | "resolved", familyId: WildsEcologyFamilyId): WildsAudioCue {
  return action === "rumor" ? "ecology-rumor"
    : action === "step" ? "ecology-step"
      : action === "resolved" ? "ecology-resolved"
        : ECOLOGY_FAMILY_CUES[familyId];
}

const BOSS_FAMILY_CUES: Record<WildsBossFamilyId, WildsAudioCue> = {
  "crystal-burrower": "boss-crystal", "skycoil-tempest": "boss-skycoil", "mirecrown-colossus": "boss-mirecrown",
  "embermane-siegebeast": "boss-embermane", "tidal-prism-leviathan": "boss-tidal", "echo-antler-warden": "boss-echo",
  "lumen-moth-sovereign": "boss-lumen", "voidroot-devourer": "boss-voidroot"
};

export function bossAudioCue(action: "telegraph" | "action" | "transform" | "vulnerable" | "defeat", familyId: WildsBossFamilyId): WildsAudioCue {
  return action === "action" ? "boss-action" : action === "transform" ? "boss-transform" : action === "vulnerable" ? "boss-vulnerable" : action === "defeat" ? "boss-defeat" : BOSS_FAMILY_CUES[familyId];
}

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

export function createWildsAudioRuntime(
  factory: () => WildsAudioContextLike,
  fetcher: (path: string) => Promise<WildsAudioFetchResponse> = (path) => fetch(path)
) {
  let context: WildsAudioContextLike | null = null;
  let settings = { ...DEFAULT_WILDS_AUDIO_SETTINGS };
  let destroyed = false;
  let ambience: Array<{ oscillator: OscillatorLike; gain: GainLike }> = [];
  const buffers = new Map<string, unknown>();
  const loading = new Map<string, Promise<void>>();
  const activeSources = new Set<AudioBufferSourceLike>();
  let programSources: Array<{ source: AudioBufferSourceLike; gain: GainLike; kind: "music" | "ambience" }> = [];
  let programMemory: WildsAudioMemory = { activeProgramId: null, enteredAt: 0, recent: [] };

  const preload = async (assetIds: readonly string[]) => {
    if (!context || destroyed || !context.decodeAudioData || !context.createBufferSource) return;
    await Promise.all(assetIds.map(async (assetId) => {
      if (buffers.has(assetId)) return;
      const existing = loading.get(assetId);
      if (existing) return existing;
      const asset = WILDS_AUDIO_BY_ID.get(assetId);
      if (!asset) return;
      const request = (async () => {
        const response = await fetcher(asset.path);
        if (!response.ok) throw new Error(`Audio load failed: ${assetId}`);
        buffers.set(assetId, await context!.decodeAudioData!(await response.arrayBuffer()));
      })().finally(() => loading.delete(assetId));
      loading.set(assetId, request);
      return request;
    }));
  };

  const play = (cue: WildsAudioCue) => {
    if (!context || destroyed || settings.muted) return;
    const assetId = audioAssetIdForCue(cue);
    const buffer = assetId ? buffers.get(assetId) : null;
    if (buffer && context.createBufferSource) {
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = buffer;
      gain.gain.setValueAtTime(Math.max(0.0001, settings.master * settings.effects), context.currentTime);
      source.connect(gain);
      gain.connect(context.destination);
      source.onended = () => {
        activeSources.delete(source);
        source.disconnect();
        gain.disconnect();
      };
      activeSources.add(source);
      source.start(context.currentTime);
      return;
    }
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

  const stopProgram = () => {
    programSources.forEach(({ source, gain }) => {
      try { source.stop(); } catch { /* The loop may already be stopped. */ }
      source.disconnect();
      gain.disconnect();
    });
    programSources = [];
    programMemory = { ...programMemory, activeProgramId: null, enteredAt: 0 };
  };

  const setScene = async (scene: WildsAudioScene) => {
    if (!context || destroyed || settings.muted) return programMemory.activeProgramId;
    const nowMs = Date.now();
    const next = selectWildsAudioProgram(scene, programMemory, nowMs);
    if (next.id === programMemory.activeProgramId) return next.id;
    const assetIds = next.layers.filter((id) => WILDS_AUDIO_BY_ID.has(id));
    await preload(assetIds);
    const now = context.currentTime;
    const end = now + next.crossfadeSeconds;
    const oldSources = programSources;
    programSources = [];
    stopAmbience();
    for (const assetId of assetIds) {
      const asset = WILDS_AUDIO_BY_ID.get(assetId);
      const buffer = buffers.get(assetId);
      if (!asset || !buffer || !context.createBufferSource || (asset.kind !== "music" && asset.kind !== "ambience")) continue;
      const source = context.createBufferSource();
      const gain = context.createGain();
      const volume = Math.max(0.0001, settings.master * (asset.kind === "music" ? settings.music : settings.ambience));
      source.buffer = buffer;
      source.loop = asset.loop;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(volume, end);
      source.connect(gain);
      gain.connect(context.destination);
      source.onended = () => { source.disconnect(); gain.disconnect(); };
      source.start(now);
      programSources.push({ source, gain, kind: asset.kind });
    }
    oldSources.forEach(({ source, gain, kind }) => {
      gain.gain.setValueAtTime(Math.max(0.0001, settings.master * (kind === "music" ? settings.music : settings.ambience)), now);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      try { source.stop(end); } catch { /* A completed loop needs no further cleanup. */ }
    });
    programMemory = {
      activeProgramId: next.id,
      enteredAt: nowMs,
      recent: [...programMemory.recent, next.id].slice(-4)
    };
    return next.id;
  };

  return {
    async unlock() {
      if (destroyed) return;
      context ??= factory();
      await context.resume();
    },
    setSettings(next: WildsAudioSettings) {
      settings = normalizeWildsAudioSettings(next);
      if (settings.muted) {
        stopAmbience();
        stopProgram();
      } else if (context) {
        programSources.forEach(({ gain, kind }) => gain.gain.setValueAtTime(
          Math.max(0.0001, settings.master * (kind === "music" ? settings.music : settings.ambience)),
          context!.currentTime
        ));
      }
    },
    preload,
    play,
    setScene,
    activeProgramId() {
      return programMemory.activeProgramId;
    },
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
      activeSources.forEach((source) => {
        try { source.stop(); } catch { /* The decoded source may already have ended. */ }
        source.disconnect();
      });
      activeSources.clear();
      stopProgram();
      buffers.clear();
      const activeContext = context;
      context = null;
      if (activeContext) await activeContext.close();
    }
  };
}
