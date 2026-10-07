# Focused gameplay verification — 2026-10-07

Baseline: `e2f659f`. This pass preserves graphics settings, scenery, birds,
movement, hunting and existing gameplay rewards.

## Building placement

The production browser placement fixture reproduced `TypeError: Illegal
invocation` when an admitted creation mounted. `WildsCreations` passed the native
`queueMicrotask` function as a runtime object method. Calling that method bound
the runtime object as its receiver, which the browser rejects. A callback wrapper
keeps the native call at its expected receiver. The same failure affected reloads
of a saved world containing a creation.

A separate valid node support chain also reproduced
`creation_page_dependency_cycle`. Regional page grouping can create a cycle
between pages even though admitted source nodes are acyclic. Page selection now
takes the bounded complete dependency closure. Collision activates only when all
support pages have rendered. Definition admission, seals, source digests,
material consumption and saved source replay stay unchanged.

The explicitly gated `/test-fixtures/creation-placement` route exercises finite
synthetic material lots, real world command admission, physical projection,
rendering, collision and saved checkpoint replay. Its session storage key is
separate from player saves. Production access requires
`WILDZ_ENABLE_TEST_FIXTURES=1`; normal production builds return not found.

## Saved-map recovery CPU

See [populated account construction recovery](populated-account-construction-recovery.md)
for the exact proof-schema dispatch change and reproducible benchmark. An
independent repeat produced identical output fields and measured cold CPU
273.12 → 75.39 ms, warm median 264.25 → 32.29 ms, and warm p95
306.33 → 37.66 ms. These are synthetic recovery-stage measurements, not the
original player's private PWA startup or browser frame rate.

## Production-browser startup sample

A temporary, local, query-gated probe measured the production bundle with a
small restored account. It was removed after measurement. The initial module
evaluation took 89 ms, first scene mount 72 ms, first shader preparation 19.86 ms,
and first draw 35.04 ms. Subsequent rendering averaged approximately 1.2 ms CPU
across 21,412 frames. Looking around and dragging the movement pad produced no
additional observed long main-thread tasks in that sample. The canvas used its
normal 1.5 DPR, graphics profile and scenery; no visual settings were reduced.

This sample cannot establish the cause of the original large private account's
phone freezes. It supports fixing the independently reproduced recovery cost
without speculative scenery or bird changes. Cold startup still evaluates code,
verifies applicable saved proofs and prepares the first rendered scene.

## Profile checklist references

The `threejs-debug-profiler` workflow and all required references were read:
`debug-profile-checklists.md`, `checklists/performance-profile.md`,
`checklists/scene-debugging.md`, and `checklists/mobile-input.md`. No required
reference was skipped. Browser measurements distinguish main-thread tasks,
frame gaps, shader preparation and render CPU; they do not claim GPU timing.

## Explorer progress and immutable card wording

New explorers start at level 1 with zero earned XP and achievements. The HUD
uses existing earned world mastery plus the explorer's own admitted story XP,
with 100 points per level. It does not award points for owning, importing or
selecting starter cards. The previous default level 7 and three-species jump to
level 8 are removed. Living Story shows earned XP, achievements and the next
level's remaining points. Creature leveling, energy and gameplay reward amounts
are unchanged.

Migration ignores inflated display levels and preserves earned mastery and
authenticated native player continuity. Immutable historical card owners and
food owners do not determine explorer ownership. The existing 97-card Identity
Seal restore and profile activation regressions verify this distinction.
Cached admitted story progress is owner-bound and idempotent; unchanged XP and
grants retain the same state object, including across unrelated world revisions.

Public sharing checks now use the owner's verified public profile as an existing
recovery path before trying duplicate publication. Exact proof comparison and
anonymous public-read verification remain mandatory. Player-facing messages say
"public sharing link"; creature growth describes new sealed moments and explains
that earlier moments stay unchanged. Proof formats and internal append-history
fields are unchanged.

## Crew and market

The paw picker shows canonical static creature portraits and offers name,
species and rarity search, companion-mode filters, sorting and direct page
navigation. Only 12 creature cards render per page; a 1,003-creature regression
covers complete pagination. Commands still use each exact eligible creature's
ID, and no additional live 3D portrait canvases were added.

Both marketplace feeds accept an already authenticated signed-ID actor before
wallet delegation arrives, using the configured application adapter for these
public reads only. Protected mutations retain their existing player authority
requirements. Automatic retry applies only to transient session GET failures,
with three bounded delays and cancellation on closing. Refresh controls and
readable pending/error states replace raw authority codes. Live purchases or
sales were not performed; backend commerce and custody capability gates remain
required.

## Browser checks

The rebuilt production placement fixture admitted a finite-resource home,
rendered solid timber geometry and activated one collision instance. Reopening
the saved world recovered one admitted creation and one collision instance.
No new warning or error was captured in that fixture verification.

The normal world restored its actual earned explorer state (level 1, 7 XP),
with a visible 93-XP next-level readout. The paw picker showed the two actual
creature portraits; search, clear, companion filter and empty-filter recovery
worked. At 320 and 390 CSS pixels, the picker fit the viewport without document
overflow. The 390-pixel market view showed readable connection feedback and
resource sections; this local account did not have a live commerce session.
The public card link recovered successfully and the final growth panel displayed
sealed-moment wording. Temporary viewport and playtest recording overrides were
restored, and the temporary startup probe source was removed.

## Final verification

- `pnpm test`: 3,356 passed, zero failures, one existing skip (3,357 total).
- `WILDZ_ENABLE_TEST_FIXTURES=1 pnpm build`: production build passed.
- `pnpm typecheck` and `pnpm lint`: passed; lint retained two existing warnings.
- `git diff --check`: passed.

The local production preview is available at `http://127.0.0.1:3108/`.
Validation was completed before committing these changes; no deployment was
performed. The populated-account CPU benchmark does not establish zero latency
on the original phone PWA, and no live marketplace purchase or sale was executed.
