# Established PWA reopening and early gameplay

Target: an installed iPhone/iPad PWA returning to an existing Identity Seal
account, including large creature histories. This patch is local and has not
been deployed or measured on the user's iPhone. Zero cold-start time or an
indefinitely running background iOS process is not certified.

## Causes and changes

- Established Identity Seal and proof-sealed Vault sessions bootstrap from
  locally stored authority and owner state. Their normal artifact opener uses
  the local Receiz verifier with network access forbidden. Local gameplay does
  not wait for an account lookup, remote reauthentication, or synchronization.
  Optional connected-session work now starts after the completed world draw;
  going offline cancels its queued retry, and reconnect resumes when online.
- The service worker waited for a network response before returning its saved
  root document. It now returns the cached public shell immediately and
  refreshes in the worker. Refresh and installation save the document only
  after its referenced Next assets are available. Missing/private responses
  preserve the last usable shell. Private APIs remain network-only; explicit
  update activation remains available.
- The manifest requested navigation of an existing app window. Supporting
  browsers now focus that window. The launch consumer preserves ordinary root
  launches and still navigates explicit account callbacks and card/profile
  links. This setting is not a claim of iOS Launch Handler support.
- Optional crew reopening always decrypted and inspected the full Identity
  Seal, including its embedded Vault. Original-owner cards now avoid that
  inspection, and authenticated retained sources avoid it when they authorize
  every foreign card. The Seal remains the fallback for missing custody.
  Optional custody reopening starts after the completed world draw.
- Inventory preparation yielded between cards, but a single long history
  replay was synchronous. Both synchronous and cooperative verification now
  use the same event checks. Long histories yield in approximately 4 ms work
  slices; individual event/hash/freeze work can exceed that budget. Only the
  exact deeply frozen, fully checked history reuses its runtime result. The
  enclosing card still passes its complete verifier. No stored verified flag,
  claimed digest, source coordinate, or plain custody object admits bytes.
- The atlas read shader diagnostic logs in production and synchronized the
  GPU during its first open. It now uses the existing world policy: diagnostic
  shader-log reads in development. Scene quality and map interactions remain.
- Direct immutable card admission now omits the redundant complete-card text
  cache encoding. It still checks the manifest digest, every history event and
  its authority, then retains the exact deeply frozen object for runtime reuse.
  The normal decoded-content cache remains available to other verification
  callers. No durable proof, account, or progress storage is cleared.
- Standalone card publication starts after the completed world draw and uses
  background scheduling for its initial queue, online recovery, and retries.
  Offline opening avoids the request attempt; later online recovery still runs.
- Profile and Vault keep their complete local display projection ready in
  memory, as before. Only the serialized profile publication key is prepared
  after the completed world draw, in the background. Opening either surface
  does not wait for that encoding or publication. A complete preceding sync
  snapshot remains usable while the next encoding is prepared; equal content
  keeps its publication key and does not restart an in-flight request.

## Measurements

Production Chromium at a 390 × 844 CSS viewport on the local Mac. These are
individual samples, with host/cache variation, not iPhone measurements.

| Scenario | Observation |
| --- | --- |
| Initial new local account | FCP 132 ms; completed-world readiness 975 ms; startup tasks 103/83/87 ms |
| Established small local account reload, baseline | Completed-world readiness 426 ms; one 55 ms scene task |
| 25 seconds walking during the first two minutes | p95 frame interval 9.1 ms; first gesture included a 104 ms task attributed to native AudioContext creation |
| First atlas open, before | 367 ms main-thread task; worst frame interval 375 ms; GPU shader-log reads dominated CPU samples |
| First atlas open, after | No JavaScript task over 50 ms; worst interval 58 ms; p95 9.2 ms; map region/center/close controls worked |
| Synthetic cold owner-state restore, before | One valid card, 301 history events, 377,653 JSON bytes: 88.5 ms total; 85.3 ms maximum heartbeat gap |
| Same synthetic cold restore, after | Fresh processes: 90.5–108.2 ms total; 40.9–43.1 ms maximum heartbeat gap; all events and the card admitted |
| Final cached established-account reload with local server stopped | Shell response about 0.9 ms after request; completed world ready 400 ms after navigation; position preserved; startup tasks 59/57 ms; zero JavaScript errors |

