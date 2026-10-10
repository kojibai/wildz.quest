/// <reference lib="webworker" />

import { env as transformersEnv } from "@huggingface/transformers";
import { env as kokoroEnv, KokoroTTS } from "kokoro-js";
import {createWorkerWorkQueue} from "./worker-work-queue";

const MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";
const LOCAL_MODEL_ROOT = "/models/";
const LOCAL_WASM_ROOT = "/vendor/onnxruntime/";
const LOCAL_VOICE_ROOT = `/models/${MODEL_ID}/voices/`;
const KOKORO_VOICE_CACHE = "kokoro-voices";
const KOKORO_REMOTE_VOICE_ROOT = "https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/voices/";
const workerScope = self as unknown as DedicatedWorkerGlobalScope;

type VoiceName = "af_heart" | "am_michael";
type WorkerRequest =
  | Readonly<{ type: "prepare" }>
  | Readonly<{ type: "cancel"; id:number }>
  | Readonly<{
    type: "render";
    id: number;
    text: string;
    voice: VoiceName;
    speed: number;
    voiceSignature: string;
    speakingUPulse: number;
  }>;

transformersEnv.allowLocalModels = true;
transformersEnv.allowRemoteModels = false;
transformersEnv.localModelPath = LOCAL_MODEL_ROOT;
transformersEnv.useBrowserCache = true;
const wasmBackend = transformersEnv.backends.onnx.wasm;
if (wasmBackend) {
  wasmBackend.numThreads = 1;
  wasmBackend.simd = true;
}
kokoroEnv.wasmPaths = LOCAL_WASM_ROOT;

let rendererPromise: ReturnType<typeof KokoroTTS.from_pretrained> | null = null;
let rendererBackend: "webgpu" | "wasm" = "wasm";
const enqueue=createWorkerWorkQueue();
const scheduled=new Set<number>(),canceled=new Set<number>();

async function seedLocalVoice(voice: VoiceName) {
  const cache = await caches.open(KOKORO_VOICE_CACHE);
  const kokoroKey = `${KOKORO_REMOTE_VOICE_ROOT}${voice}.bin`;
  if (await cache.match(kokoroKey)) return;
  const response = await fetch(`${LOCAL_VOICE_ROOT}${voice}.bin`, { cache: "force-cache" });
  if (!response.ok) throw new Error("wildz_local_voice_vector_missing");
  await cache.put(kokoroKey, response);
}

async function renderer() {
  if (!rendererPromise) {
    const voicesReady = Promise.all([
      seedLocalVoice("af_heart"),
      seedLocalVoice("am_michael")
    ]);
    const webgpuAvailable = "gpu" in navigator;
    rendererBackend = webgpuAvailable ? "webgpu" : "wasm";
    rendererPromise = voicesReady.then(async () => {
      if (webgpuAvailable) {
        try {
          return await KokoroTTS.from_pretrained(MODEL_ID, { dtype: "q8", device: "webgpu" });
        } catch {
          rendererBackend = "wasm";
        }
      }
      return KokoroTTS.from_pretrained(MODEL_ID, { dtype: "q8", device: "wasm" });
    });
  }
  return rendererPromise;
}

workerScope.addEventListener("message", (event: MessageEvent<WorkerRequest>) => {
  if(event.data.type === "cancel") {if(scheduled.has(event.data.id))canceled.add(event.data.id);return;}
  if (event.data.type === "prepare") {
    void renderer().then(() => {
      workerScope.postMessage({ type: "ready", backend: rendererBackend });
    }).catch(() => {
      rendererPromise = null;
      workerScope.postMessage({ type: "unavailable" });
    });
    return;
  }

  const request = event.data;
  scheduled.add(request.id);
  void enqueue(async () => {
    const voiceRenderer=await renderer();
    if(canceled.has(request.id))return;
    const output = await voiceRenderer.generate(request.text.slice(0, 280), {
      voice: request.voice,
      speed: Math.max(.86, Math.min(1.14, request.speed))
    });
    if(canceled.has(request.id))return;
    const samples = new Float32Array(output.audio);
    workerScope.postMessage({
      type: "rendered",
      id: request.id,
      sampleRate: output.sampling_rate,
      backend: rendererBackend,
      samples: samples.buffer
    }, [samples.buffer]);
  },()=>canceled.has(request.id)).catch(() => {
    workerScope.postMessage({ type: "render_failed", id: request.id });
  }).finally(()=>{scheduled.delete(request.id);canceled.delete(request.id);});
});
