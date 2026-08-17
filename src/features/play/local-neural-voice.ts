"use client";

import type { wildzStreamingVoiceProfile } from "@/lib/receiz/wildz-voice-lock";

type ProofVoiceProfile = ReturnType<typeof wildzStreamingVoiceProfile>;
type RenderedVoice = Readonly<{ samples: Float32Array; sampleRate: number }>;
type WorkerReply =
  | Readonly<{ type: "ready"; backend?: "webgpu" | "wasm" }>
  | Readonly<{ type: "unavailable" }>
  | Readonly<{ type: "rendered"; id: number; samples: ArrayBuffer; sampleRate: number; backend?: "webgpu" | "wasm" }>
  | Readonly<{ type: "render_failed"; id: number }>;

let worker: Worker | null = null;
let preparing = false;
let ready = false;
let backend: "webgpu" | "wasm" = "wasm";
let requestId = 0;
const pending = new Map<number, {
  resolve: (voice: RenderedVoice) => void;
  reject: () => void;
  timeout: number;
}>();

function ensureWorker() {
  if (worker || typeof window === "undefined" || typeof Worker === "undefined") return worker;
  worker = new Worker(new URL("./local-neural-voice.worker.ts", import.meta.url), {
    name: "wildz-proof-voice",
    type: "module"
  });
  worker.addEventListener("message", (event: MessageEvent<WorkerReply>) => {
    if (event.data.type === "ready") {
      ready = true;
      backend = event.data.backend ?? "wasm";
      preparing = false;
      window.dispatchEvent(new Event("wildz-local-neural-voice-ready"));
      return;
    }
    if (event.data.type === "unavailable") {
      ready = false;
      preparing = false;
      return;
    }
    if (!("id" in event.data)) return;
    const request = pending.get(event.data.id);
    if (!request) return;
    window.clearTimeout(request.timeout);
    pending.delete(event.data.id);
    if (event.data.type === "rendered") {
      request.resolve({
        samples: new Float32Array(event.data.samples),
        sampleRate: event.data.sampleRate
      });
    } else request.reject();
  });
  worker.addEventListener("error", () => {
    ready = false;
    preparing = false;
    for (const request of pending.values()) {
      window.clearTimeout(request.timeout);
      request.reject();
    }
    pending.clear();
    worker?.terminate();
    worker = null;
  });
  return worker;
}

/** Starts only the isolated acoustic worker; it never blocks proof, UI, or play. */
export function prepareLocalNeuralVoice() {
  const localWorker = ensureWorker();
  if (!localWorker || ready || preparing) return;
  preparing = true;
  localWorker.postMessage({ type: "prepare" });
}

export function localNeuralVoiceReady() {
  return ready;
}

export function localNeuralVoiceBackend() {
  return backend;
}

/** Renders words already authored by the proof Twin; the renderer has no semantic authority. */
export function renderLocalNeuralVoice(
  text: string,
  profile: ProofVoiceProfile,
  speakingUPulse: number
): Promise<RenderedVoice> {
  const localWorker = ensureWorker();
  if (!localWorker || !ready) return Promise.reject(new Error("wildz_local_neural_voice_not_ready"));
  const id = ++requestId;
  const voice = profile.seed & 1 ? "af_heart" : "am_michael";
  return new Promise<RenderedVoice>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      pending.delete(id);
      reject(new Error("wildz_local_neural_voice_timeout"));
    }, 15_000);
    pending.set(id, { resolve, reject: () => reject(new Error("wildz_local_neural_voice_failed")), timeout });
    const momentSeed = (Math.trunc(speakingUPulse) ^ Math.imul(profile.seed, 0x9e3779b1)) >>> 0;
    const momentCadence = .992 + ((momentSeed >>> 9) % 17) / 1_000;
    localWorker.postMessage({
      type: "render",
      id,
      text,
      voice,
      speed: profile.rate * momentCadence,
      voiceSignature: profile.signature,
      speakingUPulse
    });
  });
}
