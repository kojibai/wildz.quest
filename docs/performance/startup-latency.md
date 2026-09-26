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
