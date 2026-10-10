# Vault acoustic allocation investigation

The reported symptom is an installed iPhone 17 PWA restarting while the
`bjklock` Identity Seal account opens and scrolls the Vault on iOS 26.5.2.
The report dates the regression to a prior branch merge. Desktop checks below
establish an avoidable allocation and its trigger; they do not establish an
iOS jetsam event or prove that this allocation alone caused the restart.

## Source and history evidence

Opening `WildsInventory` chooses a selected card immediately and mounts
`CreatureConsciousnessPanel`, including for a retired creature. Its mount
effect called `prepareLocalNeuralVoice()` before any conversation. The adapter
created the `wildz-proof-voice` module worker and sent `{ type: "prepare" }`.
The worker's `prepare` handler calls `renderer()`, which seeds both local voice
vectors and creates a Kokoro q8 renderer with WebGPU first, WASM fallback.

The shipped `model_quantized.onnx` is **92,361,116 bytes (88.08 MiB)**. The
renderer promise and worker are singletons retained after preparation;
successful preparation has no idle release. A worker moves the allocation
off the UI thread but shares the browser process's resource budget. File size
is evidence of payload size, not a measurement of peak resident or GPU memory.

`git blame` identifies **cc12490 (2026-08-17)** as the commit adding the mount
preparation. `git diff e3ed039^1 e3ed039` confirms that the **2026-10-06 prompt
creation merge** changed neither `WildsInventory`, `CreatureConsciousnessPanel`,
the voice adapter/worker, nor `WildsCardScene`. The merge's CSS additions do not
change these card surfaces. The voice allocation therefore predates that merge;
it cannot honestly be described as a newly introduced model prewarm regression.

That merge added a creation controller and a **lazy worker-client facade** to
`PlayCampaign`, plus creation rendering to `WildsWorldCanvas`. Calling
`createCreationPhysicalWorkerClient()` does not create a Worker. A platform
boundary trace observes zero Workers after constructing the client, one only
after its first `project()` request, and one termination when closed. The
physical worker has no neural model: it derives geometry and transfers chunk
position/normal buffers. Restore projects only actual source creations.

The creation renderer mounts only
when admitted source projections exist. Its pages allocate Three geometry and
materials, use paced residency, and dispose their geometry/material leases.
The shared creation material estimate is 8.25 MiB for 512-pixel maps
(medium/high), 2.25 MiB for 256-pixel maps (low), including mip levels and
fallbacks. Render geometry uses position/normal/UV buffers (32 bytes/vertex);
the medium residency ceiling is 48,000 vertices before subtracting the world's
existing rendering usage. These are source budgets, not actual account GPU
measurements.

The world Canvas continues rendering under a Vault command panel; its current
`suspended` input covers map/dream. These are additional allocation paths worth
measuring against the account's real restored world. They are not established
as this phone's restart cause by the present source inspection.

The card list is paginated (a bounded slice of `matches`), uses inline SVG
thumbnails, and has one selected card scene. Executing the real Inventory and
its descendant components against a synthetic 68-card fixture yields:

| Presentation | Thumbnail SVGs | Selected card scenes | Creature SVGs total | Canvas elements | Markup bytes |
| --- | ---: | ---: | ---: | ---: | ---: |
| Initial eight-card slice | 8 | 1 | 9 | 0 | 72,352 |
| After the mobile media effect | 4 | 1 | 5 | 0 | 51,073 |

This is a DOM/allocation-path check, not a screenshot or a GPU memory capture.
The HUD selector retains complete logical scroll slots but bounds actual
thumbnail content (eight initially plus the active card when outside the
window; expanded book uses eight-card pages plus adjacent page overscan).
World home residents are capped at two, supports at two, and independent crew
draws at two/three/four for low/medium/high quality. Texture maps are shared per
surface role, not allocated per owned card. The 68-WebGL-card-preview hypothesis
is unsupported by these actual rendering paths. The prior lazy full-proof
details change remains intact.

## Reload and PWA paths

`WildsGraphicsLifecycle` only records `webglcontextlost` and restoration; it
does not reload or recreate a renderer. The controller reloads after an
explicit Apply update action and navigates only for a distinct launch link.
Both record their requested reason. Opening a Vault or scrolling has no reload
handler. The 12-entry lifecycle journal records boot, panels, context loss,
page transitions, explicit requests, and browser-reported discards without
calling an unexplained restart "memory pressure".

There is a separate, unchanged service-worker **download-only** pre-cache of
the acoustic payload at app registration (also introduced by cc12490).
`populateLocalVoicePayload()` sequentially fetches/caches missing assets and
checks a complete-once ready marker; it does not create an inference session or
decode the model with `arrayBuffer()`. This change removes the inferred model
runtime during browsing, not that preexisting offline download/cache behavior.

## Narrow change

Remove only the Consciousness panel's mount-time neural preparation and its
unused import. The existing `beginCreatureVoiceStream()` continues calling
`prepareLocalNeuralVoice()` synchronously when an enabled conversation starts.
Text-only requests and retired cards do not enter that voice stream.

The authored creature text, proof brain, complete history, observation admission,
stream cancellation, stable voice profile, and worker model remain unchanged.
The first cold spoken response can use the existing compact proof instrument
while preparation runs; a ready model follows the existing neural playback
path. Neither response generation nor memory commit waits for installation.
After an actual spoken request, successful model retention remains as before.

Instant prepared card/Vault exports and registered wallet/application identity
restored in **97a096f** are unchanged.

## Behavioral evidence

`tests/wildz-vault-neural-voice-intent.test.ts` executes the actual panel through
the deterministic component harness and the actual voice adapter. It replaces
only platform Worker, audio, and observer transport boundaries; it does not
mock `prepareLocalNeuralVoice()` or the acoustic stream.

Before the production change, the first assertion fails: opening creates
**one worker**, expected **zero**. After the change:

- Opening, scroll events, card changes, and presentation rerenders create zero
  neural workers. Text-only and retired-card submits also create zero.
- A voice-enabled message creates the same named module worker and posts the
  existing `{ type: "prepare" }` message before the observer response.
- A cold spoken reply, with no `ready` model reply, schedules nonzero PCM via
  `receiz-proof-source-filter` and completes playback. It does not wait for a
  neural renderer to become ready.

An isolated test compiler output directory avoids the shared test/dev runtimes.
The focused suite covers this behavior, consciousness/history admission, bond
history verification reuse, full 97-card Vault restoration, lazy complete proof,
and instant prepared Save. **54 tests pass, zero failures.** Compilation succeeds
with the normal Next environment declarations included. No full build or
`pnpm test` was run by this investigation subtask.

An additional isolated run passes **49 PWA, service-worker, restart-journal,
and drawer/rail tests**, including actual service-worker event harness tests.

Remaining device validation is the installed PWA flow with the real account:
open Vault, scroll, switch cards, use prepared Save, and speak to a creature.
Compare lifecycle records and iOS process diagnostics before claiming a restart
cure or naming the operating system's termination reason.
