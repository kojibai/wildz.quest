# Creation and rest review corrections — 2026-10-06

This increment fixes the six Wildz findings supplied for this worktree. It does not qualify the remaining creation runtime/admission/global-world integration described in [the creation qualification](2026-10-05-prompt-creation-qualification.md) and [surface qualification](2026-10-06-creation-surfaces.md).

Compilation rejects an individual adapter with no render vertices, including the legacy water catalog entry, even in a mixed graph. Before emitting each combined page, it validates its actual bounds through the same bounded region enumeration used by discovery. A funded 4096×4096 box fails before preview/admission; two individually indexable shapes whose combined page exceeds 4,096 regions also fail. A page exactly at the limit still compiles.

Solid overlap now tests the actual -yaw local axes used by geometry. Regression cases reproduce falsely blocked separated thin bars at arbitrary signed angles, retain blocking of genuine intersections, and preserve the existing touching-face tolerance. The existing radius projection already matched geometry; the reproduced defect was a false positive.

Neighborhood selection reuses its squared point-to-bounds distance, including vertical separation, with source-ID tie breaking. A floor containing the player wins initial one-page residency over adjacent small pages regardless of its distant minimum corner.

A damage action rejects an equipped creation targeting itself before deriving either successor. It returns the original state with zero writes, receipts or consequences. A normal attack on a different instance still yields distinct target-damage and weapon-wear successors, with the receipt pointing to the retained damaged head.

Meaningful breath actions settle the prior camp/bed companion interval before changing mode or applying effort. Wake and movement restore earned vitality/fatigue and preserve the exact Kai history root without periodic durable ticks. Leaving rest clears its recovery marker; rest clicks do not immediately heal, awake time does not recover companions, and a new rest starts a fresh interval. Direct wake/movement and a previously settled tick followed by the same action produce the same companion result.

The regression group first reproduced 13 expected assertion failures across these six defects. Final focused group: 74 passed. Full suite: 3,077 tests, 3,076 passed, one existing enrolled-device skip, zero failures. TypeScript passed. Lint passed with zero errors and the same two existing warnings. Production build passed, retaining existing Receiz/webpack build warnings. Receiz architecture lock passed (887 runtime files); the offline integration check returned ok. No package manifest or lockfile changed.

Evidence logs: /private/tmp/wildz-creation-review-{red,focused,full,typecheck,lint,build,architecture,receiz}.log. The rebuilt production preview is running on localhost:3107 in managed session62014. Browser reload retained the current player/position and saved timber-house creation draft; the conversation reopened and browser error log was empty. Screenshot: /private/tmp/wildz-creation-review-preview.jpg. This smoke check does not claim live source admission or independent-client gameplay qualification.
