# Profile publication repair — September 9, 2026

The profile route recognized proof-session identities without requiring an actual delegated registry token. Unlike the repaired card flow, the client had no Identity Seal signing fallback. The route also checked gallery cards only in the legacy shared public projection, although standalone cards are now published independently.

Added local profile signing and a same-origin relay with exact sanitized profile/feed binding. Receiz verifies the signature and must return a matching append acknowledgement. Token and signed paths publish the same per-profile record; anonymous reads resolve it before the legacy projection. Current card ownership and exact proof checks remain required. Gallery lookups use bounded concurrency.

Live debugging additionally reproduced `receiz.canonicalJson: unsupported JSON value: undefined` for an unlisted companion. Optional gallery fields now remain absent instead of carrying undefined values. A regression test with an unlisted companion reproduces that failure before the change and signs successfully afterward.

Validation: all 2,202 tests passed; the production build and targeted lint passed; `git diff --check` passed. Review identified serial gallery reads, corrected to batches of six. The build retains two unrelated lint warnings in the builder fixture and steward environment. This is a local source change, not a production deployment.

Live acceptance: the existing local profile `wildz_b4d9ab7248523b67` published through the signed relay to the production registry (POST 201). A cookie-free GET to the updated local profile API returned 200 with that profile and its Mayujeb gallery card. The local relay took about 12.7 seconds including public ownership/card reads and upstream publication; gameplay does not await it. Production profile-page code still requires deployment.
