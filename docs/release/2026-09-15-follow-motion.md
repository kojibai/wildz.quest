# Restore stable accompanying motion

The normal companion follow path had replaced the longstanding player-relative formation with a rotating target, independent navigation, catch-up substeps, and another position filter. The label moved as much as 7.83 CSS pixels between frames while the camera matrix remained constant. Normal accompaniment now uses the original stable side-by-side offsets and the existing cached floor lookup. Walking animation consumes travel cadence separately from the position. Independent roaming and work continue to use their navigation paths.

The original vertical world rebase removed in `fd54809` is restored. No new camera filter, spring, or shared transform moves the local explorer. The user tested the local build and confirmed walking was back to normal.

The shader warmup introduced by `627edf7` is removed. Its async material polling threw `Cannot read properties of undefined (reading 'isReady')` when a material was disposed during compilation, leaving its custom render gate closed indefinitely. The normal R3F renderer owns drawing again. There is no added loading screen, readiness gate, or deliberate delay before renderer mounting.

## Verification

- `pnpm test`: 2,688 passing. The three removed tests exclusively tested the deleted shader gate.
- `pnpm build`: production build, with pre-existing circular chunk and two lint warnings.
- `pnpm receiz:check`: passed; SDK/MCP/AI Skills contracts retained.
- `pnpm receiz:architecture-lock`: passed, 765 runtime files.
- Chromium, production preview at `http://127.0.0.1:3018`, 390 × 844, canvas DPR 1.25.
- Walking label trace: prior p95 frame displacement 4.415 px, max 7.831 px; restored follow p95 0.0229 px, max 0.0346 px. Both camera traces were stationary. These were consecutive route segments, not a deterministic replay.
- Twenty seconds of walking from X75/Z-112 to X56/Z-213: 2,404 sampled frames, p95 9.45 ms, max 20.78 ms, zero frames over 35 ms, zero long tasks. One shader status query took 7.61 ms.
- Profile opens and reports the test profile live. No shader/runtime exception in the motion traces. Test wallet authority requests return 401 before wallet authority admission.
- Local visual artifacts: `output/playwright/`. Temporary measurement files are session-local, not release artifacts.

## Scope and limits

The user confirmed restored walking, but subsequent instrumented traces still measured occasional frames above 16.7 ms. This does not establish zero latency on every device or eliminate driver compilation time for unseen programs. Cold shader compilation remains browser/driver work; the crashing eager warmup and blocking gate are gone. No deployment was performed; the user will push the commit.

References used: threejs-debug-profiler `debug-profile-checklists.md`, scene-debugging, performance-profile, and mobile-input checklists; threejs-qa-release QA/release, visual-verification, playtest, and release checklists; Playwright CLI. All were read. Final checks target this regression, not a new review of unrelated game systems.

## Complete first game reveal and smaller frame spikes

The existing initial identity screen now remains mounted while the game renders hidden with its normal layout and render loop. `WildsFirstFrame` observes the first completed scene draw and reveals the whole game and HUD on the next animation frame. It restores the scene callback immediately after the first draw and cleans up its scheduled callback on unmount. The game mounts immediately; no extra screen, timed delay, compilation promise, or custom render loop was added. The identity-generation key prevents an older world from revealing a newly activated identity.

Mobile production verification observed the complete game reveal at 812 ms after navigation, no exposed HUD/intro overlap and no runtime exceptions. This is a measured run, not a guaranteed startup duration.

A subsequent walking trace correlated two shader-status queries (9.395 ms and 7.375 ms) with a 28.045 ms frame. Lantern point/spot lights now remain allocated with intensity zero when inactive, preserving shader light counts during visibility/quality transitions. The lantern meshes retain their previous visible conditions. This removes that source of shader permutations; it does not prove every recorded spike was a lantern transition or eliminate first-use compilation for every material.

Further main-thread tracing isolated recurring React scheduler tasks lasting 16–19 ms, including vegetation instance projection; GC contributed roughly 0.5–2 ms. Ecology instances now use a tile-local anchor and a common parent translation. Player motion no longer recomputes all eight instance buffers and ground heights. Tile transitions and resource/physical-ground changes still update the affected transforms; the resource work animation retains its base matrices. This changes scene bookkeeping, not player or camera motion.

