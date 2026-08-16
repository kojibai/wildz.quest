# Wildz Living Creature Continuity — v119 implementation contract

## Scope and authority

Wildz v119 treats a living card as the creature's portable application proof brain. The creature-history chain is append-only, replayable, parent-linked, and sealed back into the exact card. A downloaded Vault remains the Receiz SDK-native sealed artifact; this application namespace does not claim to replace SDK authority.

AI is an observer and voice. It may explain the verified projection and append an observed conversation, but it cannot invent, admit, reorder, or rewrite a world event.

## Command-only mutation

Every continuity change enters through one of three commands:

- `activate-creature-continuity`: creates an owner-bound, digest-sealed roaming mandate.
- `pause-creature-continuity`: revokes future autonomous scheduling without deleting history.
- `settle-creature-continuity`: deterministically derives due events and atomically appends every verified result or writes nothing.

The reducer is the only mutation boundary. It constructs candidate cards, verifies their complete histories, and commits the inventory replacement only after all candidates succeed.

## Bounded autonomy

Autonomy is opt-in per creature, non-financial, and bounded to exploration, meetings, relationships, discovery, and keepsake barter. The v119 runtime limits catch-up to 72 hours and four actions per day. Ownership mismatch, retirement, invalid proof, invalid mandate digest, duplicate command, or invalid parent produces a stable denial and zero proof mutation.

Offline events are scheduled deterministically and admitted when the owner returns. The UI describes them as settled on return; it does not claim a server acted while the browser was closed.

## Determinism and replay

Action, location, counterpart, narrative, and effects are derived from the creature asset id, mandate digest, prior continuity head, and scheduled slot. Timestamps are logical schedule coordinates, not wall-clock decisions. Replaying the same card and command yields the same event digests and projection.

Owned-creature encounters use one transaction id and prepare both card histories before committing either card. Encounters with deterministic Wildz wanderers affect only the owned card.

## Ownership and transfer

Mandates bind to the exact owner Receiz id. A transferred/imported card keeps its complete memory, relationships, inventory, and history, but an old-owner mandate is inactive under the new owner. The new owner must explicitly activate a new mandate. Bearer ownership itself remains an SDK claim over the full sealed artifact.

## v120 migration seam

The runtime depends on a `LivingSubjectContinuityAdapter`, not invented v120 calls. The v119 adapter seals application events into the card history. A future v120 adapter can map the same commands, attempts, transactions, denials, and replay digests to first-class generic subjects, atomic units of work, causal sync, subscriptions, and delegation receipts without changing gameplay semantics.

## Verification gates

Typecheck, unit/law tests, deterministic replay, zero-write denial tests, multi-card atomicity tests, v119 SDK conformance, lint, production build, and desktop/mobile browser verification must pass before release.
