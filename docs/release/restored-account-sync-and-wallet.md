# Restored account, public link and resource-clock fixes

## Changes

- Preserve source-carried wallet holdings while independently recording an expired/missing server authorization. The read-authority recovery path now sees that failure even when the local seal remains verified.
- Refresh authority before transfer preview and establish a fresh identity-backed connection before Phi execution and wallet card/resource/material offers. Never automatically replay an uncertain transfer execution. Signing/reconnection errors have explicit UI feedback.
- An exported/displayed card link checks its exact anonymous public revision before attempting publication. Already-public cards require no redundant upload. A QR-rendering failure is distinct from publication failure.
- Restored profile publication confirms exact public cards and the existing profile before attempting writes. Account alignment/session-generation changes restart publication immediately rather than retaining the pre-alignment failure until the backoff timer.
- Profile publication details are collapsed behind the small status icon next to the handle. A published checkmark still requires confirmed publication.
- Resource rendering can receive restored harvest timestamps while the local Kai clock is still zero or behind. Presentation retains depletion at the last admitted instant without throwing or awarding replenishment. Actual harvest authority continues to reject out-of-order timestamps. The boss panel no longer displays unrelated shared-world errors.
- Phi supports six fractional digits; tests cover 0.000001, 0.001, 0.01 and 100.01. Exact balances are unchanged; the HUD still abbreviates large amounts while the open wallet displays the exact amount.

## Verification

All 2,301 tests passed. Production build and changed-file lint completed (existing Steward Environment hook warning remains). Regression coverage includes restored clock ordering, authority renewal state, already-public links with unavailable publication authorization, anonymous verification after a missing revision, and exact decimal formatting.

Isolated production browser on port 3023: saved test account loads; Profile reports live; its card opens; wallet Overview and Send recipient form render; browser warning/error log empty. The user's port 3022 game was not changed. No financial transfer or message was submitted. The original bjklock seal was not imported or inspected, so its live transfer completion and any remaining account-specific owner mismatch need verification after publishing.
