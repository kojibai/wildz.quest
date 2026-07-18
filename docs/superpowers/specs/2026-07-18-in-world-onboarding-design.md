# In-World Wildz Onboarding Design

## Decision

Wildz will no longer present a separate genesis page. The real gameplay console and world render immediately. Every visitor already has a generated or locally restored Receiz ID before this surface appears. A focused modal over the world asks the player to choose an explorer or add a Vault. Returning users change identity only through the Profile tab by restoring an Identity Seal or Record.

This follows the Receiz Commerce pattern: explorer selection is an in-game state, not a separate website entry page.

## Considered approaches

1. **In-world modal over the complete gameplay console — selected.** This makes the first choice feel like gameplay, keeps the world visible, and reuses the real HUD and canvas. Background mutation controls are gated until admission finishes.
2. **Split-screen entry beside a world preview.** This gives more explanatory room, but still feels like a separate onboarding page and duplicates responsive layout work.
3. **Compact bottom sheet over an unrestricted world.** This is visually light, but allows interaction before identity and character admission and is weaker for accessibility and recovery errors.

## Entry states

The shell owns one explicit onboarding state derived from continuity:

- `loading`: continuity bootstrap has not completed. A minimal non-scroll loading mark may cover the console.
- `choose-explorer`: a generated or proof-backed local Receiz ID exists, but it has no committed character.
- `restoring-vault`: a Vault is being verified and merged into the active Receiz ID.
- `restoring-identity`: an Identity Seal or Record is being verified from Profile and made active without discarding the working Vault.
- `ready`: identity, character, and owner-bound play state are committed.

A returning browser with complete continuity enters `ready` directly and never sees the onboarding modal.

## Gameplay mounting

When continuity has an identity but no character, the shell mounts `PlayCampaign` with a deterministic, non-persisted preview character. This allows the actual world, camera, NPC trainers, HUD, and control console to paint behind the modal.

Until a real character is committed:

- the onboarding modal is modal and consumes pointer/keyboard interaction;
- shared-world/network mutation is disabled;
- play-state persistence is disabled;
- the preview character is never written into continuity;
- closing the modal is not allowed from the explorer-choice state.

Choosing an explorer creates the real character with the current proof-backed identity, commits continuity, and updates the already-mounted campaign. The campaign should not remount merely because preview character becomes committed character.

## Onboarding modal

The modal contains:

- a short `Choose your explorer` heading;
- female and male explorer choices using the existing preview language;
- `Add Vault` as the collection import/merge action;
- a clear link to `Profile` for Receiz ID continuation or replacement;
- inline progress and friendly proof/restore errors.

It has no internal page scroll at supported viewport sizes. Short-height layouts reduce gaps and control height so all primary choices remain visible.

## Authentication and recovery

There is one identity-login surface and one separate Vault-import surface:

1. **Profile tab**
   - Continue a proof-backed Receiz ID already stored on this browser.
   - Restore another identity using its Identity Seal or Record from Profile.
   - The admitted Seal/Record becomes the active Receiz ID.
   - The current working Vault is retained when identity changes and all later Vault saves use the newly active Receiz ID.
   - A typed username alone never authenticates ownership.
2. **Vault upload**
   - A Receiz Commerce or Wildz Vault never changes the active Receiz ID.
   - Its verified cards and compatible player continuity merge into the working Vault already attached to the active Receiz ID.
   - Upload order does not matter: if an Identity Seal is restored after a Vault import, the merged working Vault remains present and future exports are saved with the newly active Receiz ID.

Vaults and card-only artifacts are collection imports, never identity login. Existing proof verification, immutable card provenance, and duplicate protection remain intact. Changing the active Receiz ID changes the owner coordinate used for the working Vault and future player-Vault exports; it does not rewrite the historical proof embedded in individual cards.

## Profile behavior before explorer selection

The Profile utility is visible while onboarding is active. Opening it pauses the explorer modal and presents the current Receiz ID plus Identity Seal/Record restore. Closing Profile returns to explorer selection under the now-active identity. Restoring identity does not clear cards or compatible continuity already present in the working Vault.

Profile must distinguish:

- `Continue as @name` for an admitted local proof-backed identity;
- `Restore Identity Seal or Record` for cross-device login or identity replacement;
- an unavailable/error state that preserves the current admitted identity.

## Vault behavior

The in-world Vault upload uses the same artifact verification and Vault reconciliation primitives as the Vault command surface. It must not introduce a second parser or merge implementation, and it must bypass any coordinator behavior that would replace the active identity from a player Vault.

After restore:

- a complete player Vault merges its verified cards and compatible continuity into the current owner without activating its embedded identity;
- an identity-bearing Vault is still treated as a Vault import and cannot change the active identity;
- a card-only artifact imports into the current owner and leaves explorer choice open;
- failed proof admission changes no identity, character, or inventory.

If Profile later admits an Identity Seal or Record, the shell atomically carries the current working Vault into the newly active identity snapshot. Subsequent autosaves and exports bind the player Vault to that new active Receiz ID.

## Error handling

Restore operations are atomic from the shell's perspective. The modal remains open while verification is pending. Recoverable failures display friendly text without clearing an already admitted local identity. Invalid or foreign unverified content never partially changes continuity. Network session connection remains best-effort after local proof admission and does not block local explorer choice.

## Accessibility and interaction

- The onboarding surface uses `role="dialog"`, `aria-modal="true"`, a labelled heading, and initial focus on the heading or first explorer choice.
- Background gameplay is inert while the modal is active.
- Escape does not dismiss required explorer selection.
- Restore progress uses `aria-live="polite"`; restore failures use `role="alert"`.
- The modal and gameplay shell prevent viewport overscroll.

## Verification

Automated coverage will assert:

- gameplay mounts before a character exists using a non-persisted preview;
- persistence and network mutation remain gated before character commit;
- explorer choice commits once without remounting the campaign;
- Profile exposes local continuation and Identity Seal restore before character selection;
- Vault upload routes through the shared verified restore adapter;
- Commerce Vault merge-into-active-ID and identity-switch-with-retained-Vault regressions remain green;
- the obsolete standalone genesis branch and page scrolling are removed.

Browser verification will cover desktop and mobile first entry, Profile continuation, explorer choice, Vault picker reachability, focus containment, non-scrolling viewport behavior, and transition into a responsive playable world.
