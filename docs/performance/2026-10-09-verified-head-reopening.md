# Established account heads and gameplay stalls

Reopening an established account was replaying unchanged creature histories.
The browser's live admission marks disappear on a cold reload, so the stored
cards took the complete verifier path again. Its cooperative batches also used
the background scheduler, which waits for a frame on platforms without idle
scheduling. This multiplied startup delay with history length.

A separate production reproduction found three whole Identity Seal reads on
the rendering thread during wallet authorization retries. On a synthetic
7.76 MB serialized Seal they caused approximately 1.1-second frame gaps after
startup. Moving custody source inspection alone did not remove those reads.

## Changes and authority boundaries

- An authenticated, device-held inventory head remembers actual canonical
  admission. Its HMAC key is nonextractable and stored durably in IndexedDB.
  The head includes owner coordinates, ordered content root, schema, and
  verifier version. Only exact runtime-admitted immutable cards can retain it.
- Cold reopening authenticates the small head, freezes and matches the actual
  stored card bytes, then restores their live admission marks. It does not
  replay every history event. A forged digest/verified flag, different owner,
  missing key, changed bytes, or changed verifier version takes the ordinary
  local verifier path. Proof sources are preserved on every miss.
- Card hashes are cached only for exact immutable objects. Movement saves
  calculate a small ordered root instead of repeatedly serializing the same
  histories. This is a local admission optimization, not a new portable proof
  protocol or server authority.
- Received-creature custody has its own authenticated head, retained only from
  the codec's actual opened-source custody token and admitted lawful descendants.
  A retained head restores that exact token. Missing legacy custody is reopened
  in a worker from durable sources. Only key/actor coordinates cross to it;
  a worker success flag alone cannot grant authority.
- Wallet read and exact transfer authorization use the existing signing worker.
  It returns the same key identity with `portableState: null`, about 956 bytes
  in the large-Seal fixture. Authorization digests/signatures bind this identity
  artifact, with the existing scope, nonce, consent, session, and response checks.
  Original stored Seals and separate wallet source projections are unchanged.
- Required proof preparation has one initial timer turn, then short message
  tasks between history batches. It preserves responsiveness without waiting
  for a display interval for each batch. Optional background scheduling remains
  unchanged.
- Expired temporary upload cleanup runs after the world paints. Database v4
  adds an expiry index and deletes expired primary keys without `getAll` cloning
  the uploaded file bytes. Active identity, inventory, proof history, and the
  admission heads have no new expiry or cache-clear operation.
- The full atlas remains a lazy surface. After closing it, its retained component
  ignores walking-driven prop updates. Reopening receives all current props;
  it retains its prepared view and existing close/reopen behavior.
- Offline pointer/audio unlock exposed another existing pressure loop: walking
  retried unavailable soundtrack files on every scene update, producing 1,318
  unhandled fetch errors in two minutes. The runtime now tries cached files once
  while offline, remembers unavailable optional recordings until reconnection,
  and retains the current decoded or synthesized ambience. An online event
  refreshes the scene without adding a timer or movement/frame callback. Normal
  sample mixes, footstep gains, and successful online playback are unchanged.

The verifier constant in `wildz-inventory-memory.ts` must be bumped when canonical
card admission rules change. Service-worker CacheStorage cleanup does not delete
these IndexedDB proof sources or heads. A first installation of this version
performs normal local admission once if no retained head exists.

## Measurement scope

Production Chromium used a 390 × 844 viewport on this Mac. These are desktop
browser measurements, not a physical installed iPhone/iPad PWA trace. Only
synthetic accounts were seeded in isolated browser contexts; the existing
verification account's durable storage was retained. No actual user's private
Identity Seal was read or printed.

Startup comparisons used one valid 301-event creature history and identical
long-account state/position before and after. Native and long-account positions
were different, so the direct native-versus-long scene timing is not a controlled
account-type comparison. The Safari-like scheduler fallback was exercised by
disabling `scheduler` and `requestIdleCallback`; this does not emulate WebKit.
Three warm reloads followed an initial admission in each account. The baseline
is commit `7485e51`. Owner restoration is measured from the owner-state read's
completion to the restored snapshot progress mark. Interactive readiness waits
for the opening bar to disappear and the world controls to be visible.

The separate large-Seal fixture contains 16 signed snapshot copies of a valid
301-event received creature. Its stored serialized identity is 7,763,369 bytes;
the decoded JSON representation is about 13.58 MB. The displayed inventory has
the received creature and the normal owner starter. Its first run exercises
legacy custody recovery; later runs exercise the retained heads.

| Controlled long-history reopening | Baseline | Final | Reduction |
| --- | ---: | ---: | ---: |
| Local restoration after storage read | 362.350 ms | 15.670 ms | 95.7% |
| Opening complete / world controls ready | 741.360 ms | 415.315 ms | 44.0% |
| Main-thread Seal reads before ready | 0 | 0 | Already local |

Native ready time was 436.630 ms before and 439.665 ms after; this small sample
does not establish a native startup improvement or regression. Native local
restoration was 43.190 ms before and 13.990 ms after. Existing scene/GPU setup
still accounts for much of the remaining opening time; 50–53 ms initial tasks
in the final startup trace occurred before interactive readiness.

