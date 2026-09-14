# Profile, restored-seal sync, and movement responsiveness

## Implementation contract

Profile transitions must not prepare a full Vault backup. A verified Identity Seal publishes its complete source profile without waiting for standalone card indexing or depending on a delegated registry token. Exact admitted immutable cards reuse verification. Separately decoded cards may reuse successful verification only when their entire canonical content matches; id/digest claims alone never qualify. Changed bytes retain the verifier path. Movement-only worker messages reuse the worker's prior admitted inventory; new or changed cards replace it. Visible passive settlement processes at most one due companion and one travel growth event per turn.

The signing worker receives only local signing input and returns a public signed request. It is terminated on obsolete profile cancellation, success, or failure. Public receivers still independently validate signatures and received public proof bytes. A successful local verification is not a claim that a public projection is live.

## Changes

- Restrict full Vault export preparation to the Vault overlay.
- Keep complete source-profile signing enabled for verified local seals after proof-session connection.
- Move public profile signing, hashing, and JSON preparation into a cancellable module worker; preserve the SDK fallback on unsupported browsers.
- Reuse exact admitted card objects and bound an exact-content verification cache to eight million characters for duplicate decoded cards.
- Retain admitted inventory inside the player-state worker between movement-only snapshots, eliminating repeated full-inventory structured clones.
- Check public card availability before uploading; upload only missing or changed revisions. Serialize reconnect runs and abort retired card-publisher requests.
- Retry transient shared proof-session failures with bounded backoff and cancel retries for retired identities.
- Bound visible passive crew settlement instead of replaying the full roster for a single due timer.

## Verification and limits

The supplied `IMG_7549.PNG` was inspected locally with networking disabled. SDK identity projection reported `portableStateStatus: verified` for `bjklock`, key prefix `fa88b59e`. Full Wildz inspection recovered 42 cards and player continuity. No credential or original seal was added to the repository.

An explicitly approved live public-profile publication returned `wildz_public_profile_publication_unconfirmed`; the subsequent unauthenticated public GET returned HTTP 404. Do not claim this profile is live. Automatic approval review subsequently blocked the diagnostic retry because its usage limit was reached. User approval remains recorded.

Before changes, the existing production browser build showed a 250 ms maximum frame gap in the initial Profile interaction sample, with 123/91/94 ms long tasks. A separate warmed three-cycle sample had a 25.3 ms maximum gap and no long tasks. These different samples demonstrate intermittent behavior; neither is a final before/after guarantee.

Receiz SDK, MCP package, and AI skills are pinned to 126.0.0. MCP doctor succeeded and the public app-state read returned no profile. Architecture lock and SDK integration check passed before the final edits; conformance reported no failures. The first full suite exposed an existing resource projection snapshot mismatch introduced by the preceding committed terrain correction. The expected full projection digest was updated to the corrected terrain contract, retaining the complete equality assertion.

## Reference ledger

Read: `threejs-debug-profiler/SKILL.md`, `references/debug-profile-checklists.md`, `references/checklists/performance-profile.md`, and `references/checklists/scene-debugging.md`. Used CPU/allocation, repeated work, cancellation, cache lifetime, and movement input checks. Read Receiz identity-profile, portable-continuity, and release skills and release manifest. Used Playwright skill for the baseline browser interaction. Final browser verification and live publication remain release requirements.

## Final local results

- All 2,679 tests passed; none skipped.
- Production build, standalone typecheck, targeted lint, final architecture lock, SDK integration check, and secret scan passed. Build retains the existing SDK worker dependency and unrelated image/hook warnings.
- A 20-message movement benchmark using the supplied 42-card continuity sent all 42 cards once, then zero card objects in every movement-only message. Card verifier executions during those movement messages: **0**.
- Full-inventory structured clone averaged **37.25 ms**, maximum **53.79 ms**. Inventory-reusing movement messages averaged **7.76 ms**, maximum **10.41 ms**. These are Node CPU/protocol measurements, not browser FPS or a universal input-latency guarantee.
- Final local inspection of the supplied seal took **3.38 seconds**, with zero network calls. Initial full inspection took **5.98 seconds**. Repeated decoding reuses exact-content verification; fresh enclosing-byte inspection still has real cost.
- The latest approved production publication attempt remained unconfirmed and the independent public read remained **404**. No commit or push was made because the requested end-to-end release criteria are not yet met.
