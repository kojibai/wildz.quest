# Cross-browser continuity corrections

Same-Identity-Seal gameplay uses the existing authenticated player-state endpoint and Receiz app-state publication. This patch does not establish a new authority for balances, ownership, or transfer receipts.

## Corrected behavior

- Preserve gameplay source time across server admission and client retries. Late delivery no longer gives an older snapshot a newer gameplay timestamp.
- Bind publication acknowledgement to the submitted snapshot's mutation and identity.
- Reject a slow read if local mutations advanced while the read was pending, even if those newer mutations have already been submitted.
- Wake reads on visibility return, page restoration, and reconnection; stop scheduling polling while hidden or offline.
- Skip publication when merging a retried older source produces the already admitted digest.
- Propagate remote read failures instead of starting an empty source chain.

Serialization remains on the existing worker/background path. No changes to the render loop, graphics, or per-frame network work.

## Evidence and remaining verification

Both delayed-publication and duplicate-replay regressions failed against the previous implementation and passed after the corrections. Full suite: 2,354 passing tests, 211 suites. Targeted ESLint and diff whitespace checks passed. Production build passed after clearing generated caches to recover disk space; existing SDK bundler and unrelated lint warnings remain.

These checks do not prove a live handoff between two authenticated browsers. Simultaneous offline edits, device clock skew, and concurrent server publication still need dedicated live conflict testing; this patch does not add an atomic compare-and-swap publication primitive. Latest acknowledged progress can be resumed, but an untransmitted last action on a suspended or offline device cannot be promised on another device. No zero-latency or universal transfer-success guarantee is claimed.
