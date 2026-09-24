# Local save and recovery qualification

Verified on 2026-09-24 in the Codex in-app browser against the local development server and the official Receiz v127 worker, using an explicitly approved disposable enrolled signer.

- One-card and 46-card fixtures successfully sealed Card, Vault, Identity Seal, and Map artifacts.
- SDK canonical verification passed; the original payload bytes were recovered exactly; modified artifacts were rejected.
- The application upload parser accepted the sealed Identity as `identity-seal` and the signed player/Card/Vault payloads as `card-vault`. No fixture identity was activated and no user account was restored or replaced.
- Downloaded Vault and Identity files were selected through the file chooser and verified again. Both downloaded bytes and restored payload bytes matched the originals.
- The 46-card Vault artifact was 977,347 bytes. Prepared download handoff measured 1.7 ms for this Vault and 0.9 ms for the standalone Identity fixture. These are single local observations of the download call, not initial signing or disk-completion timings.

Identity Seal's production save callback now checks the shared exact-snapshot cache before awaiting preparation, preserving a synchronous download handoff when ready. Cold saves still require signing and verification; no stale snapshot or unverified file is substituted for speed.

The qualification fixture now uses a valid Receiz username, exercises the upload parser, offers a 46-card case, and exposes the direct-download fallback for browsers whose native share sheet cannot be automated. The in-app browser's native share attempt returned cancellation; physical iPhone save-sheet behavior remains unmeasured. The initial small-fixture runs did not reproduce the user's verification failure.

## Large-account regression

The subsequent PWA screenshot exposed `denied:VERIFICATION_RESOURCE_UNAVAILABLE`. A fixture with 49 cards plus 17 MiB of preserved application metadata reproduced exactly that rejection at 18,865,503 sealed bytes. The SDK's offline sealer had already verified its output; Wildz's generic `verifyReceizArtifact` call then rejected it at that wrapper's 16 MiB materialization limit.

PNG documents above 16 MiB now use the public `@receiz/sdk/offline` file verifier, the same canonical pinned-root verifier used by the SDK's sealer. The existing 64 MiB application bound remains. The adapter requires successful canonical verification and integrity, rejects native custody, and compares every extracted payload byte against the SDK-verified basis digest. It issues no synthetic SDK admission or ownership claim. Inner identity and player proofs still pass the original recovery parser.

After the fix, real browser worker sealing, exact recovery, and tamper rejection passed for large Card, Vault, Identity, and Map files. Downloaded files were separately inspected using the production recovery parser with disposable in-memory identity storage:

- Vault: 18,865,488 bytes; all 49 cards recovered; no identity activated.
- Identity Seal: 17,831,168 bytes; verified identity recovered; no identity activated.
- Prepared download handoff: 1.7 ms Vault, 2.2 ms Identity in this local browser, excluding initial preparation and disk completion.

Tests cover the operational-denial diagnostic, large unsealed PNG rejection, failed integrity, absent/non-document continuity, native custody rejection, payload digest mismatch, and unbound trailers. No existing account data is reset or discarded.