The synthetic benchmark creates valid proof history and starts a fresh Node
process, so it cannot reuse the generation process's proof caches. It asserts
the retained card digest and player position. Its total includes owner-state
normalization; it does not measure iOS IndexedDB, device memory, or GPU time.
Run `node scripts/benchmark-pwa-account-reopen.mjs` after `pnpm test`.

A controlled Chromium lifecycle freeze and resume retained the same world
canvas, navigation time origin, and X −59/Z −91 position. The next sampled
frame arrived 4 ms after the resume command, with no following long task.
That control did not emit a visibility transition and does not certify the
real iOS app-switch lifecycle. The existing shell has no visibility-triggered
bootstrap or reload; its visibility handling saves state, clears gestures,
and updates elapsed-time projections.

## Verification and remaining qualification

- Initial committed patch `fec7030`: `pnpm test` reported 3,575 passed,
  one skipped, zero failures. The wallet follow-up reports 3,593 passed,
  one skipped, zero failures.
- `pnpm build`, `pnpm typecheck`, `pnpm lint`, and `git diff --check` passed.
  The build/lint retain existing circular-chunk, SDK worker dependency, image,
  and hook warnings; lint reports zero errors.
- Failing tests preceded fixes for lazy custody fallback, cached navigation
  with a pending network, coherent shell assets, failed installation, launch
  routing, and within-card yielding. Negative cases reject forged late
  history authority, a changed enclosing manifest, claimed custody, private
  shell responses, missing assets, and unavailable custody.
- Reconnect regression tests cover offline opening, cancellation of a queued
  retry, a failure resolving after going offline, a connection queued just
  before going offline, and subsequent online recovery. All four offline cases
  failed against the previous implementation before the fix.
- Visual checks show a nonblank world and atlas. Screenshots and temporary
  browser probes are in `output/playwright/latency-*`; profiling wrappers were
  not added to production source.

Remaining costs include JavaScript evaluation (the root route reports about
1.5 MB first-load JS), React/scene assembly, texture decode/readback, native
audio initialization, complete card hashing/normalization, and actual live
server reconciliation. The local wallet integration returns expected 401s
without a configured Receiz application; local browser checks do not certify
live authenticated account reconnect timing. Optional first-use assets still
require network when they have never been cached.

