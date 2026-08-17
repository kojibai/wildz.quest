# Wildz Living Creature Continuity — Receiz v120 implementation contract

## Scope and authority

Wildz v120 treats a living card as the creature's portable proof brain and projects it as a first-class Receiz living subject. The creature-history chain is append-only, replayable, parent-linked, and sealed back into the exact card. A downloaded Vault remains the Receiz SDK-native sealed artifact; the subject index and this application namespace do not replace SDK authority.

AI is an observer and voice. It may interpret the verified projection, choose embodied language and performance, and append an observed conversation, but it cannot invent, admit, reorder, or rewrite a world event. Factual memory requires citations to admitted event objects. Model intents require a distinct command admission before they can change state.

## Subject and proof-brain projection

The v120 adapter creates an exact `wildz.creature` subject from the card brain. Primary proof objects cover innate pre-capture identity, capture, every card-history event, conversations, and continuity events. Namespaces project identity, canonical state, self-model, memory, relationships, inventory, abilities, condition, world position, mandates, event history, derived projections, and byte-preserved Wildz application data.

The Twin response carries the subject head, proof-brain head, Merkle root, object count, registry digest, and reducer digest. The proof-brain index accelerates retrieval but has no authority of its own. Rebuilding the same card brain yields the same subject identity and evidence roots.

## Command-only mutation

Every continuity change enters through one of three commands:

- `activate-creature-continuity`: creates an owner-bound, digest-sealed roaming mandate.
- `pause-creature-continuity`: revokes future autonomous scheduling without deleting history.
- `settle-creature-continuity`: deterministically derives due events and atomically appends every verified result or writes nothing.

The reducer is the only mutation boundary. It constructs candidate cards, verifies their complete histories, and commits the inventory replacement only after all candidates succeed.

## Bounded autonomy

Autonomy is opt-in per creature, non-financial, and bounded to exploration, meetings, relationships, discovery, and keepsake barter. The v120 runtime limits catch-up to 72 hours and four actions per day. Ownership mismatch, retirement, invalid proof, invalid mandate digest, duplicate command, or invalid parent produces a stable denial and zero proof mutation.

Offline events are scheduled deterministically and admitted when the owner returns. The UI describes them as settled on return; it does not claim a server acted while the browser was closed.

## Determinism and replay

Action, location, counterpart, narrative, and effects are derived from the creature asset id, mandate digest, prior continuity head, and scheduled slot. Timestamps are logical schedule coordinates, not wall-clock decisions. Replaying the same card and command yields the same event digests and projection.

Owned-creature encounters use one transaction id and prepare both card histories before committing either card. Encounters with deterministic Wildz wanderers affect only the owned card.

## Ownership and transfer

Mandates bind to the exact owner Receiz id. A transferred/imported card keeps its complete memory, relationships, inventory, and history, but an old-owner mandate is inactive under the new owner. The new owner must explicitly activate a new mandate. Bearer ownership itself remains an SDK claim over the full sealed artifact.

## Native v120 runtime seam

The game-state reducer still depends on a narrow `LivingSubjectContinuityAdapter`, while dialogue is now observed through the official v120 living-subject runtime. This keeps gameplay semantics stable as commands, atomic world transactions, runtime jobs, mandates, portable minds, subscriptions, and bearer instruments move onto configured Receiz rails. A queued runtime job or Twin proposal remains zero-write until the exact command is admitted.

## Transfer continuity

A v120 bearer claim or instrument preserves subject identity and the complete proof brain. Former-owner authority is revoked immediately, including old mandates. Unknown namespaces remain byte-exact. The recipient must independently verify and claim the complete artifact; a UI notification, local receipt, or ownership projection cannot create custody.

## Verification gates

Typecheck, unit/law tests, deterministic replay, zero-write denial tests, multi-card atomicity tests, v120 SDK checker and MCP conformance, lint, secret scan, production build, and desktop/mobile browser verification must pass before release.
