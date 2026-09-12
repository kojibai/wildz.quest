# Alongside travel and real exploration trips

## Player-facing changes

- The crew control has a distinct paw icon.
- Follow uses the player's observed travel direction to choose an alongside position. A progressing obstacle detour is retained until it completes or is blocked; neither the direct chase nor the planning timer resets it. Nearby supported alternatives handle an alongside target inside a tree.
- Explicit rifts, accepted site portals, invites, raid returns and required landing relocations advance a party transport marker. Accompanying creatures relocate only after the destination passes physical support/collision admission. Ordinary walking never advances that marker.
- Roam & explore prepares up to three actual terrain destinations, 8–32 metres from the departure point, using creature identity and the current Kai moment. Physical navigation controls arrival; the journal does not invent visits. Inspection pauses last at least one second in Kai coordinates. The creature returns after the trip or responds to recall.
- The existing active creature and two support slots can explore. Other roster preferences remain saved for when those creatures accompany the player.
- Visit records and return reports persist in owner/asset-scoped append-only IndexedDB history. These are explicitly local observations, not rewards, shared discoveries, world admissions or material custody.

## Runtime boundaries

Movement writes preallocated pose/target objects. Job/history writes occur at transitions, not per frame. Route preparation yields between bounded searches. No new rendering dependencies or network polling were added.

Additional non-active infrastructure: durable autonomous job CAS state, deterministic work proposals, and canonical SDK source-family/mandate transport adapters. Autonomous gathering, delivery and building are not activated. The exact primary-source retention and temporal-history integration gap is documented in `docs/implementation/crew-proof-source-integration.md`. No live mandate or asset transaction was performed. The execution/job dispatch fence and cross-device admission still require integration.

## Verification

- Full suite: 2,441 tests pass. Production build passes, with pre-existing package/lint warnings.
- Targeted changed-file ESLint passes.
- Moving-target regression follows around both a tree and a rock for 900 frames without crossing their collision volumes or resetting an active detour.
- Explicit transport tests distinguish relocation from ordinary following; valid Rift reducer tests advance the marker while walking does not.
- Real Chrome at390×844: the Roam button started a trip, all three separate destinations were recorded as visited, the creature returned, Follow restored after reload, and no page errors occurred. `/tmp/wildz-expedition-final.log` contains the observed journal summary.
- Active-trip Recall also returned to Follow after reload, without browser page errors.
- Final Chrome sample retained p95 frame interval16.67ms; this is a desktop browser at a mobile viewport, not a physical-phone guarantee.
- Existing and older-format verified cards both produce finite genome-derived exploration choices; unavailable paths do not fabricate arrivals.

This is not a claim of a complete autonomous world or10/10 realism. Physical-phone performance and full independent roster simulation remain unverified.
