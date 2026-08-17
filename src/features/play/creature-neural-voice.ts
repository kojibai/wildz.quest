"use client";

import { sha256PortableBasis, type PortableCardAsset } from "./portable-card";

const KOKORO_MODEL = "onnx-community/Kokoro-82M-v1.0-ONNX";
const CREATURE_VOICES = [
  "af_heart",
  "af_bella",
  "af_nicole",
  "am_fenrir",
  "am_michael",
  "am_puck",
  "bf_emma",
  "bm_george",
  "bm_fable"
] as const;

type KokoroModel = Awaited<ReturnType<typeof import("kokoro-js")["KokoroTTS"]["from_pretrained"]>>;

let modelPromise: Promise<KokoroModel> | null = null;
let loadedModel: KokoroModel | null = null;
const primedVoices = new Set<string>();
const primingVoices = new Map<string, Promise<boolean>>();
let activeSource: AudioBufferSourceNode | null = null;
let sharedAudioContext: AudioContext | null = null;

function emitCreatureMouthMotion(assetId: string, openness: number) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("wildz-creature-mouth", {
    detail: { assetId, openness: Math.max(0, Math.min(1, openness)) }
  }));
}

export function creatureNeuralVoiceIdentity(asset: PortableCardAsset) {
  const stats = asset.manifest.stats;
  const maximum = Math.max(1, ...Object.values(stats));
  const fingerprint = sha256PortableBasis(`${asset.id}:${asset.manifest.variant.traits.visualFingerprint}:kokoro-v1`);
  const seed = Number.parseInt(fingerprint.slice(7, 15), 16);
  return {
    schema: "wildz.creature_neural_voice.v1" as const,
    signature: `neural:${fingerprint.slice(7, 23)}`,
    voice: CREATURE_VOICES[seed % CREATURE_VOICES.length]!,
    speed: Math.max(.91, Math.min(1.09, .955 + stats.speed / maximum * .085 - stats.guard / maximum * .025))
  };
}

function audioContext() {
  if (sharedAudioContext && sharedAudioContext.state !== "closed") return sharedAudioContext;
  sharedAudioContext = null;
  const AudioContextConstructor = window.AudioContext
    ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) throw new Error("creature_neural_audio_unsupported");
  sharedAudioContext = new AudioContextConstructor();
  return sharedAudioContext;
}

async function loadModel() {
  if (loadedModel) return loadedModel;
  if (!modelPromise) {
    modelPromise = import("kokoro-js")
      .then(async ({ KokoroTTS, env }) => {
        // The unbundled Kokoro/Transformers entry preserves ONNX Runtime's
        // native dynamic import. Point it at version-matched, same-origin
        // runtime assets so neural speech never depends on a runtime CDN.
        env.wasmPaths = `${window.location.origin}/vendor/onnxruntime/`;
        const appleWebKit = /AppleWebKit/i.test(navigator.userAgent)
          && !/(?:Chrome|Chromium|CriOS|Edg|OPR)/i.test(navigator.userAgent);
        const hasReliableWebGpu = "gpu" in navigator && !appleWebKit;
        if (hasReliableWebGpu) {
          try {
            return await KokoroTTS.from_pretrained(KOKORO_MODEL, { dtype: "q8", device: "webgpu" });
          } catch {
            // The quantized WASM path keeps the voice local and portable when
            // a non-WebKit WebGPU implementation still rejects this graph.
          }
        }
        // Safari/iOS may expose navigator.gpu while ONNX session creation
        // stalls indefinitely. Use WASM directly so priming always completes.
        return KokoroTTS.from_pretrained(KOKORO_MODEL, { dtype: "q8", device: "wasm" });
      })
      .then((model) => {
        loadedModel = model;
        return model;
      })
      .catch((cause) => {
        modelPromise = null;
        console.warn("[Wildz voice] Kokoro model initialization failed", cause);
        throw cause;
      });
  }
  return modelPromise;
}

export async function unlockCreatureNeuralVoice() {
  if (typeof window === "undefined") return;
  const context = audioContext();
  if (context.state !== "running") await context.resume();
}

export function warmCreatureNeuralVoice(asset?: PortableCardAsset) {
  if (typeof window === "undefined") return Promise.resolve(false);
  return loadModel().then(async (model) => {
    if (!asset) return true;
    const identity = creatureNeuralVoiceIdentity(asset);
    if (primedVoices.has(identity.signature)) return true;
    const existing = primingVoices.get(identity.signature);
    if (existing) return existing;
    const priming = model.generate("I am awake.", {
      voice: identity.voice,
      speed: identity.speed
    }).then(() => {
      primedVoices.add(identity.signature);
      return true;
    }).catch((cause) => {
      console.warn("[Wildz voice] Kokoro voice priming failed", cause);
      return false;
    }).finally(() => {
      primingVoices.delete(identity.signature);
    });
    primingVoices.set(identity.signature, priming);
    return priming;
  }).catch(() => false);
}

