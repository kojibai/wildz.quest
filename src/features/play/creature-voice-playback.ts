"use client";

import type { wildzStreamingVoiceProfile } from "@/lib/receiz/wildz-voice-lock";
import {
  KAI_BREATH_INHALE_SHARE,
  KAI_PULSE_DURATION_MS
} from "./kai-klok-moment";
import {
  localNeuralVoiceReady,
  prepareLocalNeuralVoice,
  renderLocalNeuralVoice
} from "./local-neural-voice";

let sharedAudioContext: AudioContext | null = null;
let activeStreamCancel: (() => void) | null = null;

export type CreatureVoiceChunk = Readonly<{
  audioB64u?: string;
  startMs?: number;
  endMs?: number;
  confidence?: number;
  contextDigest?: string;
  voiceSignature?: string;
}>;

export type CreatureVoiceStream = Readonly<{
  pushText: (delta: string) => void;
  pushAudio: (chunk: CreatureVoiceChunk) => void;
  finish: () => void;
  abort: () => void;
  completed: Promise<boolean>;
}>;

type ProofVoiceProfile = ReturnType<typeof wildzStreamingVoiceProfile>;
type SpeechUnit = Readonly<{ kind: "vowel" | "voiced" | "noise" | "pause"; key: string; duration: number }>;

type SpeakingMoment = Readonly<{ uPulse: number; birthMomentMs: number }>;
type PerformanceEnrichment = Readonly<{ durationScale: number; energy: readonly number[] }>;

const VOWEL_FORMANTS: Readonly<Record<string, readonly [number, number, number]>> = {
  a: [730, 1090, 2440], e: [530, 1840, 2480], i: [270, 2290, 3010],
  o: [570, 840, 2410], u: [300, 870, 2240], y: [390, 1990, 2550],
  schwa: [500, 1500, 2500]
};

