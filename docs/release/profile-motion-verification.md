# Profile publication and gameplay responsiveness

## Confirmed regressions and changes

- `dbb7d19` (September 13) added eager full Vault preparation for overlay transitions. `abb2181` restricts preparation to the Vault overlay, so opening or closing Profile no longer prepares a backup.
- The player-state worker still received the full inventory on every movement snapshot. `abb2181` retains exact admitted inventory inside the worker and sends replacements only for changed cards. Exact canonical-content verification caching also avoids rechecking unchanged restored cards.
- Signed profile publication embedded full card histories repeatedly throughout the SDK envelope. The actual live request failed with HTTP 413 `FUNCTION_PAYLOAD_TOO_LARGE`. Profile publication now carries a bounded gallery of IDs, proof digests and display fields; full card proofs use their independent publication path. The actual 42-card signed request is 80,602 bytes.
- Moving profile signing into a worker had left a synchronous structured-clone bottleneck: the input included both full cards and the private account archive. The caller now checks gallery references against exact admitted cards and sends only the compact profile and signing key. The original seal remains intact in local custody. The SDK still signs and the registry independently authenticates the publication.
- Production browser inspection caught a shared worker dependency crashing with `ReferenceError: window is not defined`: Next inlined a `typeof window` guard in a client chunk. The background runner now checks `globalThis.window` so worker startup does not depend on compiler assumptions or fall back to main-thread signing.
- Background new-card publication also performed SDK signing, hashing and final JSON serialization on the main thread. It now uses a cancellable worker, carrying that card's public proof and the signing key without the full private account archive. Unsupported browsers retain the SDK fallback scheduled at background priority.

The signed gallery is a source-authenticated display projection. It is not a native card admission or ownership transfer. Changed card bytes retain verification; matching IDs or claimed digests alone do not authorize reuse. Movement-only sync does not reverify admitted cards. Visible passive crew settlement remains bounded to one due companion and one travel growth event per turn.

A suspected timer restart existed only in legacy controls. Instrumentation established that the active `WildzDpad` already keeps its frame clock stable, so no unrelated control change was retained.

## Live publication evidence

With explicit approval, the public @bjklock profile was published through the canonical SDK registry rail. The registry returned `ok: true` and identical append/known-head anchors:

`491983704733641982694effd5375e7438558d97dc451b216c394a86746e82cc`

An independent unauthenticated GET of `https://wildz.quest/api/profiles/bjklock` returned HTTP 200, @bjklock and 42 gallery entries. MCP `receiz_app_state_by_url` independently returned the published native verified app-state record for `https://wildz.quest/u/bjklock`. This confirms public profile publication; it does not assert that every standalone card index is available.

The supplied seal was inspected locally. No original seal, private key, or bearer credential was added to the repository or transmitted for this check.

## Measurements

CPU measurements use the actual restored 42-card account, with 20 repetitions. They are Node protocol measurements, not browser FPS:

| Operation | Before mean / max | After mean / max |
| --- | --- | --- |
| Movement worker structured clone | 37.25 / 53.79 ms | 7.76 / 10.41 ms |
| Profile signing worker structured clone | 163.25 / 277.51 ms | 0.068 / 0.244 ms |

Profile signing message size: 5,798,573 bytes before, 10,185 after. The compact message contains neither full cards nor the portable account archive. Movement sends 42 cards once, then zero card objects in each of 20 movement messages, with zero card verifier executions.

The intermediate production browser build, using the restored account, traversed from X 836/Z -3164 to X 868/Z -3258 during 14 seconds of continuous trackpad input immediately after closing Profile. Across 1,621 frames: p95 9.24 ms, maximum 50.005 ms, no long tasks. Three repeated Profile transitions measured p95 16.73 ms and maximum 58.325 ms, with no long tasks. These measurements precede the final worker-input and card-signing fixes. A single-keydown sample was excluded as a continuous walking test because it moved only one step.

## Validation ledger

Read the Three.js debug-profiler skill and its debug/profile, performance-profile and scene-debugging checklists; Receiz identity-profile, portable-continuity and release skills; and Playwright skill. Used CPU profiling, allocation/copy measurements, cancellation checks, immutable admission checks, actual seal restore, browser input, SDK live publication and MCP public readback.

SDK, MCP and AI skills remain pinned to 126.0.0. All 2,681 tests passed, including signed card/profile integrity and worker cancellation. Architecture lock passed for 761 runtime files, targeted lint passed, and secret scan passed for 1,583 text files. Final production and browser results are recorded below when completed. Existing unrelated build warnings are not treated as failures.

No finite test can establish zero latency on every device. Browser frame gaps, first-time artifact inspection, networking and fallback scheduling retain measurable costs; these results substantiate the specific regressions removed.

## Final production-browser acceptance

After the worker-bootstrap correction, all three actual production worker bundles (profile signing, card signing, player-state projection) initialized in Chrome and returned handled invalid-input responses through their message handlers. None raised a worker startup error. Signature integrity and cancellation are covered by the successful SDK-based tests. The prior worker `window` error did not recur in the acceptance run.

The browser was explicitly brought to the foreground for this final sample. The actual restored BJ Klock account retained 42 cards. Both walking segments showed real displacement, avoiding the blocked-direction sample from the previous run:

| Scenario | Frames | p95 frame gap | Maximum gap | Long tasks / gaps over 50 ms |
| --- | ---: | ---: | ---: | ---: |
| 14 seconds walking, X 858/Z -3181 to X 848/Z -3099 | 1,664 | 9.245 ms | 41.675 ms | 0 / 0 |
| Three Profile open/close cycles | 552 | 9.300 ms | 25.010 ms | 0 / 0 |
| 14 seconds walking afterward, X 848/Z -3099 to X 872/Z -3174 | 1,652 | 9.215 ms | 42.230 ms | 0 / 0 |

Total: 3,868 frames. The gameplay canvas remained nonblank with the character, companion, world and HUD visible. Remaining console entries were HTTP authentication/lookup failures for wallet and standalone card services, not an assertion that those separate services passed their own release checks. No universal zero-hitch guarantee is claimed: the largest observed final frame gap was 42.230 ms.

Final production build, standalone typecheck, targeted lint, architecture lock, SDK integration and secret scan passed. All 2,681 tests passed before the final worker-global guard change; the seven relevant background/worker tests passed again after recompilation with that guard. No push or application deployment was performed.
