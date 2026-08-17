# Receiz v120 creature voice architecture

This document is the binding implementation rule for creature speech in Wildz `v6.1.0`. The goal is a real Receiz neural performance, unique to the exact creature, ready on the first spoken reply without a browser model, provider-specific application route, warm-up download, generic substitute, or added capture/gameplay latency.

## The authority and runtime split

The exact verified card is authority. Its proof-derived creature brain carries an immutable `voiceSignature` and a deterministic `neuralInterface` projection. Speech, audio, visemes, expression, and mouth motion are performance projections; they cannot create a world event or rewrite the card.

The three Receiz packages have different jobs:

- `@receiz/sdk@120.0.0` is the application/runtime boundary. Wildz uses the v120 living-subject runtime to bind the exact proof brain and uses the existing Receiz Twin stream to request neural performance.
- `@receiz/mcp-server@120.0.0` is operator and conformance tooling. It never belongs in the browser bundle or reply hot path and is not a second speech service.
- `@receiz/ai-skills@120.0.0` is engineering doctrine. It requires exact proof retrieval, non-authoritative model output, zero-write failure, and explicit performance boundaries; it is not a runtime dependency or voice provider.

MCP output and AI instructions never outrank the verified card. The browser never calls a speech provider directly.

## End-to-end flow

1. The card panel projects and memoizes the verified creature brain while rendering. This projection includes the exact proof-derived neural voice lock.
2. A user Send gesture resumes the shared `AudioContext`, satisfying browser autoplay policy without a later warm-up ceremony. It does not load a model or fetch a voice.
3. The panel starts one SSE request to `/api/receiz/creature-observer`. There is no second voice-session request.
4. The route verifies the submitted proof object and current Vault custody once at its input boundary. This verification gives the route no authority; the exact proof object remains strongest truth.
5. Wildz projects that exact proof into the v120 living-subject runtime as primary proof objects and byte-preserved namespaces. The runtime establishes the live subject head, complete proof context, and the rule that model output is not a world event.
6. The observer consumes the official `receiz.subjects.twin.streamPerformance` API with the exact subject ID, owner, live `contextHead`, expected subject digest, and `responseMode: "performance"`. Voice identity comes from the proof-carried self model, not an application-selected provider voice.
7. Native v120 `reply_delta` events are forwarded immediately. Text rendering never waits for the complete reply or complete audio.
8. Native v120 `audio_chunk` and viseme/gaze/blink/breath/emotion/gesture events are forwarded on the same SSE response. No provider key, voice token, provider WebSocket, or browser model is added by Wildz.
9. The client rejects a mismatched signature, decodes the Receiz audio with Web Audio, and applies only the already-memoized proof transform: a bounded rate, detune, peaking-filter brightness, and gain adjustment.
10. An analyser reads the actual playing waveform each animation frame and emits mouth openness for the exact card. The mouth therefore follows audible energy rather than guessed text timing.
11. Audio chunks are scheduled sequentially while text continues to stream. The first generated preview may play before the final reply is complete.
12. The genuine Twin observation and the voice performance remain separate non-authoritative projections. The deterministic conversation append continues against the exact live proof head whether or not a device output succeeds; voice never gates, rewrites, or reorders memory.

## How one creature gets one stable voice

The voice lock is deterministic and portable:

```text
exact card id + immutable visual fingerprint
-> SHA-256-derived expression signature
-> eight deterministic signature bytes
-> bounded rate, pitch, volume, brightness, and mouth-response values
```

The signature is carried in the creature's proof-object self model and resolved by the v120 subject Twin. Receiz produces the real neural base performance. Wildz then makes a deliberately small live transformation so two creatures do not collapse to one presentation while the same creature does not change identity across reload, export/import, or bearer transfer.

The transform is not a synthesizer. It does not create speech, infer text, choose facts, or load model weights. It is comparable to a stable character-specific playback instrument applied to already-generated neural audio.

## Hot-path allowlist

The explicit conversation path may contain only:

- one already-required user gesture to resume the shared audio context;
- one proof-object verification at the route input boundary, with no server authority;
- current-owner/Vault-membership verification;
- exact v120 subject/proof-brain construction;
- one official v120 subject Twin performance stream carrying typed text, audio, and motion events;
- bounded SSE parsing and audio-size/signature checks;
- native browser audio decode;
- the small proof-derived Web Audio graph;
- sequential chunk scheduling; and
- waveform-driven mouth projection.

The capture and world-render loops contain none of this work. Roaming, movement, rendering, capture, card selection, and identity-session playback do not initialize a voice model or wait on speech.

## Explicit denylist

Do not add any of the following without a new reviewed architecture decision:

- a Wildz voice-provider API key or environment variable;
- a provider-specific voice-session route;
- a direct provider `fetch` or WebSocket from the browser;
- Kokoro, ONNX Runtime, Transformers, or other browser neural-model weights;
- `speechSynthesis` or a generic/base-voice substitute;
- warm-up fetches during capture, login, roaming, first paint, or the render loop;
- a local phrase/template reply presented as successful Twin intelligence;
- duplicate proof verification or brain projection inside one observer request;
- any voice condition that gates or changes the existing proof-memory append; or
- MCP/AI-skill imports in application runtime code.

## Latency contract

Wildz adds no separate voice-session round trip and no client model initialization. Text and audio arrive through the typed v120 subject-performance stream, and audio is scheduled with a 12 ms browser lead once decoded. The client records time from first text delta to first scheduled audio against a 300 ms target.

That metric is not permission to claim a universal end-to-end 300 ms network guarantee. Remote inference, transport, browser decode, device audio policy, and service availability are observable production conditions. Source qualification guarantees the absence of avoidable Wildz warm-up and duplicate provider work; authenticated production evidence is required before publishing a percentile latency claim.

## Failure and ownership invariants

- Proof memory depends on the genuine observation and deterministic exact-head append, never on audio playback.
- A returned voice signature that conflicts with the proof lock is rejected by the presentation layer without changing memory.
- A failed or aborted observation appends no conversation; a later device-output failure cannot erase an already-appended genuine observation.
- A device decode/playback failure is handled only inside presentation and uses no substitute voice.
- Turning voice off is an explicit user choice; it does not authorize a substitute voice.
- A card admitted to the current verified Vault may be observed by that Vault owner even when the carried historical owner field predates the claim. The admission proof authorizes current custody without rewriting historical capture.
- Bearer transfer preserves creature identity and voice signature while revoking former-owner authority.

## Release enforcement

Tests assert the exact v120 package pins, direct `subjects.twin.streamPerformance`, live head/digest binding, proof-signature projection, typed audio forwarding, native Web Audio transform, waveform mouth motion, zero local/browser/provider fallback, no voice environment variable, no duplicate client brain projection on Send, and unchanged proof-memory append semantics. `pnpm receiz:architecture-lock` mechanically rejects the displaced provider architecture and proof-authority violations. It runs inside `pnpm release:check` alongside `pnpm receiz:check` and `pnpm receiz:conformance`, so the SDK/MCP/AI release identity and authority laws are executable repository gates rather than optional guidance.
