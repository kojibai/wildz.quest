# Wildz v3 artifact interoperability

## Status

This document defines the v3/v104 interoperability contract and names the local focused evidence. External writer, strict-live, and remote mutation qualification remain separate gates and are not inferred from package installation or fixtures.

## Authority order

1. The official Receiz v104 verifier establishes cryptographic proof status for the exact enclosing artifact.
2. An Identity Seal may activate only its verified embedded identity. An identity-bearing player Vault additionally requires a valid Wildz binding or verified enclosing Vault owner. A card-only Vault never supplies identity authority.
3. New exports use the SDK native Record → Seal operation. Wildz submits only artifact type and exact payload bytes; the SDK service resolves owner and proof authority.
4. Native creation succeeds only when owner, claim, verify path, verification bundle, and final downloaded bytes agree. The SDK-returned artifact is never rewrapped.
5. Existing v102 `receiz.portable_asset.v1` artifacts are decoded by a strict read-only compatibility reader, then verified through the SDK rail with their legacy namespace and prior-head binding intact. A local decoder never authenticates an artifact by itself.
6. Only verified Wildz card domains become playable cards; unrelated portable domains remain unrelated.

The player OIDC session requests the v104 proof-store Record/Seal/Verify scopes `receiz:record`, `receiz:seal`, and `receiz:verify` because native card and Vault creation uses that authenticated rail. `offline_access` is not requested, and refresh tokens are not transported or retained by Wildz.

## Cross-platform collection continuity

The verified player Vault owns the current session and collection custody. Individual card proofs retain their historical owner and creator coordinates, so assets produced by another compatible Receiz application remain portable without rewriting provenance.

Collection reconciliation is deterministic:

- byte/canonical exact duplicates collapse to one card;
- an authenticated legacy-to-living transition or longer verified living revision replaces its ancestor regardless of encounter order;
- a same-ID card with an incompatible origin, rewritten immutable provenance, or divergent revision fork fails the import.

This permits full-Vault restoration without turning duplicate dropping into a proof bypass.

## Byte preservation

For v104 creation, the SDK-returned native artifact is the final download and is preserved byte-identical with its returned MIME type. The deployed `wildz-v103` idempotency namespace is intentionally retained so retries remain stable across the SDK upgrade. For legacy v102 input, the compatibility reader validates canonical structure, payload digest, bundle basis, and proof claim before exposing the original payload bytes. PNG Wildz payloads and identity trailers remain exact inputs to their respective verifiers.

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
| `sdk-compatible` | Local SDK v104 contract coverage; external exercise pending |

No writer version, commit, digest, card identifier, or compatibility result is invented. Private artifact paths, usernames, identifiers, bytes, and hashes stay outside repository documentation; only sanitized count/binding/pass evidence may be recorded.

There is no external database in this interoperability path. Local files and browser IndexedDB are carriers or owner-scoped continuity stores, while verified proof and configured Receiz rails remain authoritative.