WebKit can suspend background work and iOS can discard the WebContent process.
The app cannot force continuous hidden rendering or retain a process after
OS termination. Retained-process returns should reuse the game; discarded
processes must restore durable state and verify exact external proof bytes.
Sources: [WebKit power usage](https://webkit.org/blog/8970/how-web-content-can-affect-power-usage/),
[WebKit iOS termination discussion](https://bugs.webkit.org/show_bug.cgi?id=199854),
[Launch Handler behavior](https://developer.chrome.com/docs/web-platform/launch-handler).

## Profiling reference ledger

Read and used, none skipped:

- `threejs-debug-profiler/references/debug-profile-checklists.md`: production
  reproduction, errors, canvas, ownership, input/audio, and post-fix visuals.
- `references/checklists/performance-profile.md`: frame/task timing, CPU/GPU
  attribution, heap samples, bundle size, one-change comparison.
- `references/checklists/scene-debugging.md`: nonblank scene, renderer lifecycle,
  preserved materials, and atlas return to the world.
- `references/checklists/mobile-input.md`: portrait viewport, trackpad input,
  map controls, and lifecycle limitations.

Production renderer diagnostics are compiled out. The recorded probes include
GPU query cost and about 62–74 MB JS heap, but do not expose complete live
renderer geometry/texture counts. Those figures must be collected during an
actual iPhone profile rather than inferred from the desktop frame rate.

The final offline check stopped the production server, reloaded the controlled
existing account, and confirmed that an uncached network-only request failed.
The cached world reopened at the same X −59/Z −91 position. This verifies the
cache path against real server unavailability; a page-level offline emulation
alone did not block service-worker network requests and was not counted as
proof of offline operation. Screenshot:
`output/playwright/latency-pwa-offline-reopen.png`.

## Incremental removal of redundant startup work

The direct-admission encoding change was compared using the same saved
synthetic fixture: one valid card, 301 history events, and 377,653 JSON bytes.
Nine alternating before/after pairs used fresh Node processes. Only the
compiled card verification/admission modules were exchanged; the preceding
cooperative-history changes were present in both versions.

| Measure | Before | After |
| --- | ---: | ---: |
| Median cold owner-state restore | 89.81 ms | 87.34 ms |
| Median maximum heartbeat gap | 39.73 ms | 38.43 ms |
| Full-card cache encodings at direct admission | 1 | 0 |
| Required manifest encodings | 1 | 1 |
| Fully admitted cards | 1 | 1 |

The observed restore reduction was 2.47 ms (2.75%), with eight of nine pairs
favoring the updated code. This is a modest desktop synthetic result. Initial
separate batches were noisy: the before median was 87.45 ms and the after
median 112.24 ms, including a 414.77 ms outlier. Alternating pairs reduce timing
drift; they do not establish a guaranteed device improvement. The omitted
derived cache string had 362,347 characters. The 362,021-character manifest
encoding and all required proof checks remain.

To save and reuse the identical generated fixture after `pnpm test`:

```sh
node scripts/benchmark-pwa-account-reopen.mjs --write-fixture /tmp/wildz-synthetic-reopen.json
node scripts/benchmark-pwa-account-reopen.mjs --reopen /tmp/wildz-synthetic-reopen.json
```

The final browser comparison used five alternating pairs of public cached
production shells in an isolated established local account. The server was
stopped and an uncached API request failed. Both builds retained the same
account, card, and X −59/Z −91 position. Only the comparison's public HTML was
exchanged; durable proof and owner storage were untouched.

| Final cached reopening measure | Before | After |
| --- | ---: | ---: |
| Median completed-world readiness | 431.87 ms | 410.31 ms |
| Median canvas attachment | 124.38 ms | 116.11 ms |
| Profile publication encodings before the world draw | 2–3 | 0 |
| Standalone card request attempts before the world draw | 1 | 0 |

The observed world-readiness reduction was 21.57 ms (4.99%); four of five
pairs favored the updated build. Samples varied widely: 396–555 ms before and
387–529 ms after. An earlier exploratory version that deferred the display
projection as well as its encoding showed 390.04 → 393.06 ms, without a
measurable world-readiness saving. The final version keeps display data ready
as requested and was measured again. These observations demonstrate removal
of competing work, not a guaranteed 22 ms improvement or zero startup latency.
All five final updated samples still attempted publication after the draw,
retained the same position, and had zero JavaScript errors. One attempted
timing pass was interrupted by a closed test page and excluded; reopening the
cached account retained its state, and the complete comparison was rerun.

Profile and Card Vault were also compared in three alternating pairs with
optional background tasks deliberately held. Both surfaces rendered from
their ready local data without waiting for publication preparation, had the same
card count, and preserved the mounted Profile across closing/reopening. No
profile publication encoding occurred in the updated build while held.

| Click to local surface DOM, optional prewarming held | Before median | After median |
| --- | ---: | ---: |
| First Profile content after navigation | 303.53 ms | 304.34 ms |
| Retained Profile reopening | 3.33 ms | 3.58 ms |
| First Card Vault content after navigation | 286.09 ms | 286.70 ms |

The existing first-use component/render delay remains when prewarming is held;
these surface samples do not establish instant first-use rendering. The patch
adds no wait on sync or on the background publication key. The display
projection and the existing first-use component-loading behavior are retained.
The initial immediate-Profile probe sampled the empty lazy component before
its content mounted; waiting for the actual card controls resolved that probe.

A final ten-second rendering sample with the server stopped recorded 1,201
frames, a p95 frame interval of 9.24 ms, and a maximum interval of 9.43 ms.
The world canvas was present and there were zero JavaScript errors. Visual
inspection confirmed the nonblank world, retained companion, and saved
position in `output/playwright/latency-removable-after.png`.

Raw paired samples and checks are saved in
[`2026-10-08-established-pwa-reopening-measurements.json`](./2026-10-08-established-pwa-reopening-measurements.json).

Existing exact-object admission already avoids repeat verification. Runtime
normalization already leaves admitted inventory out of its serialization, and
first-frame readiness already avoids waiting for optional shader preparation.
Those savings must not be counted again. First scene assembly, required proof
checks on freshly loaded bytes, and initial GPU resource creation still require
work; removing them outright would alter correctness or the visible experience.

## Breath work and remaining startup pressure

A production movement trace counted 7,758 body-state validation passes over
20 seconds. The campaign constructed identical readouts for its command center,
body panel, nourishment panel, and HUD; projection also validated its checkpoint
and then passed it to another validating operation. These were redundant local
calculations. The avatar's per-frame breath interpolation uses a small numeric
calculation and one cosine, with no proof replay or server call.

The campaign now shares one memoized body readout. Projection validates once
within its operation, while every public body transition still checks incoming
checkpoints afresh. Exact-key checks use constant key sets rather than rebuilding,
sorting, and encoding two arrays on every validation. Each remainder is parsed
once. No cached acceptance flag is introduced for mutable body checkpoints.
The Profile's one-second display cadence stays the same while visible, stops
while hidden, and reads the current clock once immediately on return. It uses
the existing tested visibility clock; display ticks still write no checkpoint.

Nine alternating fresh Node process pairs, with the browser paused, measured:

| Calculation, 10,000 calls | Before median | After median | Reduction |
| --- | ---: | ---: | ---: |
| Body readout | 37.44 ms | 13.23 ms | 64.7% |
| Projection and readout | 107.00 ms | 31.30 ms | 70.7% |
| Advance and movement exertion | 77.67 ms | 29.03 ms | 62.6% |

These percentages apply to the named calculations, not entire startup or frame
time. They remove recurring CPU/allocation pressure but do not establish that
breathing caused a large gameplay stall. All measured final body outputs and
42 transitions across seven activities matched the baseline exactly. A separate
differential check matched 308 valid/invalid checkpoint cases and 24 projection/
readout cases, including legacy state and time before the stored checkpoint.
Regression tests cover mutations after a previously successful check, unknown,
missing, and non-enumerable keys, preserved sleep and nourishment, exact day
rollover/carries, 500-day offline settlement, and the existing breath cadence.

The production movement comparison counted 7,726 → 3,669 body validation passes
over twenty seconds per build, a 52.5% reduction. The two walks followed opposite
paths through nearby terrain. Both kept rendering and moving, reported no
JavaScript errors or long tasks, and had similar p95 frame intervals (9.13 and
9.20 ms). These instrumented samples included maximum gaps of 200/208 ms around
the profiling run, so they are not evidence that every frame was uninterrupted.
A final clean-tab check removed the CPU profiler and GPU/proof wrappers: 1,950
frames over 16.26 seconds, p95 9.00 ms, maximum 9.40 ms, no frames over 25 ms, no
long tasks or JavaScript errors. The first AudioContext construction in that
sample took 1.00 ms. An initial clean-tab check used its default desktop viewport
and was excluded; this result was rerun at the verified 390 × 844 viewport.
Native audio cold-initialization savings are not claimed;
the earlier first-gesture cost was measured in a different browser state.
The same cached account reopened and walked with the local server stopped.
Visual inspection confirmed the world and companion in
`output/playwright/latency-breath-after.png`.

Five alternating cached reopening pairs measured median completed-world
readiness of 521.62 → 504.90 ms. Samples were bimodal (before 313–564 ms, after
325–541 ms), and only two of five pairs favored the new build. This pass does
not establish a reliable end-to-end startup improvement. All samples retained
the same account/card and X −3/Z −128 position before the walking checks;
publication stayed after the world draw, and JavaScript errors remained zero.
The meaningful repeatable saving here is reduced recurring body computation.

Startup CPU sampling also identified natural-texture generation. Row/column
noise and row-only bend calculations now run once per row/column; the fixed
twelfth power uses repeated multiplication. All 196,608 RGBA bytes across bark,
leaf, and skin remain identical to the original pixel arithmetic. Median cold
generation in the nine Node pairs was bark 4.44 → 3.29 ms, leaf 3.74 → 3.50 ms,
and skin 2.08 → 1.79 ms. These small synthetic savings are not a device startup
guarantee. Texture sharing, resolution, filtering, and materials stay the same.

An instrumented cold browser trace recorded canvas attachment at 212 ms, the
first draw at 510 ms, and completed-world readiness at 538 ms. Scene assembly
included a 75 ms task; initial shader preparation polled incomplete GPU programs
over roughly 93 ms. This is distinct from optional shader prewarming after the
world draw. The initial preparation keeps native GPU synchronization from
blocking the first interactive draw; it was retained. The normal prewarmed
Profile opened in 46 ms in a separate sample with no component request or
200–350 ms timer. The earlier 300 ms first-use result deliberately held optional
prewarming and must not be described as the normal Profile opening cost.

Reproduce the body/texture benchmark after `pnpm test` with
`node scripts/benchmark-breath-and-texture.mjs`. The raw alternating pairs are
under `breathAndTexture` in the measurements JSON. Profiling wrappers are
confined to the isolated browser probes and are absent from production source.

## Repeated Identity Seal reads and large wallet archives

A follow-up trace of the established isolated test account found 13 reads of
`identities` and 13 reads of `wrappingKeys` within 35 seconds. The first Seal
read started at 283.4 ms, before world readiness at 529.1 ms. This was not 13
server authentications: each local read decrypted and parsed the saved Seal,
and the wallet source path also ran the complete SDK account projection.
Wallet retries reopened the same archive at roughly 0.28, 2.27, 6.28, 14.29,
and 30.29 seconds. Distribution reconnect and publication signing contributed
other reads. A long embedded history makes this work much more expensive;
being originally caught by another user does not itself establish the cause.

The wallet now admits the exact local source once per controller/source and
joins its pending projection. Failed transport, visibility recovery, terminal
close/reopen, and renewal of the same account's distribution session reuse
that source. Account/source replacement or controller disposal retires late
admission. A failed source projection never grants authority and remains
retryable. This is runtime reuse of the actual completed local check, with no
stored acceptance flag, proof eviction, expiry, or server permission added.
Current asset restrictions are derived from current cards rather than cached
startup counts.

The final warmed, cached production PWA was reopened with the local server
stopped and observed for another 35 seconds. Main-thread Seal and wrapping-key
reads fell from 13 each to zero. Exactly one wallet worker started at 534.5 ms,
after world readiness at 518.8 ms, and replied successfully at 603.4 ms. Two
publication signing workers also replied successfully. The same X 99/Z −195
position remained, with zero JavaScript errors. These counts distinguish
eliminated retries from work moved to workers: three worker operations remain,
and this is not a claim of one global Seal read. A preceding probe with an
uncached signing worker fell back to two main-thread reads and was excluded
from the warmed comparison. The fallback behavior remains explicit.

Five alternating cached baseline/final reload pairs retained the same account,
position, and error-free world. All baseline samples read a Seal before world
readiness; all final samples performed zero main-thread Seal reads and started
one successful wallet worker afterward. Median world readiness was
330.60 → 337.60 ms, with three of five pairs favoring the final build. This
small-account comparison does **not** establish a startup-time gain; the
repeatable gain is removal of archive retries and the large-history gameplay
stall measured below.

The final offline wallet rendered its local terminal and one carried card,
then closed and reopened without another wallet projection or page reload.
The measured 67.5 ms from automation start to visible terminal includes
Playwright input/wait overhead and is not an intrinsic rendering benchmark.
Profile displayed the same carried card offline. A three-second Chromium
lifecycle freeze retained the same canvas, page time origin, and ready world;
the next animation frame was observed 5 ms after the resume command, with no
new wallet projection. This does not simulate every iOS visibility or process
termination case. Expected network failures from the stopped server were
logged in the console; the checks reported zero uncaught JavaScript errors.

Passive wallet loading waits for the completed world draw. Direct wallet
opening still starts immediately. The full archive is read, decrypted, parsed,
and projected in a worker with the same repository and Receiz SDK; only its
small admitted wallet response returns to the game. Profile and card signing
also read their small signing portion through a worker, avoiding main-thread
archive decoding. Their existing owner/custody, unlock, signature, and relay
checks remain. Unsupported or uncached worker transport retains the original
local path as a background fallback; that fallback can still have a large
synchronous parse. An unavailable distribution challenge now fails before
reading a private key it cannot use.

### Controlled large-history measurements

The synthetic signed Seal contains 16 copies of one valid 301-event history,
not 16 distinct creatures, and is 7,763,362 serialized bytes. Its verified PHI
balance is 2,500,000 micro-PHI. It is not the user's `bjklock` account.

| Measure | Repeated/main-thread path | Retained/worker path |
| --- | ---: | ---: |
| Six source attempts, fresh Node process, five alternating pairs | 19,977.32 ms median; six Seal reads | 3,313.93 ms median; one Seal read |
| One actual browser projection, three alternating pairs | 5,612.7 ms median | 5,892.8 ms median |
| Browser projection's main-thread long-task duration | 5,607 ms median | No tasks over 50 ms |
| Worst browser frame interval during projection | 5,599.8 ms median | 10.4 ms median |

Reuse removed 83.4% of accumulated work in the six-attempt benchmark. The
worker did not make the verification itself faster: it completed about 280 ms
later in these browser samples while removing the multi-second gameplay stall.
All six browser results admitted the same SDK-verified balance. The synthetic
source was stored inactive in the isolated browser's actual IndexedDB, never
replaced the active account, and was removed by its exact test key afterward.
No user-owned proof or owner state was cleared.

Reproduce after `pnpm test`:

```sh
node scripts/benchmark-pwa-account-reopen.mjs --write-fixture output/performance/wallet-history-fixture.json
node scripts/benchmark-wallet-source-reuse.mjs --make output/performance/wallet-synthetic-seal.json output/performance/wallet-history-fixture.json
node scripts/benchmark-wallet-source-reuse.mjs --run output/performance/wallet-synthetic-seal.json
```

Regression tests cover retry reuse, pending deduplication, terminal close/reopen,
late completion after disposal and an account round trip, local-source changes,
remote-generation renewal, worker rejection and transport fallback, wrong-key
replies, signing cancellation, current inventory counts, and failed/malformed
challenges performing zero private storage opens. The independent review found
and then verified fixes for pending work being discarded on close and cached
inventory restrictions becoming stale.

Remaining work outside these savings includes full continuation construction
when a distribution server actually issues a valid challenge, wallet read
signing when a live server requires fresh authority, and missing foreign-card
custody that still needs the exact Seal fallback. Those operations have not all
been moved off-thread by this follow-up. Publication retries can still perform
separate signing reads in their workers. There is no claim that every component
reads the Seal only once globally, or that cold process restoration is free.
Actual installed iPhone/iPad reopening, app switching, and the `bjklock` archive
still need device measurements; desktop samples cannot certify zero latency.