export function isCreatureNeuralVoiceReady(asset?: PortableCardAsset) {
  if (!loadedModel) return false;
  return asset ? primedVoices.has(creatureNeuralVoiceIdentity(asset).signature) : true;
}

export function cancelCreatureNeuralVoice() {
  if (activeSource) {
    try { activeSource.stop(); } catch { /* already stopped */ }
    activeSource.disconnect();
    activeSource = null;
  }
}

async function readyModelWithin(milliseconds: number) {
  if (loadedModel) return loadedModel;
  const loading = loadModel().catch(() => null);
  return Promise.race([
    loading,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), milliseconds))
  ]);
}

function within<T>(work: Promise<T>, milliseconds: number) {
  return Promise.race([
    work,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), milliseconds))
  ]);
}

function playCreatureAudioBuffer(
  assetId: string,
  buffer: AudioBuffer,
  context: AudioContext,
  signal: AbortSignal,
  onEnded?: () => void
) {
  if (signal.aborted || context.state !== "running") return false;
  cancelCreatureNeuralVoice();
  const source = context.createBufferSource();
  const analyser = context.createAnalyser();
  analyser.fftSize = 64;
  analyser.smoothingTimeConstant = .28;
  const waveform = new Uint8Array(analyser.fftSize);
  source.buffer = buffer;
  source.connect(analyser);
  analyser.connect(context.destination);
  activeSource = source;
  let motionFrame = 0;
  const animateMouth = () => {
    analyser.getByteTimeDomainData(waveform);
    const energy = waveform.reduce((sum, sample) => sum + Math.abs(sample - 128), 0) / waveform.length / 34;
    emitCreatureMouthMotion(assetId, Math.max(.04, Math.min(1, energy)));
    motionFrame = window.requestAnimationFrame(animateMouth);
  };
  const abort = () => {
    if (activeSource === source) cancelCreatureNeuralVoice();
    if (motionFrame) window.cancelAnimationFrame(motionFrame);
    emitCreatureMouthMotion(assetId, 0);
  };
  signal.addEventListener("abort", abort, { once: true });
  source.onended = () => {
    signal.removeEventListener("abort", abort);
    if (motionFrame) window.cancelAnimationFrame(motionFrame);
    emitCreatureMouthMotion(assetId, 0);
    if (activeSource === source) {
      source.disconnect();
      analyser.disconnect();
      activeSource = null;
    }
    if (!signal.aborted) onEnded?.();
  };
  source.start();
  animateMouth();
  return true;
}

export async function playCreatureTwinVoice(
  asset: PortableCardAsset,
  dataUrl: string,
  signal: AbortSignal,
  onEnded?: () => void
) {
  if (typeof window === "undefined" || signal.aborted
    || !/^data:audio\/(?:wav|wave|mpeg|mp3|ogg|webm);base64,/i.test(dataUrl)
    || dataUrl.length > 6_000_000) return false;
  try {
    await unlockCreatureNeuralVoice();
    const bytes = await fetch(dataUrl).then((response) => response.arrayBuffer());
    if (signal.aborted || !bytes.byteLength) return false;
    const context = audioContext();
    const buffer = await context.decodeAudioData(bytes.slice(0));
    return playCreatureAudioBuffer(asset.id, buffer, context, signal, onEnded);
  } catch {
    return false;
  }
}

/**
 * Plays a generated local neural voice when the lazy model is ready. Returns
 * false quickly during first-load warming so the native expressive fallback
 * can answer immediately instead of leaving the creature silent.
 */
export async function playCreatureNeuralVoice(
  asset: PortableCardAsset,
  text: string,
  signal: AbortSignal,
  onEnded?: () => void
) {
  if (typeof window === "undefined" || signal.aborted) return false;
  await Promise.race([
    unlockCreatureNeuralVoice().catch(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, 250))
  ]);
  const model = await readyModelWithin(1_250);
  if (!model || signal.aborted) return false;
  const identity = creatureNeuralVoiceIdentity(asset);
  const generated = await within(model.generate(text, {
    voice: identity.voice,
    speed: identity.speed
  }), 10_000);
  if (!generated) return false;
  if (signal.aborted) return false;
  const context = audioContext();
  if (context.state !== "running") {
    try { await context.resume(); } catch { return false; }
  }
  if (context.state !== "running") return false;
  const buffer = context.createBuffer(1, generated.audio.length, generated.sampling_rate);
  buffer.copyToChannel(Float32Array.from(generated.audio), 0);
  if (!playCreatureAudioBuffer(asset.id, buffer, context, signal, onEnded)) return false;
  // Success means that neural speech began. Waiting for the entire clip made
  // the UI safety timer stop healthy Kokoro playback mid-sentence.
  return true;
}
