# Interaction latency and restored seal publication

The world admission queue now prepares commands and reads/writes its durable outbox in a module worker. The queue still serializes commands, waits for persistence before admitting results, rejects failed writes, and retains exact source history. Harvest background sync no longer appends an already persisted command a second time. Browsers without module workers retain the inline path; an interrupted worker write is rejected, never blindly replayed.

Identity card export sends raw player input to its existing export worker, where normalization and payload hashing now occur. The visible thread previously created and hashed the full player Vault before starting the worker.

Profile mounts its gallery immediately. Card artwork is cached by immutable asset object and prepared one card at a time in background work. Opening Profile or Market settles at most one queued travel growth event per background turn. Remaining travel events stay queued. Market is eagerly imported: browser reproduction showed the old lazy-loaded market opening an empty dialog without mounting market content.

Signed card/profile publication uses the shared identity repository directly rather than importing restore/export orchestration on demand. A previously connected, canonically aligned identity may publish with its exact key even if its seal carries an older username. Unconnected metadata mismatches and foreign card/profile owners still fail locally; the registry must verify and accept every signed publication. Card-by-card progress renews the profile deadline, so a large restored Vault is not constrained to one 30-second total publication window.

## Validation

- 2,213 tests passed, including durable admission ordering, write failure, out-of-order worker replies, interrupted workers, bounded travel settlement, older seal metadata, foreign-owner rejection, and publication deadline renewal.
- Local browser: Profile displayed its card immediately; Market rendered its heading and empty state and returned to world controls. A harvest action produced immediate move-to-source guidance. This was not a complete browser FPS/harvest/placement benchmark.
- CPU responsiveness benchmark: 40 consecutive construction-project admissions produced all 40 projects in both modes. Inline: 318 ms maximum event-loop gap, 318 ms elapsed. Worker: 6 ms maximum gap, 355 ms elapsed. This Node worker measurement demonstrates rendering-thread availability, not lower total computation or a universal FPS guarantee.
- Production public reads returned not-found for bjklock and wilds:995b23f1dc419641683e5624. Production logs showed repeated HTTP 401 card publications. The older-metadata rejection is reproduced in tests; the user's original seal was not inspected, and the exact account's live resync remains unverified until deployment and publication from its owning browser.
