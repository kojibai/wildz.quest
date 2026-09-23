# Game image export verification — v126

Creature cards, Identity Seals, combined identity/player cards, full Vaults, map
images, and the card-back proof download use the shared local sealing boundary.
Diagnostic playtest JSON is not a game proof export.

## Runtime

The app stays on SDK/MCP/AI-skills 126.0.0. SDK126's server convenience method is
not used for browser saves. Wildz temporarily carries the v126 browser sealing
primitives in `src/lib/receiz/local-seal/reference`; the source commit, file
hashes and adaptations are recorded in `provenance.json`. No changes to the
Receiz repository or SDK package are required. Replace this adapter with the
packaged v127 local entry point when available.

The browser enrolls an Ed25519 device once through the public-key-only
`/api/receiz/local-signer/enroll` proxy. It checks the returned certificate against
Receiz production roots, stores the nonextractable private key in IndexedDB,
and uses it with local Groth16 resources. Enrollment/renewal needs connectivity;
sealing and canonical verification after setup do not. Clearing browser storage
removes this device setup. Proof resources are hash-checked, prewarmed after the
world paints, and precached by the service worker.

Private recovery keys and game payloads never enter a remote sealing endpoint.
The retained server export route separately rejects plaintext recovery keys.

## Payload and verification

PNG identity trailers are packed inside the PNG before sealing because PNG
canonicalization does not bind trailing bytes. The SDK identity PNG namespace
remains readable across SDK consumers. The complete signed game envelope,
receipts, history and unknown PNG chunks survive byte-for-byte reconstruction.
The V4 signature covers the enclosing proof bundle. SDK canonical verification
and an exact payload digest check must pass before download. Sealed bytes are
never changed after issuance. Existing native objects cannot be wrapped as new
genesis by this sealer; their verified bytes must be reused or advanced through
the SDK transition workflow.

A new backup snapshot's enclosing native genesis is not a transfer of an
existing native asset. Preserving inner game history does not independently
prove every cross-application transfer workflow. Those transitions retain their
existing predecessor/append verification requirements.

## Evidence

`tests/wildz-local-image-seal.test.ts` generates all four export types with a
previously enrolled disposable device and real Groth16 proving. After loading
resources from disk it blocks all network calls, verifies each output with the
SDK canonical verifier, checks exact payload restoration, imports card/Vault
payloads through the Wildz codec, reads the carried identity through the standard
SDK namespace, and rejects tampering and rewrapping existing native objects.
The private test device key remains outside the repository. Run with
`WILDZ_TEST_SIGNER_FILE` pointing to an already-enrolled test fixture containing
`cert` and private JWK `key`; the test never enrolls a device itself.

Local measurements for the four small fixtures were roughly 0.5–0.8 seconds
including repeated verification. Repeated prepared-card saves reuse exact cached
bytes. Larger backups and slower devices can take longer; zero computation time
is not claimed. Original saved PNG bytes must be preserved: image editors or
photo services that strip metadata cannot preserve a proof they remove.

Old unsealed files are not retroactively canonical proof objects. Legacy game
payload readers remain separate from canonical verification.
