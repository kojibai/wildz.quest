# Build a creature-compatible experience

Wildz includes the creature formats, verifiers, identity and appearance projections, current capabilities, history reducers, and Receiz v126 adapters. The source entry point is [`src/experience/creature.ts`](../../src/experience/creature.ts); a runnable, test-covered integration is [`examples/creature-experience.ts`](../../examples/creature-experience.ts). This is a source integration in this repository, not a separately published creature SDK package.

For QR URLs and publicly hosted cards, first read [public card recovery and publication authorization](public-card-publication.md). The [server-side public-card example](../../examples/public-card-experience.ts) recovers a card without owner cookies and then opens the compatible trail experience.

## Start with a verified creature

```ts
import {
  admitWildzExperienceCreature,
  checkWildzExperienceCompatibility
} from "../../src/experience/creature";

const result = admitWildzExperienceCreature(decodedGameCard);
if (!result.ok) throw new Error("This creature could not be verified.");
const creature = result.creature;

const river = checkWildzExperienceCompatibility(creature, {
  traversal: ["swim"]
});
// Render creature.visual; use river.compatible to offer the river route.
// Keep creature for subsequent frames. Admit again only for a new source/revision.
```

The input is a decoded Wildz game-card payload. For a carried PNG/native artifact, first use the installed SDK's `verifyReceizArtifact` and require `verified-artifact` with successful verification. Retain the original bytes and verify the expected payload digest; see [`wildz-downloaded-proof-verifier.ts`](../../src/lib/receiz/wildz-downloaded-proof-verifier.ts) for the exact API checks. A JSON payload check alone does not verify a native artifact envelope or prove current custody.

Admission rejects altered/unknown cards, isolates the caller's mutable input, and freezes the admitted source. Both legacy and living cards use the existing version-aware verifier. The returned contract carries the exact asset ID, proof digest, current revision digest, visual identity, condition, progression, and runtime abilities. Never substitute a species-level template for these values. Unknown future formats fail admission; retain their exact bytes without guessing a migration.

## Design around the actual being

| Need | Read |
| --- | --- |
| Stable individual identity | `assetId`, `proofDigest` |
| Current causal revision | `revisionDigest` |
| Genome-consistent appearance | `visual` |
| Fatigue, injuries, life and progression | `condition`, `identity.progression` |
| Available movement | `runtime.capabilities`: swim, climb, glide, flight |
| Available specialties | `runtime.abilities`, including availability, tags and power |
| Explain an unavailable route | compatibility result's missing traversal and ability tags |

Always provide an accessible ground route or explain unavailable routes. Capability readiness is a projection, not an authorization grant. Your own action still needs physical reach, terrain, condition, ownership and current-head validation. Wildz digging, for example, additionally checks dry routes, connected ancestry, fatigue, limb injury, safe geometry and reach.

## Make progress portable

A local mini-game can use the read-only projections immediately and keep its own session score. To make an action affect the creature across experiences, use an admitted command and the existing predecessor-bound history/subject transition path. Carry the exact prior head, actor authority, idempotency key and admitted Kai `uPulse`; independently verify the returned source before accepting it. Do not edit the manifest, invent a receipt, silently add XP, or treat a timestamp/model response as authority.

Use [`src/lib/receiz`](../../src/lib/receiz) for artifact/subject adapters and [`wilds-world-service.ts`](../../src/features/play/wilds-world-service.ts) for concrete command admission patterns. Native custody transfers, commerce, shared durable world state, ranked outcomes and irreversible life changes need their configured Receiz authority rails. Being able to render or inspect a creature is not proof of custody or permission to mutate it. MCP and AI skills assist development; they do not belong in the animation loop or confer authority.

## Compatibility checks

Run `pnpm test` and `pnpm typecheck`. The experience test checks exact identity retention, real capability gating, malformed/tampered input rejection and zero extra verification when reusing an admitted object. Existing suites cover living history, custody, ancestry, version compatibility and mutation admission. For your experience, also test a creature lacking each required capability, changed condition, a new revision, offline continuation, conflicting heads and action replay.

Do admission and projection outside the frame loop. Preserve immutable references while playing. Recompute readiness when a new verified revision or admitted condition arrives; a cached old projection must not authorize a new mutation. Keep optional assets asynchronous and bounded. Full cross-application certification and a standalone npm starter are not provided by this entry point.
