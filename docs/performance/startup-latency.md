# Startup latency — 2026-09-26

Target: less than 300 ms from navigation to a complete, interactive world.
**Not achieved or certified by this change.** First contentful paint of the loading
screen is not game readiness, and game readiness alone does not prove that every
asynchronous texture or live world update has settled.

Changes:

- Start the shared ground texture decode immediately instead of waiting 1,200 ms.
  Preload the ground and limestone assets from the home page.
- Keep four closed lazy experience screens unmounted until their first use, then
  retain them so their close effects and local state work as before.
- Split seven optional inventory, crew, command, journal, saga, crafting and
  playtest panels out of the initial module graph.
- Reuse immutable route segment calculations during terrain sampling and reject
  impossible nearest candidates before calculating their Euclidean distance.
  Preserve the original arithmetic and tie behavior for candidate distances.

Evidence:

- Production build passes; existing webpack circular-dependency and unrelated
  lint warnings remain. First-load JS is 1.38 MB (1.41 MB before panel splitting).
- 151 targeted startup, terrain, render, shell, modal, and integration tests pass.
- Browser smoke check confirms the deferred crew panel renders and closes back
  to the world successfully.
- Every terrain field at 3,721 sampled positions matches the original SHA-256
  digest, including elevation, normal, surface, traversal, region and material.
- The single-process terrain sample probe took approximately 115 ms before and
  73 ms after. This is a CPU microbenchmark, not a browser startup guarantee.
- Local production browser probes use navigation-relative timing and observe
  the utility dock appearing after the existing first-complete-world-draw callback.
  They do not replace that callback or bypass identity/state admission.
- Baseline samples were 532 ms and 868 ms. An intermediate optimized warm sample
  was 473 ms. A final build first reload was 667 ms. Host/cache variation prevents
  claiming a stable percentage improvement from this small sample.

Remaining work toward 300 ms requires profiling initial module evaluation,
identity restoration and the first scene/GPU draw across representative devices
and cold networks. A first-scene main-thread task still took about 173 ms in the
final local probe. No production deployment or device-wide latency guarantee is
included.

## Follow-up: first-draw preparation

- Submit existing shader programs from the committed scene's layout effect on
  drivers with parallel shader compilation. The first actual draw still controls
  readiness. No rendering quality, admission, uniform reflection, completion
  polling or shader promise is added to the readiness gate.
- Publish the completed-draw callback in a cancellable microtask instead of
  waiting for another animation frame. Preserve previous scene callbacks and
  cancel pending readiness when the observer unmounts.
- Cache immutable landmark/overlook center elevations and skip masks outside
  their bounding axes before computing distance. Exact full sample equivalence
  holds across another 40,401 distant positions. Five CPU probe runs decreased
  from 66–70 ms to 52–54 ms for those positions.

Validation: production build and 87 focused tests pass. The normal crew control
still opens its panel. Intermediate warm GPU program-query time fell from 215 ms
before early submission to 107 ms after it; later final warm probes measured
88–95 ms. These are individual observations, not a controlled percentage claim.

The final production build's first local navigation measured 2,328 ms to the
existing playable-world reveal; two warm reloads measured 746 and 764 ms. An
intermediate shader-only build reached 430 ms in one warm reload. Host contention
and cache state varied substantially. **The below-300-ms requirement remains
unmet.** These measurements observe the completed-draw reveal, not settlement of
all remote updates or late material assets. GPU waits, module evaluation and
scene construction remain on the critical path. Temporary browser profiling
instrumentation was removed from the built output after measurement.

## Correction after final comparison

Early shader submission was removed after the final build failed to demonstrate
an end-to-end improvement. It submitted both normal and transmission variants
before the first draw (130 shader submissions versus 64 in the recorded baseline),
so lower query wait alone was insufficient evidence of a startup win. Host/cache
variation prevents attributing the entire regression to that change. Shader
preparation returns to its original deferred behavior. The terrain calculation
and cancellable completed-draw microtask changes remain; no claim of a verified
end-to-end startup improvement is made for them. The final build measurements
above describe the experimental early-submission version, not this correction.

## Combined cold-start and gameplay pass

The later gameplay pass reuses deterministic terrain samples across overlapping
streamed patches. The tile caches are bounded by both entries and estimated bytes,
and golden hashes verify exact mesh and water output, including after eviction.
For 30 adjacent tile centers in a Node CPU probe, patch projection took 578 ms
before caching and 146 ms after; water projection took 440 ms and 75 ms. These
totals are not browser frame times. The natural bark, leaf and skin texture loops
now skip calculations unused by their role; all generated RGBA bytes match the
previous algorithm.

Two fresh local production-browser runs of the combined main checkout reached
first contentful paint at 128 and 276 ms, canvas creation at 353 and 689 ms,
and the existing first-complete-draw reveal at 843 and 1,347 ms. The faster run
still included a 226 ms first-scene long task. One ten-second walk across several
tiles had 600 of 600 sampled frame gaps at or below 16.7 ms. An earlier walk had
one 550 ms gap, so hitch-free gameplay is not certified across runs or devices.
The first-complete-draw callback remains the readiness gate; it does not certify
settlement of later network and texture updates. **A cold, fully settled screen
below 300 ms has not been achieved or guaranteed.**
