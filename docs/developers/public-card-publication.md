# Public card links and publication authorization

A verified creature card proves its contents and history. It does **not** authorize a write to the Receiz public registry. Keep these two checks separate when building compatible experiences.

## Read a card into an experience

Use the cookie-free `GET https://wildz.quest/api/cards/<encoded asset ID>` from your server. On success, parse the public record, require the requested exact asset ID, and admit the card into your experience once. The [working source example](../../examples/public-card-experience.ts) combines public recovery with the [creature compatibility entry point](../../src/experience/creature.ts).

Use your own server endpoint when the browser is on another origin; do not assume the Wildz card API offers cross-origin browser access. A 404 means that public recovery could not find this card. It does not establish that an owner's local verified original is invalid, and it is not permission to substitute a different creature. A local original may still be used after verification, while publication recovers separately.

## Publish a card from the Wildz source app

```ts
import { requireGloballyAvailablePublicWildsCard } from "../../src/features/play/public-card-registry";

const record = await requireGloballyAvailablePublicWildsCard(asset, fetch, {
  signal: controller.signal
});
// Only now display a share QR using record.sourceUrl.
```

This source integration assumes the repository's card API and local Identity Seal repository are present. It is not a standalone npm API. Pending local custody claims must finish reconciliation before entering the publishable inventory; see the shell's `publishableOwnerAssets` selection and the Vault QR guard.

The implementation follows this sequence:

1. Verify the card, or reuse its exact admitted Proof Object for client preparation. The server independently checks incoming data.
2. POST the card to `/api/cards/<assetId>`. A matching delegated owner token can authorize the upstream write. A verified card alone cannot.
3. If delegated authorization is unavailable, sign the exact single-card public projection locally with the owner's Identity Seal using Receiz SDK v126 `publicStore.signPublish`.
4. Send `{ asset, signedPublication }` to the same-origin card endpoint. Never send a private key, full Identity Seal, or passphrase. The relay checks the exact asset, source URL, owner coordinate, namespace and complete feed; Receiz verifies its signature and authorizes the append.
5. The server uses `publicStore.publishSigned` and requires a matching append acknowledgement. The client then confirms that anonymous GET returns the exact card ID and proof digest before presenting a share QR.

The same-origin relay is intentional: the live registry permits cross-origin `Content-Type` and authorization headers, but its CORS allow-list does not include `Idempotency-Key`. Server-to-server forwarding preserves the idempotency key without depending on browser CORS changes.

Implementation references:

- [Local signing](../../src/lib/receiz/wildz-card-identity-publication.ts)
- [Exact signed-envelope validation](../../src/lib/receiz/wildz-card-publication-envelope.ts)
- [Card API and relay](../../app/api/cards/[assetId]/route.ts)
- [Publication deduplication and anonymous confirmation](../../src/features/play/public-card-registry.ts)
- [Cooperative background publisher](../../src/features/play/use-public-card-publisher.ts)

External experiences that publish their own projections should use their own origin and namespace and enforce an equally exact relay contract. Do not reuse Wildz's namespace for unrelated experience state. Publishing a display projection is separate from custody, progression, battle settlement and other authoritative mutations.

## Diagnose failures

| Result | Meaning and response |
| --- | --- |
| `unauthorized` / `receiz_authority_required` | Registry publication lacks accepted authorization. Use a matching delegated token or the owner's signed publication. Retrying the same unsigned request cannot repair this. |
| `invalid_schema` on an unsigned registry POST | Without bearer authorization, the registry expects a signed envelope. Check the request path and envelope before assuming the creature card is invalid. |
| `wildz_public_card_owner_mismatch` | The local identity/key does not match the card owner. Do not sign with another owner's key. A stale delegated cookie should request local signing rather than use the stale token. |
| `wildz_public_card_signed_publication_invalid` | The relay rejected a feed that does not exactly describe this card and source. Rebuild the signed projection from the verified original. |
| `wildz_card_identity_unlock_required` | The local seal cannot sign unattended. Background work must not prompt repeatedly or send its password to a server. |
| Public GET 404 | No recoverable public record is available at this ID. Retry publication from the verified original, not reconstructed or invented data. |

Keep publication off the gameplay frame loop. Publish the whole eligible Vault independently of profile readiness and gallery pagination. Reuse admitted objects, deduplicate exact revisions, bound requests, and retry on reconnect. Do not repeatedly verify completed revisions while the player moves.

## Regression evidence

The August 20 `be6ab53` change removed the card endpoint's delegated and Identity Seal publication paths. `500f065` later removed the independent publisher. During the September 9 investigation, production logs showed repeated rejected POSTs; an unchanged already-public card also reproduced `unauthorized`. These commit dates establish source changes, not the deployment or disappearance time of any individual card.

The fix is covered by tests for the gallery limit, completed-revision reuse, cancellation of shared waits, authorization fallback, a real Ed25519 SDK signature, absence of private key material in requests, and rejection of altered relay feeds and foreign owners. A live existing card was successfully published through the repaired path (201), then loaded anonymously from `wildz.quest` (200). See the [incident evidence](../release/public-card-link-regression.md) for exact IDs and limits of that verification.
