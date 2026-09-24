# Local save and recovery qualification

Verified on 2026-09-24 in the Codex in-app browser against the local development server and the official Receiz v127 worker, using an explicitly approved disposable enrolled signer.

- One-card and 46-card fixtures successfully sealed Card, Vault, Identity Seal, and Map artifacts.
- SDK canonical verification passed; the original payload bytes were recovered exactly; modified artifacts were rejected.
- The application upload parser accepted the sealed Identity as `identity-seal` and the signed player/Card/Vault payloads as `card-vault`. No fixture identity was activated and no user account was restored or replaced.
- Downloaded Vault and Identity files were selected through the file chooser and verified again. Both downloaded bytes and restored payload bytes matched the originals.
- The 46-card Vault artifact was 977,347 bytes. Prepared download handoff measured 1.7 ms for this Vault and 0.9 ms for the standalone Identity fixture. These are single local observations of the download call, not initial signing or disk-completion timings.

Identity Seal's production save callback now checks the shared exact-snapshot cache before awaiting preparation, preserving a synchronous download handoff when ready. Cold saves still require signing and verification; no stale snapshot or unverified file is substituted for speed.

The qualification fixture now uses a valid Receiz username, exercises the upload parser, offers a 46-card case, and exposes the direct-download fallback for browsers whose native share sheet cannot be automated. The in-app browser's native share attempt returned cancellation; physical iPhone save-sheet behavior remains unmeasured. The user's original verification failure did not recur in these runs, so its historical cause is not established by this evidence.
