# Wildz v3 artifact interoperability

## Status

This document defines the v3/v113 interoperability contract and names the local focused evidence. External writer, strict-live, and remote mutation qualification remain separate gates and are not inferred from package installation or fixtures.

## Authority order

1. The official Receiz v113 verifier establishes cryptographic proof status for the exact enclosing artifact.
2. An Identity Seal may activate only its verified embedded identity. A player Vault supplies canonical identity only with a valid Wildz identity binding or explicit v113 owner-continuity proof. A legacy proof-sealed player Vault supplies artifact-scoped recovery authority, while a card-only Vault never supplies identity authority.
3. New exports use the SDK native Record → Seal operation. Wildz submits only artifact type and exact payload bytes; the SDK service resolves owner and proof authority.
4. Native creation succeeds only when owner, claim, verify path, verification bundle, and final downloaded bytes agree. The SDK-returned artifact is never rewrapped.
5. Existing legacy artifacts are opened first by v113 `artifacts.verifyAndOpen`; only its verified payload may enter the read-only compatibility parser, with legacy namespace and prior-head history preserved. A local parser never authenticates an artifact.
6. Only verified Wildz card domains become playable cards; unrelated portable domains remain unrelated.

Normal player entry uses the official v113 signed Receiz ID continuation through the Wildz same-origin proxy; it does not redirect and does not place a generated player access token in application environment variables. Native Record/Seal/Verify operations still require an authenticated Receiz rail and fail closed when the required capability is absent. The isolated legacy OAuth compatibility scope set includes `receiz:record`, `receiz:seal`, and `receiz:verify` for authenticated native rails; normal signed-continuation login does not use it. `offline_access` is not requested, and Wildz neither transports nor retains refresh tokens.

## Cross-platform collection continuity

An owner-bound verified player Vault can establish canonical session and collection custody. A legacy proof-sealed player Vault establishes artifact-scoped recovery and collection custody only; its carried handle is presentation data until key or owner-continuity authority is proven. Individual card proofs retain their historical owner and creator coordinates, so assets produced by another compatible Receiz application remain portable without rewriting provenance.

Collection reconciliation is deterministic:

- byte/canonical exact duplicates collapse to one card;
- an authenticated legacy-to-living transition or longer verified living revision replaces its ancestor regardless of encounter order;
- a same-ID card with an incompatible origin, rewritten immutable provenance, or divergent revision fork fails the import.

This permits full-Vault restoration without turning duplicate dropping into a proof bypass.

For gameplay, the server derives a player-bound Merkle commitment from historical-owner cards only after verifying the exact enclosing Vault. The encrypted proof session retains that root, while the client sends a compact membership path for the active historical card. Current-owner cards need no path; an unrelated, missing, or tampered path fails closed. This preserves immutable provenance and keeps a large cross-platform Vault out of the movement heartbeat.

## Byte preservation

For v113 creation, the SDK-returned native artifact is the final download and is preserved byte-identical with its returned MIME type. The `wildz-v113` idempotency namespace binds retries to the exact payload digest. Legacy input is opened only by v113 `artifacts.verifyAndOpen`; Wildz receives only verified payload bytes and `verified-legacy-read` coordinates. PNG Wildz payloads and identity trailers remain exact inputs to their respective verifiers.

Focused boundaries:

- `src/features/play/card-export.ts`
- `src/lib/receiz/legacy-receiz-portable-asset.ts`
- `src/lib/receiz/wildz-artifact-codec.ts`
- `src/lib/receiz/wildz-proof-object-export.ts`
- `src/lib/receiz/wildz-proof-sealed-vault.ts`
- proof-export, proof-continuity, historical-owner, and full-Vault regression tests

## External writer matrix

| Required non-private writer label | Current evidence |
|---|---|
| `receiz-commerce` | Pending external sanitized exercise |
| `receiz-app` | Pending external sanitized exercise |
| `receiz-signal` | Pending external sanitized exercise |
| `receiz-sealed-card` | Pending external sanitized exercise |
| `wildz-original` | Local source-compatible regression coverage; external exercise pending |
| `sdk-compatible` | Local SDK v113 contract coverage; external exercise pending |

No writer version, commit, digest, card identifier, or compatibility result is invented. Private artifact paths, usernames, identifiers, bytes, and hashes stay outside repository documentation; only sanitized count/binding/pass evidence may be recorded.

There is no external database in this interoperability path. Local files and browser IndexedDB are carriers or owner-scoped continuity stores, while verified proof and configured Receiz rails remain authoritative.
