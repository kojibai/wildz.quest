"use client";

import type { PortableCardAsset } from "./portable-card";

let sharedAudioContext: AudioContext | null = null;
let activeStreamCancel: (() => void) | null = null;

export type CreatureVoiceStream = Readonly<{
  pushText: (delta: string) => void;
  finish: () => void;
  abort: () => void;
  completed: Promise<boolean>;
}>;

type VoiceSessionResponse = Readonly<{
  ok?: boolean;
  token?: string;
  voiceId?: string;
  signature?: string;
  model?: string;
  outputFormat?: string;
  sampleRate?: number;
  seed?: number;
  settings?: Readonly<{
    stability?: number;
    similarityBoost?: number;
    style?: number;
    speed?: number;
  }>;
  articulation?: Readonly<{ brightnessHz?: number; mouthResponse?: number }>;
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

function pcmBytes(value: string, carry: number | null) {
  const binary = atob(value);
  const joined = new Uint8Array(binary.length + (carry === null ? 0 : 1));
  let offset = 0;
  if (carry !== null) joined[offset++] = carry;
  for (let index = 0; index < binary.length; index += 1) joined[offset + index] = binary.charCodeAt(index);
  const evenLength = joined.length - (joined.length % 2);
  return { bytes: joined.slice(0, evenLength), carry: evenLength < joined.length ? joined[evenLength]! : null };
}

export function beginCreatureVoiceStream(
  asset: PortableCardAsset,
  cardAdmission: unknown,
  signal: AbortSignal,
  onEnded?: () => void,
  onStarted?: () => void
): CreatureVoiceStream {
  let socket: WebSocket | null = null;
  let pendingText = "";
  let firstTextAt = 0;
  let finishing = false;
  let settled = false;
  let started = false;
  let nextStartAt = 0;
  let byteCarry: number | null = null;
  let low = 0;
  let sampleIndex = 0;
  let animationFrame = 0;
  const sources = new Set<AudioBufferSourceNode>();
  let analyser: AnalyserNode | null = null;
  let filter: BiquadFilterNode | null = null;
  let mouthResponse = 1;
  let resolveCompleted!: (played: boolean) => void;
  const completed = new Promise<boolean>((resolve) => { resolveCompleted = resolve; });

  const settle = (played: boolean) => {
    if (settled) return;
    settled = true;
    if (animationFrame) cancelAnimationFrame(animationFrame);
    emitMouth(asset.id, 0);
    resolveCompleted(played);
    if (played) onEnded?.();
  };

  const abort = () => {
    if (settled) return;
    try { socket?.close(); } catch { /* already closed */ }
    for (const source of sources) {
      try { source.stop(); } catch { /* already ended */ }
      source.disconnect();
    }
    sources.clear();
    analyser?.disconnect();
    filter?.disconnect();
    settle(false);
  };

  cancelCreatureVoice();
  activeStreamCancel = abort;
  signal.addEventListener("abort", abort, { once: true });

  void (async () => {
    try {
      const context = audioContext();
      if (context.state !== "running") await context.resume();
      if (context.state !== "running" || signal.aborted) throw new Error("creature_voice_audio_locked");
      const response = await fetch("/api/receiz/creature-voice/session", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ card: asset, ...(cardAdmission ? { cardAdmission } : {}) }),
        signal
      });
      const session = await response.json().catch(() => null) as VoiceSessionResponse | null;
      if (!response.ok || session?.ok !== true || !session.token || !session.voiceId
        || !session.signature || session.model !== "eleven_flash_v2_5"
        || session.outputFormat !== "pcm_24000" || session.sampleRate !== 24_000) {
        throw new Error("creature_observer_voice_unavailable");
      }

      analyser = context.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = .22;
      filter = context.createBiquadFilter();
      filter.type = "peaking";
      filter.frequency.value = session.articulation?.brightnessHz ?? 2_400;
      filter.Q.value = .7;
      filter.gain.value = ((session.seed ?? 0) % 700) / 100 - 3.5;
      filter.connect(analyser);
      analyser.connect(context.destination);
      mouthResponse = session.articulation?.mouthResponse ?? 1;

      const query = new URLSearchParams({
        model_id: session.model,
        output_format: session.outputFormat,
        single_use_token: session.token,
        auto_mode: "true",
        apply_text_normalization: "off",
        inactivity_timeout: "60",
        seed: String(session.seed ?? 0)
      });
      socket = new WebSocket(`wss://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(session.voiceId)}/stream-input?${query}`);
      socket.onopen = () => {
        socket?.send(JSON.stringify({
          text: " ",
          voice_settings: {
            stability: session.settings?.stability ?? .5,
            similarity_boost: session.settings?.similarityBoost ?? .8,
            style: session.settings?.style ?? .1,
            use_speaker_boost: false,
            speed: session.settings?.speed ?? 1
          }
        }));
        if (pendingText) {
          socket?.send(JSON.stringify({ text: pendingText }));
          pendingText = "";
        }
        if (finishing) socket?.send(JSON.stringify({ text: "" }));
      };
      socket.onmessage = (event) => {
        if (signal.aborted || settled) return;
        const message = JSON.parse(String(event.data)) as { audio?: unknown; is_final?: unknown; isFinal?: unknown };
        if (typeof message.audio === "string" && message.audio) {
          const decoded = pcmBytes(message.audio, byteCarry);
          byteCarry = decoded.carry;
          if (decoded.bytes.length) {
            const view = new DataView(decoded.bytes.buffer, decoded.bytes.byteOffset, decoded.bytes.byteLength);
            const frameCount = decoded.bytes.length / 2;
            const buffer = context.createBuffer(1, frameCount, 24_000);
            const channel = buffer.getChannelData(0);
            const identity = session.seed ?? 0;
            const warmth = ((identity & 255) / 255 - .5) * .1;
            const harmonic = .008 + ((identity >>> 8) & 255) / 255 * .012;
            for (let index = 0; index < frameCount; index += 1) {
              const sample = view.getInt16(index * 2, true) / 32768;
              low += .07 * (sample - low);
              const pulse = 1 + Math.sin(sampleIndex++ / 24_000 * Math.PI * 2 * (4 + ((identity >>> 16) & 255) / 100)) * .003;
              channel[index] = Math.max(-1, Math.min(1, (sample + warmth * low + harmonic * sample * Math.abs(sample)) * pulse));
            }
            const source = context.createBufferSource();
            source.buffer = buffer;
            source.connect(filter!);
            sources.add(source);
            const startAt = Math.max(context.currentTime + .012, nextStartAt);
            nextStartAt = startAt + buffer.duration;
            source.onended = () => {
              sources.delete(source);
              source.disconnect();
              if (finishing && socket?.readyState === WebSocket.CLOSED && sources.size === 0) settle(started);
            };
            source.start(startAt);
            if (!started) {
              onStarted?.();
              const ttfaMs = firstTextAt ? Math.max(0, performance.now() - firstTextAt) : 0;
              window.dispatchEvent(new CustomEvent("wildz-creature-voice-latency", {
                detail: {
                  assetId: asset.id,
                  signature: session.signature,
                  ttfaMs: Math.round(ttfaMs * 10) / 10,
                  targetMs: 300,
                  withinTarget: ttfaMs <= 300
                }
              }));
            }
            started = true;
            if (!animationFrame) {
              const waveform = new Uint8Array(analyser!.fftSize);
              const animate = () => {
                analyser!.getByteTimeDomainData(waveform);
                const energy = waveform.reduce((sum, value) => sum + Math.abs(value - 128), 0) / waveform.length / 32;
                emitMouth(asset.id, Math.max(.025, Math.min(1, energy * mouthResponse)));
                animationFrame = requestAnimationFrame(animate);
              };
              animate();
            }
          }
        }
        if (message.is_final === true || message.isFinal === true) {
          finishing = true;
          socket?.close();
          if (sources.size === 0) settle(started);
        }
      };
      socket.onerror = abort;
      socket.onclose = () => {
        if (!finishing && !signal.aborted) return abort();
        if (sources.size === 0) settle(started);
      };
    } catch {
      abort();
    }
  })();

  return {
    pushText(delta) {
      if (!delta || finishing || settled) return;
      if (!firstTextAt) firstTextAt = performance.now();
      if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ text: delta }));
      else pendingText += delta;
    },
    finish() {
      if (finishing || settled) return;
      finishing = true;
      if (socket?.readyState === WebSocket.OPEN) {
        if (pendingText) socket.send(JSON.stringify({ text: pendingText, flush: true }));
        pendingText = "";
        socket.send(JSON.stringify({ text: "" }));
      }
    },
    abort,
    completed
  };
}