function proofSpeechUnits(text: string, rate: number) {
  const normalized = text.toLowerCase().replace(/[^a-z0-9'.,!?;:\-\s]/g, " ").slice(0, 1_200);
  const units: SpeechUnit[] = [];
  const digraphs = new Set(["th", "sh", "ch", "ph", "wh", "ng", "qu", "ee", "oo", "ou", "ai", "ay", "oi", "ea"]);
  for (let index = 0; index < normalized.length;) {
    const char = normalized[index]!;
    const pair = normalized.slice(index, index + 2);
    const token = digraphs.has(pair) ? pair : char;
    index += token.length;
    if (/\s/.test(token)) {
      if (units.at(-1)?.kind !== "pause") units.push({ kind: "pause", key: "space", duration: .026 / rate });
      continue;
    }
    if (/[.,!?;:]/.test(token)) {
      units.push({ kind: "pause", key: token, duration: (/[.!?]/.test(token) ? .19 : .1) / rate });
      continue;
    }
    const vowel = token.match(/[aeiouy]/)?.[0];
    if (vowel) {
      const key = token === "ee" || token === "ea" ? "i" : token === "oo" || token === "ou" ? "u" : token === "oi" ? "o" : vowel;
      units.push({ kind: "vowel", key, duration: (token.length === 2 ? .115 : .082) / rate });
      continue;
    }
    if (/[mnlrw]/.test(token) || token === "ng") units.push({ kind: "voiced", key: token, duration: .062 / rate });
    else if (/[szfvxh]/.test(token) || token === "th" || token === "sh" || token === "ph" || token === "wh") units.push({ kind: "noise", key: token, duration: .058 / rate });
    else if (/[bcdfgjkpqt]/.test(token) || token === "ch" || token === "qu") units.push({ kind: "noise", key: token, duration: .043 / rate });
  }
  return units;
}

function seededNoise(seed: number) {
  let state = seed || 0x6d2b79f5;
  return () => {
    state = Math.imul(state ^ state >>> 15, state | 1);
    state ^= state + Math.imul(state ^ state >>> 7, state | 61);
    return (((state ^ state >>> 14) >>> 0) / 0xffffffff) * 2 - 1;
  };
}

function resonator(frequency: number, sampleRate: number, q: number) {
  const omega = 2 * Math.PI * Math.min(frequency, sampleRate * .45) / sampleRate;
  const alpha = Math.sin(omega) / (2 * q);
  const a0 = 1 + alpha;
  return { b0: alpha / a0, b2: -alpha / a0, a1: -2 * Math.cos(omega) / a0, a2: (1 - alpha) / a0, x1: 0, x2: 0, y1: 0, y2: 0 };
}

function filterSample(filter: ReturnType<typeof resonator>, input: number) {
  const output = filter.b0 * input + filter.b2 * filter.x2 - filter.a1 * filter.y1 - filter.a2 * filter.y2;
  filter.x2 = filter.x1;
  filter.x1 = input;
  filter.y2 = filter.y1;
  filter.y1 = output;
  return output;
}

/** A compact deterministic source-filter voice instrument derived only from proof-carried parameters. */
function synthesizeProofVoice(
  context: AudioContext,
  text: string,
  profile: ProofVoiceProfile,
  speakingMoment: SpeakingMoment,
  enrichment: PerformanceEnrichment | null
) {
  const sampleRate = 24_000;
  const units = proofSpeechUnits(text, profile.rate);
  const durationScale = enrichment?.durationScale ?? 1;
  const samples = Math.max(1, Math.min(sampleRate * 45, Math.ceil(units.reduce((sum, unit) => sum + unit.duration, 0) * durationScale * sampleRate)));
  const buffer = context.createBuffer(1, samples, sampleRate);
  const channel = buffer.getChannelData(0);
  const birthSeed = (Math.trunc(speakingMoment.birthMomentMs) ^ Math.imul(profile.seed, 0x85ebca6b)) >>> 0;
  const momentSeed = (Math.trunc(speakingMoment.uPulse) ^ Math.imul(birthSeed, 0x9e3779b1)) >>> 0;
  const noise = seededNoise(birthSeed ^ momentSeed);
  // Birth proof fixes the vocal anatomy. The Kai moment only supplies a small,
  // bounded performance contour, so the same being always remains recognizable.
  const fundamental = (96 + birthSeed % 118) * profile.pitch;
  const formantScale = .9 + ((birthSeed >>> 8) % 23) / 100;
  const momentWarmth = .985 + (momentSeed % 31) / 1_000;
  const phraseContour = ((momentSeed >>> 5) % 17 - 8) / 1_000;
  const initialBreathPhase = (Math.trunc(speakingMoment.uPulse) % 1_000_000) / 1_000_000;
  const breathCycleSeconds = KAI_PULSE_DURATION_MS / 1_000;
  let cursor = 0;
  let phase = 0;
  let peak = 0;
  for (let unitIndex = 0; unitIndex < units.length && cursor < channel.length; unitIndex += 1) {
    const unit = units[unitIndex]!;
    const count = Math.min(channel.length - cursor, Math.max(1, Math.round(unit.duration * durationScale * sampleRate)));
    if (unit.kind === "pause") {
      cursor += count;
      continue;
    }
    const formants = VOWEL_FORMANTS[unit.kind === "vowel" ? unit.key : "schwa"] ?? VOWEL_FORMANTS.schwa!;
    const filters = formants.map((frequency, index) => resonator(frequency * formantScale, sampleRate, 7 + index * 2));
    let priorNoise = 0;
    for (let offset = 0; offset < count; offset += 1) {
      const progress = offset / count;
      const envelope = Math.min(1, progress / .09, (1 - progress) / .12);
      const syllableStress = unit.kind === "vowel" && unitIndex % 3 === (momentSeed % 3) ? .026 : 0;
      const sentenceFall = phraseContour - progress * (unitIndex > units.length * .72 ? .025 : .006);
      const cadence = 1
        + Math.sin((unitIndex + progress) * 1.73 + (profile.seed % 31)) * .018
        + Math.sin(progress * Math.PI) * syllableStress
        + sentenceFall;
      phase += fundamental * cadence / sampleRate;
      phase -= Math.floor(phase);
      const breath = noise();
      const glottal = 2 * phase - 1 + Math.sin(phase * Math.PI * 2) * .26 + breath * .035;
      let value: number;
      if (unit.kind === "noise") {
        const high = breath - priorNoise;
        priorNoise = breath;
        const voicedEdge = /[bdgjvz]/.test(unit.key) ? glottal * .22 : 0;
        value = high * (/[szhx]/.test(unit.key) ? .38 : .24) + voicedEdge;
      } else {
        value = filterSample(filters[0]!, glottal) * .92
          + filterSample(filters[1]!, glottal) * .5
          + filterSample(filters[2]!, glottal) * .28;
        if (unit.kind === "voiced") value *= .62;
      }
      const performanceEnergy = enrichment?.energy.length
        ? .82 + enrichment.energy[Math.min(enrichment.energy.length - 1, Math.floor((cursor + offset) / channel.length * enrichment.energy.length))]! * .28
        : 1;
      // One canonical Kai Pulse is one complete Golden breath. Speech rides a
      // bounded airflow projection of that exact inhale/exhale cycle.
      const elapsedSeconds = (cursor + offset) / sampleRate;
      const goldenBreathPhase = (initialBreathPhase + elapsedSeconds / breathCycleSeconds) % 1;
      const goldenBreath = goldenBreathPhase < KAI_BREATH_INHALE_SHARE
        ? .86 + Math.sin(goldenBreathPhase / KAI_BREATH_INHALE_SHARE * Math.PI / 2) * .14
        : 1 - Math.sin((goldenBreathPhase - KAI_BREATH_INHALE_SHARE)
          / (1 - KAI_BREATH_INHALE_SHARE) * Math.PI / 2) * .14;
      value *= Math.max(0, envelope) * momentWarmth * performanceEnergy * goldenBreath;
      channel[cursor + offset] = value;
      peak = Math.max(peak, Math.abs(value));
    }
    cursor += count;
  }
  const scale = peak > .001 ? .72 / peak : 1;
  for (let index = 0; index < channel.length; index += 1) channel[index] *= scale;
  return buffer;
}

function conditionNeuralVoice(
  samples: Float32Array,
  sampleRate: number,
  profile: ProofVoiceProfile,
  speakingMoment: SpeakingMoment
) {
  const initialBreathPhase = (Math.trunc(speakingMoment.uPulse) % 1_000_000) / 1_000_000;
  const breathCycleSeconds = KAI_PULSE_DURATION_MS / 1_000;
  const fadeSamples = Math.max(1, Math.round(sampleRate * .008));
  const momentSeed = (Math.trunc(speakingMoment.uPulse) ^ profile.seed) >>> 0;
  const momentPresence = .985 + (momentSeed % 31) / 1_000;
  for (let index = 0; index < samples.length; index += 1) {
    const phase = (initialBreathPhase + index / sampleRate / breathCycleSeconds) % 1;
    const goldenBreath = phase < KAI_BREATH_INHALE_SHARE
      ? .94 + Math.sin(phase / KAI_BREATH_INHALE_SHARE * Math.PI / 2) * .06
      : 1 - Math.sin((phase - KAI_BREATH_INHALE_SHARE)
        / (1 - KAI_BREATH_INHALE_SHARE) * Math.PI / 2) * .06;
    const fadeIn = Math.min(1, index / fadeSamples);
    const fadeOut = Math.min(1, (samples.length - index - 1) / fadeSamples);
    samples[index] *= goldenBreath * momentPresence * Math.max(0, Math.min(fadeIn, fadeOut));
  }
  return samples;
}

function nextNeuralPhraseEnd(text: string, cursor: number, final: boolean) {
  const remaining = text.slice(cursor);
  if (!remaining) return cursor;
  if (final) return Math.min(text.length, cursor + 280);
  const bounded = remaining.slice(0, 280);
  let punctuationEnd = -1;
  for (const match of bounded.matchAll(/[.!?;:](?:\s|$)/g)) punctuationEnd = (match.index ?? 0) + match[0].length;
  if (punctuationEnd >= 24) return cursor + punctuationEnd;
  if (remaining.length < 150) return cursor;
  const wordEnd = bounded.lastIndexOf(" ", 220);
  return cursor + (wordEnd >= 80 ? wordEnd + 1 : Math.min(220, bounded.length));
}

function audioContext() {
  if (sharedAudioContext && sharedAudioContext.state !== "closed") return sharedAudioContext;
  const Constructor = window.AudioContext
    ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Constructor) throw new Error("creature_voice_audio_unsupported");
  sharedAudioContext = new Constructor();
  return sharedAudioContext;
}

function emitMouth(assetId: string, openness: number) {
  window.dispatchEvent(new CustomEvent("wildz-creature-mouth", {
    detail: { assetId, openness: Math.max(0, Math.min(1, openness)) }
  }));
}

function encodedAudio(chunk: CreatureVoiceChunk) {
  const encoded = chunk.audioB64u
    ?.replace(/^data:audio\/(?:wav|wave|mpeg|mp3|ogg|webm|mp4);base64,/i, "")
    .replace(/-/g, "+").replace(/_/g, "/") ?? "";
  if (!encoded || encoded.length > 6_000_000) throw new Error("creature_observer_voice_unavailable");
  const binary = atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "="));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
}