Before that instance change, the final 15-second mobile walk covered X40/Z-46 to X24/Z27: p95 9.14 ms, maximum 22.78 ms. One shader query took 6.595 ms without overlapping those slow frames. The full first reveal took 714 ms, with zero partial HUD/intro exposures and no runtime exceptions. These findings distinguish the remaining React work from the separately observed shader stall.

The next moving route (X24/Z27 to X25/Z-49) measured p95 9.495 ms and max 129.095 ms, with a burst of shader queries accounting for much of the largest frame. This crossed different scenery and is not a controlled before/after result. A blocked movement attempt had max 12.53 ms; that is explicitly not evidence of walking performance. The 9.5 ms maximum target remains unmet.

Static landmark bodies now use React memoization so moving their parent does not reconcile unchanged building mesh trees. Detail changes and context updates still propagate. This targets the renderer reconciliation seen in the scheduler profile without filtering player motion.

Harvest completion retains the existing collision-aware companion movement path until the creature physically returns and its displayed position reaches formation. It then switches to stable accompaniment. The return uses the outward walking speed when the player is stationary, with no gap-based acceleration or regroup teleport. Automated navigation tests and the production build passed; live successful harvesting additionally requires the admitted wallet authority absent from this browser test identity.

## Follow-up: short harvesting dwell and streamed light stability

Harvest presentation now waits for the movement loop to report arrival and allows 450 ms of visible work before returning. The admitted harvest result is still published immediately. The presentation has an 8-second bound for unreachable sources and is cancelled/replaced by subsequent work. Tests cover fast settlement before arrival, slow settlement after the dwell, and unreachable expiry.

Flagship landmark lighting uses two reusable point-light slots. Their position, color, intensity, and range match the existing landmark lights, including Hearttree scaling and the rotated atelier light. Unseen lights have zero intensity; entering/leaving an entrance no longer adds or removes these lights from shader counts. The four landmarks' 26-unit visibility ranges are disjoint, verified by a regression test. Other dynamic lights and first-use material compilation remain possible sources of shader work.

Unchanged settlement district mesh trees are memoized, and the readability context retains its identity when its actual inputs are unchanged. Idle or settled resource effects return before projecting per-frame animation objects; source ground elevation is cached independently of player movement. No player/camera filter, input delay, rendering gate, or extra loading screen was introduced.

The test browser changed to a ~30 FPS cadence during verification. An empty `about:blank` page measured p95 33.5 ms and max 34.3 ms, so current RAF results cannot be compared directly to the earlier 120 Hz/9.5 ms runs. The final two-slot walk before the idle-source change measured one 5.885 ms shader query, no runtime exceptions, and no partially revealed HUD. It covered only X34/Z-58 to X30/Z-52 because terrain constrained the route; it does not establish all-boundary behavior. A subsequent 12-second alternate direction trace covered X27/Z-52 to X31/Z-64 and recorded one 17.546 ms React task (3.736 ms GC), rather than the earlier approximately 1.6-second repeated pattern. That residual task means the requested zero-spike target is not established.

Verification: 2,691 tests pass, production build passes (existing warnings), Receiz SDK/MCP/AI Skills integration check passes, architecture lock passes, secret scan passes. The arrival dwell is covered by automated tests; an authenticated successful harvest still needs live visual confirmation. Screenshot: `output/playwright/final-reveal.png`.

After removing idle-source allocations, an 8-second production walk covered X31/Z-64 to X25/Z-36, with no runtime exceptions or partial HUD reveal. RAF p95 was 34.44 ms and max 42.64 ms under the independently confirmed ~30 FPS browser cadence. Two first-use shader queries remained (5.91 and 6.855 ms). The result supports a functioning build, not a universal zero-latency claim.

The subsequent 12-second walk covered X65/Z-67 to X4/Z-40: p95 34.23 ms, max 37.195 ms, no recorded GL call above 1 ms, and no runtime exceptions. Its starting position changed between runs, so it is not a deterministic replay or proof of crossing the arena visibility threshold.