The large encrypted-Seal case made zero main-thread Seal reads in its first
upgrade, retained reopening, offline reopening, and two-minute trace. Retained
reopening also started zero custody workers. Its 32 MiB expired staged upload
was deleted through the new expiry index, its current staged upload remained,
and cleanup performed zero pending-upload value scans. The custody worker
transferred only a 112-byte owner-coordinate message; its completed operation
was checked by rereading the actual authenticated custody head.

The final offline run covered 120.050 seconds, 1,393 movement inputs, 17 camera
drags, and 34 distinct displayed positions. Across 14,404 frames, p95 was
9.140 ms and maximum was 16.665 ms, with zero gaps/tasks over 50 ms, zero
main-thread Seal reads, and zero unhandled errors. Before the audio retry fix,
the comparable two-minute offline run had 1,318 fetch errors and one 174.995 ms
frame gap. This observation does not establish the exact cause of that one gap.
After real network reconnection, all 15 optional embodied samples and both
location music/ambience files loaded successfully.

The separate first eight-second opening windows still sampled one frame gap
of 107.980–124.945 ms per reopening, without a main-thread task over 50 ms after
the readiness mark. Those short initial frame gaps were not isolated to a cause
by this patch. They are reported separately from the later two-minute trace;
this is not a claim that every initial render or device is entirely stall-free.

The [opening-frame follow-up](2026-10-09-opening-and-resource-motion.md)
isolates the optional shader compilation burst, schedules it between paints,
and removes repeated verification of unchanged admitted public-card responses.
It includes new measurements beginning input at the first playable HUD; the
numbers above describe the earlier patch before that follow-up.

Full map checks opened the World view and Fit all discovered territory, closed
it, walked with real keyboard input, rotated the actual camera, then reopened
it. The closed map held X 101, Z -238 while the HUD moved to X 97, Z -262;
reopening updated the map to X 97, Z -262. Its retained view was nonblank.
Walking p95 was 9.080 ms across 913 frames, maximum 9.340 ms; camera p95 was
8.945 ms across 382 frames, maximum 16.665 ms. Neither had a frame gap or main
thread task over 50 ms. Camera view matrices and player coordinates changed.
This is a small synthetic explored atlas; suppression of closed prop updates
also avoids that computation for larger saved atlases, whose absolute visible
rendering cost was not measured here.

The [measurement JSON](2026-10-09-verified-head-reopening-measurements.json)
records baseline/final startup rows, the source-read regression reproduction,
offline gameplay, and validation scope.

## Verification and reproduction

Canonical proof/admission, legacy migration, causal convergence, retirement,
wrong-owner, altered-byte, missing-key, custody, and unavailable-worker behavior
were covered. The new default wallet test uses real SDK signing and verifies
read and transfer signatures from the worker's small identity. Existing challenge,
scope, consent, session binding, distribution, and transfer tests remain intact.
An additional mixed-source custody check confirmed that owner-native creature
growth does not invalidate received-creature memory; the existing codec already
excludes native cards from its custody token. No extra source inspection or
ownership behavior was needed for that case.

The initial cold-reopen regression failed because it replayed admission. The
wallet regression failed because the default loader read IndexedDB on the main
thread rather than the provided signing worker. An existing queued-turn test
also caught timer/message ordering variability; the single initial timer turn
preserves that contract. The offline audio regression failed on an unhandled
fetch rejection; it now covers suppressed repeat attempts, continued fallback
ambience, and successful decoding after reconnect. The final suite passed
3,625 tests, with one skip.

The production build and lint passed. The two existing SDK vendor dynamic-require
warnings remain. No new graphics/audio asset, frame callback, authentication gate, network
publication protocol, or continuous map scan was introduced.

Reproduce the local fresh-object head check after compiling the test sources:

```sh
pnpm test
node scripts/benchmark-pwa-account-reopen.mjs --write-fixture /tmp/wildz-synthetic-history.json
node scripts/benchmark-verified-head-reopen.mjs /tmp/wildz-synthetic-history.json
```

The isolated Node probe measured a 7.267 ms median for five fresh-object retained
restorations, with zero further proof admissions and unchanged player/proof data.
Its first admission took 123.781 ms in that process. These numbers are local CPU
and memory-adapter timings, not browser startup or an iPhone speed claim.

Storage reads, exact content hashing/freezing, JavaScript startup, and scene/GPU
initialization still have costs. This change does not establish constant-time
loading for every archive size or zero latency on every device. Unsupported or
uncached worker transports retain the existing local fallback; that compatibility
path can still decode a large Seal on the main thread. Actual iPhone lifecycle,
large real-world archives, and visible full-atlas costs need device measurements.

## Reference ledger

- Loaded: `threejs-debug-profiler/SKILL.md`.
- Loaded: `references/debug-profile-checklists.md` (required entry checklist).
- Loaded: `references/checklists/scene-debugging.md` (console, canvas, camera,
  scene visibility, worker paths, and real movement checks).
- Loaded: `references/checklists/performance-profile.md` (production baseline,
  CPU tasks, source reads, frame intervals, storage pressure, and remeasurement).
- Loaded: systematic debugging and verification-before-completion guidance.
- Mobile-input checklist: not required for this patch; input handling, touch
  routing, physics, audio, and camera transforms were not changed. Real keyboard
  and pointer movement were used to verify the effects of background work.
- Prompt templates: not required; no reusable prompt was requested.

Browser screenshots were inspected for nonblank gameplay/map output. Temporary
QA logs are intentionally not committed because the generated browser script
contains a synthetic encrypted identity fixture. The committed measurement
artifact contains public timings and bounded errors only.
