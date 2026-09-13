# Crew integration checkpoint — 2026-09-12

Requested outcome: independent, genome-bound workers with real exploration, material custody and construction, complete causal history, and bounded gameplay work.

This checkpoint does not declare that outcome live. Existing local exploration remains limited to accompanying creatures. Autonomous material jobs remain disabled until exact existing-subject bindings, sealed temporal/Identity source evidence and production admission are integrated.

Implemented changes:

- Restore, recall and transport serialize per creature and invalidate stale owner/proof/roster operations. Current movement preferences reconcile with restored trip state.
- The crew panel exposes a lazily loaded, paginated travel journal of actual local observations and Kai causal order. It does not promote visits to shared-world admission or invent memories/rewards.
- Exact sealed card/vault exports are retained by their actual artifact hash; existing restored artifact storage is reused. Full predecessor history is preserved. An export cannot silently establish replacement genesis for an existing creature.
- The execution dispatch boundary fences the exact current working job after asynchronous validation and staging. Recall either cancels an undispatched proposal or preserves a dispatched command for exact recovery.
- Artifact proof digests and subject execution heads remain distinct bindings.
- Starter creation and verified legacy-card import perform canonical living admission before exact-proof trips begin. Reload therefore preserves the trip's proof instead of silently migrating it mid-journey. Valid complete saves use existing defaults without generating and sealing another starter.

Performance constraints: no new frame-loop storage/network operations; travel history reads occur only on explicit journal interaction; existing trip scheduler stays bounded to three accompanying creatures at 500 ms intervals. Equal phone frame times are not asserted without device measurements.

Reference ledger: gameplay-workflows.md, physics-engine-selection.md and new-game-definition-of-done.md previously read from the threejs-gameplay-systems skill; receiz-autonomous-mandate SDK/MCP contracts applied. MCP runtime blueprint returned successfully and explicitly describes MCP as tooling, not proof authority.

Ruling: preserve existing subject identities and history instead of admitting each newly exported PNG as a new subject. A digest-derived replacement would split the same creature's history and ownership; proceeding requires a verified existing-subject binding.

Verification: full `pnpm test` after the final restore optimization passed 2,474 tests with zero failures. Targeted ESLint and independent scoped reviews passed. Production Chrome at 390 × 844 verified active-trip reload, all three physically observed destinations, return, explicit recall, another reload and retained Kai-ordered journal history without superseding the original proof or page errors. The movement check kept the label aligned with the creature and sampled a 16.67 ms p95 frame interval (115 draw calls / 79,870 triangles in that scene). This is desktop Chrome evidence, not a physical iPhone benchmark. The browser run preceded only the final redundant-fallback optimization, which has direct restore/checkpoint regression coverage.

Family opening has explicit 256-artifact / 64 MiB decoded-byte budgets (callers may choose smaller). Exceeding the budget returns an error without a partial family or history deletion. Explicit Roam/Recall can append a superseded observation to end an old-proof trip; it retains the old proof/visits and records no fabricated arrival, then allows a new current-proof journey.

Physical trips defer passive proof checkpoints only while they can travel. A sustained observed movement/readiness pause records a blocked trip and releases that deferral; this records no arrival. The settlement helper preserves entries already present in the pending growth queue. The existing gameplay enqueue cap of 256 remains: this change does not guarantee retention beyond that cap or introduce an unbounded queue.

Final `pnpm build` passed after the restore optimization. Existing unrelated package and lint warnings remain. No deployment or real material-worker transaction was performed by this checkpoint.
