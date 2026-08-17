"use client";

import type { wildzStreamingVoiceProfile } from "@/lib/receiz/wildz-voice-lock";

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
 * Plays Receiz v120 neural performance chunks and applies only a tiny,
 * proof-derived real-time timbre pass. The model and voice generation remain
 * inside Receiz; this client path is decoder, character lock, and mouth sync.
 */
export function beginCreatureVoiceStream(
  assetId: string,
  neural: ReturnType<typeof wildzStreamingVoiceProfile>,
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
      if (settled || signal.aborted) return;
      const source = graph.context.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = neural.rate;
      source.detune.value = (neural.pitch - 1) * 240;
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
            engine: "receiz-v120-proof-performance"
          }
        }));
      }
      startMouth();
    } finally {
      pendingDecodes -= 1;
      maybeFinish();
    }
  };

  cancelCreatureVoice();
  activeStreamCancel = abort;
  signal.addEventListener("abort", abort, { once: true });

  return {
    pushText(delta) {
      if (delta && !firstTextAt) firstTextAt = performance.now();
    },
    pushAudio(chunk) {
      if (finishing || settled) return;
      decodeChain = decodeChain.then(() => queueChunk(chunk)).catch(() => settle(false));
    },
    finish() {
      if (finishing || settled) return;
      finishing = true;
      void decodeChain.finally(maybeFinish);
    },
    abort,
    completed
  };
}
