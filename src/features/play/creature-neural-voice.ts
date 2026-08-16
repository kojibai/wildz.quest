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
let activeSource: AudioBufferSourceNode | null = null;
let sharedAudioContext: AudioContext | null = null;

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
  if (sharedAudioContext) return sharedAudioContext;
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
      .then(async ({ KokoroTTS }) => {
        const hasWebGpu = "gpu" in navigator;
        if (hasWebGpu) {
          try {
            return await KokoroTTS.from_pretrained(KOKORO_MODEL, { dtype: "q8", device: "webgpu" });
          } catch {
            // WebGPU support varies across Safari releases. The quantized WASM
            // path is slower, but keeps the voice entirely local and portable.
          }
        }
        return KokoroTTS.from_pretrained(KOKORO_MODEL, { dtype: "q8", device: "wasm" });
      })
      .then((model) => {
        loadedModel = model;
        return model;
      })
      .catch((cause) => {
        modelPromise = null;
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

export function warmCreatureNeuralVoice() {
  if (typeof window === "undefined") return Promise.resolve(false);
  return loadModel().then(() => true).catch(() => false);
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

/**
 * Plays a generated local neural voice when the lazy model is ready. Returns
 * false quickly during first-load warming so the native expressive fallback
 * can answer immediately instead of leaving the creature silent.
 */
export async function playCreatureNeuralVoice(
  asset: PortableCardAsset,
  text: string,
  signal: AbortSignal
) {
  if (typeof window === "undefined" || signal.aborted) return false;
  await Promise.race([
    unlockCreatureNeuralVoice().catch(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, 250))
  ]);
  const model = await readyModelWithin(1_250);
  if (!model || signal.aborted) return false;
  const identity = creatureNeuralVoiceIdentity(asset);
  const generated = await model.generate(text, {
    voice: identity.voice,
    speed: identity.speed
  });
  if (signal.aborted) return false;
  const context = audioContext();
  const buffer = context.createBuffer(1, generated.audio.length, generated.sampling_rate);
  buffer.copyToChannel(Float32Array.from(generated.audio), 0);
  cancelCreatureNeuralVoice();
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(context.destination);
  activeSource = source;
  await new Promise<void>((resolve) => {
    const abort = () => {
      if (activeSource === source) cancelCreatureNeuralVoice();
      resolve();
    };
    signal.addEventListener("abort", abort, { once: true });
    source.onended = () => {
      signal.removeEventListener("abort", abort);
      if (activeSource === source) {
        source.disconnect();
        activeSource = null;
      }
      resolve();
    };
    source.start();
  });
  return !signal.aborted;
}
