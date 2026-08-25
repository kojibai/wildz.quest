# Living Economy Resource Claims Implementation Plan

> **Execution note:** Implement inline with `superpowers:executing-plans`; subagents are not authorized for this run.

**Goal:** Turn the first regenerative Grove harvest into an exact, player-owned resource proof that appears in the wallet and can enter the universal playable-claim flow without duplicating Grove matter or treating a URL/API response as authority.

**Architecture:** A successful `harvest-honey` operation deterministically creates one immutable Living Honey resource lot while consuming the exact Grove honey input in the already-atomic V124 world operation. The shared-world projection carries the admitted lot and its owner/head. Wallet UI reads the warmed projection. Transfer issuance admits that exact lot as a Receiz subject and uses the SDK bearer rail; the playable claim carries the issued instrument, and claim admission changes ownership only through the verified Receiz receipt. Global publication remains asynchronous and subordinate to the source proof object.

**Constraints:**

- Receiz ID/proof object is authority; SDK, MCP, API, URL, receipt display, cache, and UI are subordinate.
- No portable transition set is fabricated. SDK 124.0.2 explicitly exposes verification/commit, not arbitrary transition-set issuance.
- Intermediate Grove working stock remains in the Grove; only the explicitly harvested output becomes personal custody.
- Exact quantity is integer-only and bound to operation, Grove, source/owner, Kai uPulse, and parent head.
- Claim is one-use, recipient-bound, and cannot duplicate, replay, or leave former-owner authority active.
- No network, proof verification, inventory reduction, or history scan enters the render/frame path.

## Task 1 — Exact resource-lot authority

- Create `src/features/play/wilds-resource-lot.ts`.
- Add failing tests for deterministic lot identity/head, exact source binding, one harvested unit, tamper rejection, and no lot for non-harvest actions.
- Derive the lot from the admitted operation and pre/post Grove heads; never accept caller-provided valuation or quantity.

## Task 2 — Shared-world custody continuity

- Add `resourceLots` to `WildsWorldProjection` and checkpoint replay.
- Include an exact `resourceLot` in `grove.act` only when the operation produces one.
- Validate operation/owner/source/head binding in the reducer and reject duplicate lot IDs.
- Include the actor inventory-lot head in the V124 inventory successor coordinate.

## Task 3 — Wallet asset projection

- Pass warmed, owner-filtered resource lots into the wallet terminal.
- Render exact Living Honey lots in Assets with provenance and verified status.
- Keep card presentation and existing wallet behavior unchanged; no fetch on render.

## Task 4 — SDK bearer resource claim

- Generalize the existing exact subject/bearer pattern for a resource lot.
- Add a `bearer-resource` universal claim carrier with strict lot/instrument/source/recipient/Kai binding.
- Add issue/claim API coverage and conversation claim context.
- Never invent a transition set; bearer receipt is admitted by the official SDK rail.

## Task 5 — Verification and release

- Focused domain, reducer, claim, route, and UI tests.
- Full test, lint, typecheck, Receiz checker/architecture lock, build, and narrow mobile browser verification.
- Confirm no hot-path authority work and a clean tree, then commit and fast-forward `main`.