## Restored vault, ground reconciliation, and cave exteriors (September 15)

- Removed full-vault export preparation from Inventory mount and overlay transitions. The shell coalesces snapshot changes and prepares signed exports in a retained module worker. Runtime reference deltas send new/replaced cards and changed play-state fields; unchanged admitted card objects stay in the worker. Individual-card prewarming carries only the selected card.
- Save reuses the exact current prepared snapshot and prebuilt Blob. It joins outstanding preparation rather than exporting stale state. A just-changed snapshot or passphrase-protected key can still require asynchronous completion; this is not a claim of zero elapsed save time. Hashing, normalization, vault assembly, and signing on this path execute in the worker. Full portable exports still contain complete continuity.
- Collision sliding now samples the terrain at the accepted coordinates rather than retaining the requested destination's height. Outdoor rendering reconciles the floor against the terrain and uses the same elevation for discovery meshes. Walking/follow smoothing was not changed.
- Restored roaming history can display the verified current trip when archived event rows are missing. Available memories survive missing older rows or unavailable battle-history storage; missing earlier records are labelled. Ownership and history integrity checks remain.
- Cave/cavern sites have a hillside behind the entrance. Natural and dug entrances have a front-only dark mouth plus a shared solid rear/side/roof collision shell. Cave geometry no longer disappears with the interaction cue. Hidden waterfall mouths sit beside the public path so their new solid shell does not block it.

Verification: full regression suite includes card-delta retention/removal, signed worker export preserving the latest position and collection, restored history without archived rows, and accepted-coordinate ground sampling. Production build, TypeScript, lint (two existing warnings outside this change), Receiz integration check, architecture lock, and secret scan were run. Debug references used: threejs-debug-profiler SKILL.md; debug-profile-checklists.md; scene-debugging, performance-profile, and mobile-input checklists (loaded earlier in this task).

Visual/performance limit: automatic approval review rejected access to the user's local browser because the account usage limit was reached. No post-change browser timing or visual verification is claimed for this batch. The production server is rebuilt on port 3018; visual sinking/cave checks and restored-account native Save timing still need browser validation. No push or deployment is performed.

## Retain immutable proof sections through export (September 15)

The export worker now uses the existing admitted-inventory custody path (`verifyAndAdmitWildsCard` / `retainAdmittedWildsInventory`), rather than only recording verification in the lower-level card verifier. The missing inventory admission previously made player normalization serialize, parse, migrate, and admit the collection again.

The retained writer preserves each immutable card's canonical representation and carried proof-append bytes. Unchanged collections retain their existing vault commitment and, when artwork is unchanged, their exact vault PNG chunk. A history/position change builds the current player append without preparing existing card sections again. The existing V2 carrier and V3 player payload remain byte-compatible; this does not introduce a new artifact format or replace native proof authority. These retained representations are export material beneath the immutable proof objects, not an alternative authority.

Prepared signing consumes a single-use, same-runtime handle whose exact bytes and derived commitments remain privately owned by the writer. A manufactured handle or reused/consumed handle fails. Imported bytes still use the original full verifier. SDK identity signing, owner matching, identity authority and binding trailers remain unchanged. No arbitrary `alreadyVerified` flag accepts caller-provided bytes.

Verification: 2,698 full-suite tests passed; the strengthened retained-proof and signed-worker tests passed again after the final assertion was added. Production build and changed-file lint passed. Tests compare produced PNG bytes against the existing encoder, retain all player events, check new/removal/reordered card membership, reject mutated proofs, and assert no new card admissions or prepared sections for history-only changes.

100-card Node microbenchmark (12 warm updates, fixed tiny PNG artwork, approximately 1.15 MB output, preparation plus SDK signing): previous median 286.58 ms / p95 313.45 ms; retained writer median 15.34 ms / p95 23.29 ms. Exactly 100 card sections were prepared across initial export plus all 12 updates. This is an isolated CPU/export benchmark, not browser frame timing or a universal latency guarantee. Final flat-payload hashing, changed-append encoding, file assembly, and signature creation still take time. Browser validation remains unavailable due to the previously reported automatic-review usage-limit rejection. No deployment or push.
