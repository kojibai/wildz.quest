# Profile publishing and restore refinement — 2026-09-08

Profiles automatically publish after identity, explorer, and proof-session readiness. The old publish panel is removed. A small status icon beside the username reports queued, syncing, or live state; sharing remains immediately available. Publication survives overlay changes, cancels obsolete revisions, retries failures with bounded backoff, and wakes on reconnect. Profile and card JSON use the existing worker serializer, with background scheduling as fallback.

The measured restore bottleneck was local state normalization: serializing admitted inventories created new card objects and discarded their runtime verification cache. Local saves now retain the exact deeply frozen admitted inventory through the existing runtime admission handle. Fresh uploads, data read from storage, and modified copies still take the full verification path. Continuity metadata validation no longer constructs and discards a full Vault digest.

## Verification

- 2,177 tests passed, none skipped, including auto-publication/reconnect/retry/cancellation, exact-object persistence, and rejection of tampered stored proof bytes.
- Targeted ESLint, typecheck, and Receiz architecture lock passed.
- Node benchmark on this workstation: 33 cards, five identical Vault-normalization/export passes. Before: 407.6 ms and 165 verifier executions. After: 141.1 ms and zero verifier executions. These are CPU measurements, not browser FPS or network publication latency.
- Five ordinary local owner-state saves with the same 33 cards took 39.6 ms total with zero verifier executions after the change.

## Debug references

Read `threejs-debug-profiler/references/debug-profile-checklists.md`, `checklists/performance-profile.md`, and `checklists/scene-debugging.md`. Used the CPU/allocation, repeated work, cache lifetime, and exact-path regression checks. Renderer geometry, lighting, physics, and visual assets are unchanged.

Production build passed. It reports the existing SDK/snarkjs `web-worker` dependency warning and two warnings in unchanged source files. The final profile/layout/publication checks passed (23 focused tests).

Browser verification used the production server on localhost:3018, desktop 1280×720 and phone 390×844. Inspected both screenshots: no publish panel or publish button, small sync icon beside the username, intact four-icon action row, and no profile overflow. Copy Profile Link showed success immediately and Return to World restored the gameplay controls. No browser console errors were recorded. No renderer or frame-time metrics were captured; the CPU benchmark above measures the specific repeated-verification bottleneck.

Live remote publication requires an authenticated proof session; unit tests exercise automatic scheduling and network recovery without publishing an account from the test browser.
