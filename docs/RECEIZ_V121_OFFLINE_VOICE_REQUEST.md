# Receiz v121 offline acoustic renderer request

Wildz needs Receiz v121 to standardize the boundary already proven in Wildz v7: the proof object authors identity, intelligence, words, memory, and temporal performance; a local neural/vocoder payload only renders those admitted facts into human audio.

## What v121 should add

1. A signed `receiz.offline_acoustic_payload.v1` manifest with immutable payload ID, model/runtime file digests, byte sizes, license, supported sample rates, languages, and capability limits.
2. `subjects.voice.prepare(...)`, which installs and verifies a payload in background storage and returns readiness without entering capture, login, movement, proof admission, text response, or memory append paths.
3. `subjects.voice.profile(proofHead, temporalRoot)`, which deterministically derives the voice seed, bounded timbre coordinates, cadence, Golden Breath phase, and performance signature from admitted proof and Kai Klok state.
4. `subjects.voice.render(...)`, a worker-safe local-only PCM stream. Its input must include the exact authored text, proof-head digest, voice signature, Kai temporal root, and payload digest. Its output should carry PCM frames, sample rate, frame offsets, amplitude envelopes, and the same digests for verification.
5. A strict `allowRemote: false` mode that fails closed before any network model discovery. Payload resolution must accept same-origin URLs, installed PWA Cache Storage, IndexedDB/OPFS, and native filesystem adapters.
6. Cancellation, bounded phrase sizes, one-thread WASM defaults, explicit memory budgets, and observable preparation/render timing that never changes canonical state.
7. MCP inspection tools for payload verification, readiness, deterministic profile projection, and render conformance. MCP remains development/operations tooling and is not imported into the browser runtime.
8. An AI skill law stating that acoustic models have no semantic or identity authority and that audio availability can never gate proof memory.

## Minimal proposed contract

```ts
type OfflineVoiceRenderInput = {
  proofHeadDigest: string;
  voiceSignature: string;
  text: string;
  textDigest: string;
  temporalRoot: { uPulse: number; pulseDurationMs: number };
  payloadId: string;
  allowRemote: false;
};

type OfflineVoiceFrame = {
  pcm: Float32Array;
  sampleRate: number;
  startSample: number;
  proofHeadDigest: string;
  voiceSignature: string;
  textDigest: string;
  payloadDigest: string;
};
```

The SDK should own payload verification, worker lifecycle, voice-vector loading, and local inference. The application should provide only the verified proof object, Kai moment, admitted text, user audio permission, and waveform consumer.

## Wildz v7 reference adapter

Until v121 ships that primitive, Wildz carries a narrow adapter using Kokoro 82M q8, Transformers.js, and ONNX Runtime WASM. Only two human timbre vectors, the English tokenizer/phonemizer path, q8 acoustic graph, and one-thread WASM runtime are retained. The payload is pinned by revision and SHA-256, served from Wildz origin, cached after PWA registration, and executed in a dedicated worker with remote model loading disabled.

The adapter does not generate responses, inspect Vault ownership, append memory, call a provider, or choose creature identity. Removing it leaves the proof Twin and proof memory behavior unchanged.
