# Receiz v120 proof-voice architecture

This is the binding Wildz v7 creature speech contract. The verified portable proof object is the authority for identity, memory, vocal identity, and response boundaries. A server, model, audio service, browser-selected system voice, or device cache is never required to form the creature's response or construct its voice.

## Receiz-first reasoning

The implementation starts from the pinned Receiz inventory, in this order:

1. `@receiz/sdk@120.0.0` admits the exact card into the local living-subject runtime and observes its proof brain through `runtime.subjects.twin.message`.
2. `@receiz/mcp-server@120.0.0` is conformance and operator tooling. It is not imported into application runtime code.
3. `@receiz/ai-skills@120.0.0` supplies repository doctrine: proof retrieval first, model output non-authoritative, deterministic admission, and zero-write failure.

The SDK, MCP, and AI skills do not create a second authority. The proof object remains strongest truth, the local v120 Twin is its bounded observer, and the server is optional transport/enrichment only.

## Immediate response path

1. The already-rendered card has a memoized proof-brain projection.
2. Send resumes the shared `AudioContext` under the same user gesture. It loads no model, binary, provider client, or voice asset.
3. The v120 living-subject runtime admits the exact card objects and asks its local Twin to observe the message at the exact Kai moment.
4. `proofGroundedCreatureReply` forms a bounded autobiographical answer from innate self, capture, admitted lived events, condition, relationships, prior conversations, the current message, and the current Kai `uPulse`.
5. Text begins rendering immediately. The accepted turn appends through the unchanged exact-head proof-memory path at `reply_done`; it never waits for audio or stream closure.
6. The client constructs speech locally from the proof voice lock, birth moment, speaking moment, and response text.
7. Actual output waveform energy drives the creature's mouth.

No unavailable enrichment status is shown to the player. Remote absence is not a product state.

## How the local voice is constructed

The voice is a deterministic source-filter vocal instrument, not a set of notification tones and not a device-selected generic voice.

```text
proof expression signature + exact birth timestamp
  -> stable vocal anatomy
     fundamental range, vocal-tract scale, brightness, breath character,
     rate, gain, mouth response

response graphemes
  -> bounded speech units
     vowels, voiced consonants, fricatives/plosives, pauses

human vocal model
  -> glottal excitation + breath/noise excitation
  -> three vocal-tract formant resonators
  -> consonant edges + coarticulated envelopes

current Kai uPulse
  -> subtle bounded cadence, stress, phrase fall, warmth, and airflow
  -> one canonical 5.236... second Kai Pulse is one complete Golden breath
     inhale = 1 + sqrt(5) seconds; exhale = 2 seconds

Web Audio buffer
  -> proof-character filter/gain -> waveform mouth analysis -> device output
```

Birth establishes identity. The current speaking moment may influence performance only inside narrow bounds, so it cannot replace the creature's recognizable voice or alter what was said. The exact micro-pulse phase anchors a complete inhale/exhale airflow envelope to `KAI_PULSE_DURATION_MS = (3 + sqrt(5)) * 1000`. The split comes directly from `/klok`: inhale is `1 + sqrt(5)` seconds and exhale is `2` seconds, producing the canonical Fibonacci/Golden proportion rather than an invented 50/50 waveform. Syllables ride inside that deterministic Golden breath. Reopening, exporting/importing, or transferring the same exact creature preserves its identity inputs and therefore its voice.

This design is fully local and deterministic. It adds no neural-model weights, ONNX/WASM voice runtime, provider key, environment variable, voice download, warm-up request, or new dependency. It also does not claim that a compact source-filter instrument is acoustically identical to a large trained studio neural model on every phoneme and device. Receiz Twin performance may improve cadence when available, but product correctness never depends on that enrichment.

## Additive Receiz Twin enrichment

The route may ask `receiz.world.message("wildz")` to perform the exact already-formed proof response. That work is bounded, non-authoritative, caught, and invisible.

If a matching performance audio primitive arrives before local playback begins, Wildz decodes it only to derive a bounded duration ratio and normalized emphasis envelope. The remote waveform is not played as a replacement voice. The creature's local proof voice remains the sole audible carrier and applies any usable cadence/emphasis information inside its own anatomy. Late, missing, malformed, or mismatched enrichment contributes nothing and cannot delay, fail, or change the turn.

## Hot-path allowlist

- the existing Send gesture and shared `AudioContext` resume;
- exact proof/Vault-custody verification;
- local v120 subject admission and Twin observation;
- bounded proof-grounded text composition;
- SSE text parsing;
- deterministic source-filter buffer construction;
- native Web Audio scheduling; and
- waveform mouth projection.

Capture, login, roaming, movement, rendering, and card selection contain none of this work. Optional server enrichment runs outside the required result path and cannot gate first text, proof append, or local speech.

## Denylist

- server or model authority over identity, memory, response admission, or voice identity;
- provider-specific voice routes, keys, sockets, or browser calls;
- `speechSynthesis`, generic/base substitute voices, Kokoro, ONNX Runtime, Transformers, ElevenLabs, or downloaded browser models;
- remote audio replacing the local proof voice;
- enrichment waits in the reply, memory, capture, movement, or render hot paths;
- visible “voice unavailable”, “no enrichment”, or substitute/degraded-mode copy;
- voice success gating, rewriting, reordering, or erasing proof memory;
- duplicate proof projection on Send; and
- MCP or AI-skill packages imported into runtime code.

## Failure and ownership invariants

- A valid proof brain always forms its bounded local response without a network.
- Conversation memory is independent of audio output and uses the existing exact-head append.
- An explicit Voice off choice suppresses playback, not response or memory.
- Browser autoplay/output policy can physically prevent sound; application code cannot truthfully override the operating system. Such a device condition remains presentation-only and is never reported as missing intelligence or missing enrichment.
- A newly claimed card chats through current verified Vault custody even if its historical capture owner differs. Transfer preserves the brain, history, proof voice inputs, and creature identity while revoking former-owner authority.

## Mechanical enforcement

`pnpm receiz:architecture-lock` rejects server-authoritative response rails, missing local v120 proof intelligence, missing proof voice construction, missing birth/Kai inputs, provider/browser-model dependencies, visible enrichment errors, voice-gated memory, or runtime MCP/AI-skill imports. It runs inside `pnpm release:check` with SDK conformance and the full release suite.
