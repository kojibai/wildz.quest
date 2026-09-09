# Standalone public card publication regression — 2026-09-09

## Observed production failure

Anonymous requests for these two exact cards returned HTTP 404 with `wildz_public_card_not_found`:

- `wilds:09052aa38d9ed958a63e46d3`
- `wilds:ad23c2ac2e4d017179caf37a`

The first card's canonical encoded URL, decoded URL, and compact URL returned no upstream public-proof record. Both cards' `wildz-card:<assetId>` namespace reads returned empty record lists. A previously documented comparison card (`wilds:123e00f59899025a366d578f`) returned HTTP 200 with a public card record. This establishes missing public recovery records, not damaged original proofs or a total standalone route outage. The historical reason either individual upstream record is absent cannot be established from these reads alone.

## Commit history

Commit `500f065` (2026-08-20 21:45:02 -0400), “fix: keep proof uploads off gameplay hot path,” removed `usePublicCardPublisher(deckCards, enabled && networkEnabled, admittedProofObjects)` from `PlayCampaign`. Profile readiness gating was introduced earlier that day in `c2351a0`. The profile publisher already iterated the bounded gallery. The September 8 change (`f6227b7`) subsequently added background profile retries. These are source-change dates, not verified production deployment dates or the disappearance dates of either reported card.

## Confirmed publication authorization failure

Production runtime logs for the first reported ID show repeated POST 400 responses on September 9 (including 11:14–11:24 UTC), so that card was being attempted, not merely omitted by the gallery limit. Republishing the unchanged, already-public comparison card returned HTTP 400 with `unauthorized`. Commit `be6ab53` (2026-08-20) removed delegated owner tokens and Identity Seal publishing from the card POST route. This is the directly reproduced authorization defect; the gallery/readiness findings below are additional defects, not sufficient explanations of those logged rejected attempts.

Restore delegated owner authorization. Where no usable token exists (including a stale cookie for another identity), return an authority-required response and let the client sign the exact card projection with its local Identity Seal. Relay that signed envelope through the same-origin card API: the live registry's CORS headers exclude Idempotency-Key, so direct cross-origin SDK publication cannot carry that header. The relay reconstructs and compares the exact single-card feed, and the upstream registry verifies the signature. Require a matching append acknowledgement. No private key or password is sent to the relay or registry.

## Code defects and correction

The shell's automatic card publication depended on profile publication readiness (identity, explorer and connected proof session). The profile publication function iterated `profile.vault`, a gallery truncated to 120 entries, instead of the complete supplied publishable inventory. A regression test reproduced the omission of card 121. The inventory rendered its QR immediately, independently of public availability.

- Mount the existing cooperative card publisher in the shell independently of profile readiness. Retain the exclusion of pending local custody claims.
- Publish all supplied publishable inventory entries, keeping gallery size separate from publication coverage. Existing exact-revision deduplication shares work with profile publication.
- Skip completed revisions before verification. Reuse admitted proof objects and worker serialization; bound card requests and retry on reconnect.
- Show the selected card QR only after anonymous public recovery confirms its exact proof revision. Retry unavailable links and pending custody synchronization. Bound requests and cancel them when the selected card changes or the Vault closes.

No reported card contents or proofs were fabricated, and proof and custody rules remain enforced. The patch is local. Restoring the two existing production links still requires deployment and publication from the original verified cards held by their owner. The corrected path has now completed a real publication for an existing locally held card, as recorded below.

## Validation

The gallery-limit and repeated-verification regression tests failed before the fix and passed afterward. The QR cancellation test likewise failed before signal propagation was added. Final validation: all 2,198 tests passed, the production build passed, targeted lint passed, and `git diff --check` passed. Review of the signed relay found no actionable authorization or data-contract defects.

## Live acceptance evidence

The updated localhost app published its existing verified Mayujeb card (`wilds:d09033b93eb910ab69a77db0`) through the local signed relay to the production Receiz registry: POST 201, followed by a cookie-free GET to `https://wildz.quest/api/cards/wilds%3Ad09033b93eb910ab69a77db0` returning 200. The real production standalone page displayed Mayujeb and its proof prefix `53E82200F977`. This was the existing local Vault card, not a fabricated replacement for either reported ID. The two reported URLs have not yet been confirmed recovered.
