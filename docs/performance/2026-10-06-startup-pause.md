# Startup pause investigation — 2026-10-06

The observed 208–217 ms startup interval combined scene construction with a
blocking first GPU draw. It was not a recurring network delay or Vault refresh.
Temporary production profiling attributed 131 ms to synchronous GPU program
queries during the first draw. The optional post-draw prewarm took 24 ms.

## Change

Submit only the normal initial scene programs between paints on browsers with
`KHR_parallel_shader_compile`. Poll its nonblocking completion status on retained
native program handles before letting the existing R3F loop draw. Do not poll
Three's mutable material properties: streamed disposal can invalidate them.
Cancel submission and polling on unmount, prune disposed handles, and return to
normal rendering on unsupported browsers, preparation errors, or context loss.

The existing first-completed-draw observer still controls world/HUD reveal.
Suspension still overrides rendering. Both normal and transmission variant
preparation remains in the existing post-draw background path. No changes to
geometry, textures, shadow settings, resolution, movement, admission, or saved
state are part of this patch. Temporary profiling code was removed afterward.

## Local production measurements

Codex in-app Chromium browser on the local Mac, native 339×664 viewport. The
world canvas remained 339×664 drawing-buffer pixels. Local restored explorer
and companion state was used; this is not a live authenticated large-Vault
qualification or a device-wide latency guarantee.

| Measurement | Original | Production helper |
| --- | ---: | ---: |
| First full draw | 158–163 ms | 32.75 ms first reload; 29.99 ms repeat |
| GPU program-query time across initial draws | 130.91 ms | 10.28 ms |
| Complete-world reveal, warm navigation | 420.18 ms | 368.90 ms |
| Draw calls | 108 | 108 |
| Geometries / textures on first draw | 99 / 15 | 99 / 15 |

The complete-world reveal was 430.97 ms on the helper build's first reload.
That run still had a separate 51 ms scene-construction task. The repeated warm
run had no main-thread tasks exceeding 50 ms. The live world's triangle count
varied with its current presentation (100,444–101,148); scene detail was not
reduced. Cache and host variation preclude a general percentage or zero-hitch
claim. Initial JS evaluation, scene assembly, asset loading, and driver work
still depend on the device and cache state.

## Verification

- Full suite: 3,220 passed, one skipped, zero failures.
- Seven new behavioral tests cover GPU completion, extension fallback,
  cancellation before/after submission, disposal, errors, and context loss.
- The tests failed before the helper existed. Removing the completion guard
  from the compiled test artifact also failed the readiness test; restoring it
  passed all seven tests.
- Existing completed-draw readiness, shader-state restoration, ground texture
  behavior, and exact terrain golden hashes pass.
- Independent read-only review found no actionable lifecycle or rendering
  regression. Final clean production browser checks are recorded below.

### Clean build checks

The final production build passes with the existing circular-chunk,
`web-worker` dependency, image, and hook warnings. No profiling imports, query
flags, renderer wrappers, or console telemetry remain in source.

The first clean-build recording included startup and opening the Story tools:
701 visible frames, 50 ms worst interval, no intervals over 50 ms, recent p95
9 ms, and one main-thread task over 50 ms. A repeated clean startup reached
7,544 visible frames at the final UI read: 42 ms worst interval, p95 9 ms, no
intervals or main-thread tasks over 50 ms. Recording was restored to off.

Walking updated the live HUD from Z −5 to Z −7, changed the discovery hint,
and admitted three new Travel records into the story ledger. The restored
companion and chapter progress remained intact. The map opened, closed,
resumed the existing renderer, and allowed further walking. The final browser
console had no errors.

The mixed movement/map recording also exposed a separate 683 ms interval and
one long task on the first atlas open. That first-use atlas stall is not fixed
by this world-startup patch; it is not included in the clean startup sample.
The atlas source was not changed, and this run alone does not establish whether
its timing regressed. This is a remaining qualification item, so this patch
must not be described as eliminating every application hitch.

Screenshot: `/private/tmp/wildz-startup-clean-verification.jpg`.

## Profiling references

Read: `threejs-debug-profiler/references/debug-profile-checklists.md`,
`checklists/performance-profile.md`, `checklists/scene-debugging.md`, and
`checklists/mobile-input.md`. The investigation measured production frame/task
timing, GPU query cost, draw calls, canvas resolution, geometry/texture counts,
and preserved the normal renderer and input ownership.
