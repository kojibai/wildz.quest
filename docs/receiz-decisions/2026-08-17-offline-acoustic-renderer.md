# Receiz capability-gap decision: proof-conditioned human voice offline

Status: approved for the narrow Wildz v7 reference adapter

## Exact release identity

- `@receiz/sdk`: `120.0.0`
- `@receiz/mcp-server`: `120.0.0`
- `@receiz/ai-skills`: `120.0.0`
- registry digest: `0728651789b26e1d10c1991ec1c06c1ea4a576f0c6520537b250b171f8857073`
- operation-matrix digest: `1c779ee5ade4b877ae9c6922ab02ba96fffffeb7580f1cf105a59fbb4424f351`

## Requested outcome

Every verified living creature must speak with a stable, proof-derived, natural human voice in the browser. The same proof and Kai moment must reproduce the same voice/performance; later moments may vary naturally inside fixed bounds. Voice must remain available after installation without a server and must not delay gameplay, text, or proof memory.

## SDK inventory performed first

Inspected `subjects.brain.stream`, `subjects.twin.stream`, `subjects.twin.streamPerformance`, `subjects.twin.message`, the living-subject runtime, performance event types, examples, and installed source. V120 can carry an `audio_chunk` only when a caller/model callback already supplies `performance.audioB64u`. It ships no local acoustic graph, vocoder weights, voice vectors, payload manifest, installer, or offline renderer. Therefore the SDK contract can transport and bind performance but cannot synthesize human PCM offline by native composition.

## MCP inventory performed second

Inspected `receiz_subject_brain_stream`, `receiz_subject_twin_message`, `receiz_subject_brain_resolve`, the living-subject MCP map, schemas, and conformance examples. These tools expose inspection/operator surfaces over the same v120 runtime. They do not install or execute an offline acoustic payload and may not become browser runtime or proof authority.

## AI-skill doctrine performed third

Read the installed `receiz-live-proof-character` skill, its manifest, SDK map, MCP map, examples, and test contract. Required laws retained here: the exact proof head is authority; speech/performance is non-authoritative; failures preserve canonical state; server absence cannot erase proof intelligence; and presentation cannot gate proof admission or memory.

## Existing exact proof path

The verified card and current Vault membership admit the living subject. The local v120 Twin projects the exact brain and Kai state, Wildz forms/streams the bounded response, and `createObservedCreatureTurn` appends through the existing exact-head history path. Export/import and current-owner transfer carry that proof memory unchanged. The acoustic adapter receives only already-authored text plus proof-derived voice parameters and cannot alter any of those bytes or decisions.

## Proven capability gap

V120 lacks one primitive: an integrity-verifiable, worker-safe, local-only acoustic renderer payload that turns proof-bound text/performance coordinates into PCM without a caller-provided audio model.

## Minimal proposed addition

Wildz pins the minimal Kokoro 82M q8 English acoustic files, two human timbre vectors, Transformers.js loader, and one-thread ONNX Runtime WASM. Remote model loading is disabled. Proof identity selects stable conditioning; Kai state supplies bounded moment variation and Golden Breath. A dedicated worker has acoustic-rendering authority only. The compact mathematical source-filter instrument remains available without waiting.

## Cost and removal analysis

- Hot path and latency: background Cache Storage installation; worker initialization on the conversation surface; no capture/login/movement/render/text/memory wait.
- Runtime dependencies and payload: `kokoro-js@1.2.1`, `@huggingface/transformers@3.8.1`, approximately 127 MB installed once.
- Environment/configuration: no key, endpoint, account, or environment variable.
- Privacy/security/operational liability: exact same-origin files, immutable revision, checked SHA-256, remote model resolution disabled, no text leaves the device for acoustic rendering.
- Offline/portability/interoperability: works offline after the payload has been installed into the PWA cache; PCM exits through standard Web Audio.
- Failure and zero-write behavior: acoustic failure is presentation-only; the compact proof instrument can speak and canonical response/memory remain unchanged.
- Removal condition when Receiz gains the primitive: replace the adapter with the v121 SDK payload/profile/render APIs while retaining the same proof, Kai, PCM, and memory boundaries.

## Executable evidence

Architecture lock verifies dependency versions, remote loading disabled, worker/thread boundary, upstream revision, and every payload digest. Typecheck, lint, unit contracts, production build, SDK checker, MCP conformance, secret scan, offline browser playback, waveform mouth motion, and proof-memory independence remain release gates. Observed device latency must be reported separately from source-level scheduling.

## Approval

- Reviewer: Wildz product owner
- Exact approved scope: the local-only acoustic renderer and v121 SDK reference contract described above; no response, identity, custody, or proof-memory changes
- Date: 2026-08-17