export async function unlockCreatureVoice() {
  if (typeof window === "undefined") return false;
  const context = audioContext();
  if (context.state !== "running") await context.resume();
  return context.state === "running";
}

export function cancelCreatureVoice() {
  activeStreamCancel?.();
  activeStreamCancel = null;
}

/**
 * Performs the creature's proof-derived voice locally. A matching Receiz v120
 * performance chunk may enrich it when already available, but never gates text,
 * proof memory, or the deterministic zero-network voice.
 */
export function beginCreatureVoiceStream(
  assetId: string,
  neural: ReturnType<typeof wildzStreamingVoiceProfile>,
  speakingMoment: SpeakingMoment,
  signal: AbortSignal,
  onEnded?: () => void,
  onStarted?: () => void
): CreatureVoiceStream {
  let context: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let filter: BiquadFilterNode | null = null;
  let gain: GainNode | null = null;
  let firstTextAt = 0;
  let finishing = false;
  let settled = false;
  let started = false;
  let pendingDecodes = 0;
  let nextStartAt = 0;
  let accumulatedText = "";
  let performanceEnrichment: PerformanceEnrichment | null = null;
  let animationFrame = 0;
  let decodeChain = Promise.resolve();
  const sources = new Set<AudioBufferSourceNode>();
  let resolveCompleted!: (played: boolean) => void;
  const completed = new Promise<boolean>((resolve) => { resolveCompleted = resolve; });

  const stopMouth = () => {
    if (animationFrame) cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    emitMouth(assetId, 0);
  };

  const settle = (played: boolean) => {
    if (settled) return;
    settled = true;
    stopMouth();
    analyser?.disconnect();
    filter?.disconnect();
    gain?.disconnect();
    resolveCompleted(played);
    if (played) onEnded?.();
  };

  const maybeFinish = () => {
    if (finishing && pendingDecodes === 0 && sources.size === 0) settle(started);
  };

  const abort = () => {
    if (settled) return;
    for (const source of sources) {
      try { source.stop(); } catch { /* already stopped */ }
      source.disconnect();
    }
    sources.clear();
    settle(false);
  };

  const startMouth = () => {
    if (!analyser || animationFrame) return;
    const waveform = new Uint8Array(analyser.fftSize);
    const animate = () => {
      if (!analyser || settled || sources.size === 0) {
        animationFrame = 0;
        emitMouth(assetId, 0);
        return;
      }
      analyser.getByteTimeDomainData(waveform);
      const energy = waveform.reduce((sum, value) => sum + Math.abs(value - 128), 0) / waveform.length / 31;
      emitMouth(assetId, Math.max(.02, Math.min(1, energy * neural.mouthResponse)));
      animationFrame = requestAnimationFrame(animate);
    };
    animate();
  };

  const ensureGraph = async () => {
    if (context && analyser && filter && gain) return { context, analyser, filter, gain };
    context = audioContext();
    if (context.state !== "running") await context.resume();
    if (context.state !== "running") throw new Error("creature_voice_audio_locked");
    analyser = context.createAnalyser();
    analyser.fftSize = 64;
    analyser.smoothingTimeConstant = .2;
    filter = context.createBiquadFilter();
    filter.type = "peaking";
    filter.frequency.value = neural.brightnessHz;
    filter.Q.value = .72;
    filter.gain.value = (neural.pitch - 1) * 28;
    gain = context.createGain();
    gain.gain.value = neural.volume;
    filter.connect(gain);
    gain.connect(analyser);
    analyser.connect(context.destination);
    return { context, analyser, filter, gain };
  };

  const scheduleBuffer = (
    buffer: AudioBuffer,
    graph: Awaited<ReturnType<typeof ensureGraph>>,
    engine: "receiz-proof-source-filter" | "receiz-proof-neural-offline"
  ) => {
      if (settled || signal.aborted) return;
      const source = graph.context.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = 1;
      source.detune.value = engine === "receiz-proof-neural-offline"
        ? 1_200 * Math.log2(neural.pitch)
        : 0;
      source.connect(graph.filter);
      sources.add(source);
      const startAt = Math.max(graph.context.currentTime + .012, nextStartAt);
      nextStartAt = startAt + buffer.duration / source.playbackRate.value;
      source.onended = () => {
        sources.delete(source);
        source.disconnect();
        if (sources.size === 0) stopMouth();
        maybeFinish();
      };
      source.start(startAt);
      if (!started) {
        started = true;
        onStarted?.();
        const ttfaMs = firstTextAt ? Math.max(0, performance.now() - firstTextAt) : 0;
        window.dispatchEvent(new CustomEvent("wildz-creature-voice-latency", {
          detail: {
            assetId,
            signature: neural.signature,
            ttfaMs: Math.round(ttfaMs * 10) / 10,
            targetMs: 300,
            withinTarget: ttfaMs <= 300,
            engine
          }
        }));
      }
      startMouth();
  };

  const queueChunk = async (chunk: CreatureVoiceChunk) => {
    if (settled || signal.aborted) return;
    if (chunk.voiceSignature && chunk.voiceSignature !== neural.signature) {
      throw new Error("creature_voice_signature_mismatch");
    }
    pendingDecodes += 1;
    try {
      const graph = await ensureGraph();
      const bytes = encodedAudio(chunk);
      let buffer: AudioBuffer;
      try {
        buffer = await graph.context.decodeAudioData(bytes.slice(0));
      } catch {
        if (graph.context.state !== "running") await graph.context.resume();
        buffer = await graph.context.decodeAudioData(bytes.slice(0));
      }
      // Receiz performance never replaces the creature's audible proof voice.
      // It contributes only a bounded cadence and emphasis envelope.
      const data = buffer.getChannelData(0);
      const bins = 32;
      const energy = Array.from({ length: bins }, (_, bin) => {
        const start = Math.floor(data.length * bin / bins);
        const end = Math.max(start + 1, Math.floor(data.length * (bin + 1) / bins));
        let sum = 0;
        for (let index = start; index < end; index += 1) sum += data[index]! * data[index]!;
        return Math.sqrt(sum / (end - start));
      });
      const peak = Math.max(.0001, ...energy);
      const localDuration = proofSpeechUnits(accumulatedText, neural.rate).reduce((sum, unit) => sum + unit.duration, 0);
      performanceEnrichment = {
        durationScale: Math.max(.9, Math.min(1.1, buffer.duration / Math.max(.1, localDuration))),
        energy: energy.map((value) => Math.max(0, Math.min(1, value / peak)))
      };
    } finally {
      pendingDecodes -= 1;
      maybeFinish();
    }
  };

  const queueLocalProofVoice = async () => {
    if (!accumulatedText.trim() || settled || signal.aborted) return;
    pendingDecodes += 1;
    try {
      const graph = await ensureGraph();
      const buffer = synthesizeProofVoice(graph.context, accumulatedText, neural, speakingMoment, performanceEnrichment);
      scheduleBuffer(buffer, graph, "receiz-proof-source-filter");
    } finally {
      pendingDecodes -= 1;
      maybeFinish();
    }
  };

  let useLocalNeural = localNeuralVoiceReady();
  let neuralTextCursor = 0;
  let neuralChain = Promise.resolve();

  const queueNeuralPhrase = (phrase: string) => {
    pendingDecodes += 1;
    neuralChain = neuralChain.then(async () => {
      if (settled || signal.aborted) return;
      const graph = await ensureGraph();
      try {
        const rendered = await renderLocalNeuralVoice(phrase, neural, speakingMoment.uPulse);
        const samples = Float32Array.from(conditionNeuralVoice(
          rendered.samples,
          rendered.sampleRate,
          neural,
          speakingMoment
        ));
        const buffer = graph.context.createBuffer(1, samples.length, rendered.sampleRate);
        buffer.copyToChannel(samples, 0);
        scheduleBuffer(buffer, graph, "receiz-proof-neural-offline");
      } catch {
        // The proof instrument is an always-local acoustic floor. This affects
        // neither authored text nor memory and is never surfaced as a failure.
        const buffer = synthesizeProofVoice(graph.context, phrase, neural, speakingMoment, performanceEnrichment);
        scheduleBuffer(buffer, graph, "receiz-proof-source-filter");
      }
    }).finally(() => {
      pendingDecodes -= 1;
      maybeFinish();
    });
  };

  const queueAvailableNeuralPhrases = (final: boolean) => {
    for (;;) {
      const end = nextNeuralPhraseEnd(accumulatedText, neuralTextCursor, final);
      if (end <= neuralTextCursor) break;
      const phrase = accumulatedText.slice(neuralTextCursor, end).trim();
      neuralTextCursor = end;
      if (phrase) queueNeuralPhrase(phrase);
      if (!final) break;
    }
  };

  cancelCreatureVoice();
  activeStreamCancel = abort;
  signal.addEventListener("abort", abort, { once: true });
  prepareLocalNeuralVoice();

  return {
    pushText(delta) {
      if (delta && !firstTextAt) firstTextAt = performance.now();
      accumulatedText += delta;
      if (useLocalNeural) queueAvailableNeuralPhrases(false);
    },
    pushAudio(chunk) {
      if (finishing || settled) return;
      decodeChain = decodeChain.then(() => queueChunk(chunk)).catch(() => undefined);
    },
    finish() {
      if (finishing || settled) return;
      finishing = true;
      useLocalNeural ||= localNeuralVoiceReady();
      if (useLocalNeural) queueAvailableNeuralPhrases(true);
      else {
        // The compact proof instrument starts without waiting for installation;
        // neural readiness is never placed in the response or memory hot path.
        void queueLocalProofVoice().catch(() => settle(false));
      }
      void decodeChain.finally(maybeFinish);
      void neuralChain.finally(maybeFinish);
      maybeFinish();
    },
    abort,
    completed
  };
}
