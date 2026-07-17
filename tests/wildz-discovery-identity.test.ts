import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyWildsInput, initialPlayState } from "../src/features/play/game-state.js";
import { nearbyHiddenHotspots } from "../src/features/play/hidden-hotspots.js";
import {
  livingCreatureIdentityDigest,
  validateLivingCreatureIdentity
} from "../src/features/play/living-taxonomy.js";
import {
  canonicalPortableCardJson,
  sealDiscoveredCard,
  verifyPortableCard
} from "../src/features/play/portable-card.js";

describe("Wildz discovery-sealed identity", () => {
  it("creates one permanent identity at first discovery and carries its name into battle", () => {
    const hotspot = nearbyHiddenHotspots(initialPlayState.player)[0]!;
    const discovered = applyWildsInput(initialPlayState, {
      type: "search-point",
      x: hotspot.position.x,
      z: hotspot.position.z,
      searchedAt: "2026-07-17T12:00:00.000Z",
      ownerReceizId: "player.receiz.id"
    });

    assert.notEqual(discovered.encounter.phase, "idle");
    if (discovered.encounter.phase === "idle") return;
    const identity = discovered.encounter.discoveryIdentity;
    assert.ok(identity);
    assert.equal(identity.encounterId, hotspot.id);
    assert.equal(validateLivingCreatureIdentity(identity).ok, true);
    assert.match(identity.name.display, /^[A-Z][a-z]{1,6}$/);
    assert.match(discovered.lastEvent, new RegExp(`^${identity.name.display} revealed itself`));

    const rediscovered = applyWildsInput(discovered, {
      type: "search-point",
      x: hotspot.position.x,
      z: hotspot.position.z,
      searchedAt: "2026-07-17T12:00:06.000Z",
      ownerReceizId: "player.receiz.id"
    });

    assert.notEqual(rediscovered.encounter.phase, "idle");
    if (rediscovered.encounter.phase === "idle") return;
    assert.equal(
      canonicalPortableCardJson(rediscovered.encounter.discoveryIdentity),
      canonicalPortableCardJson(identity)
    );

    const battling = applyWildsInput(rediscovered, {
      type: "start-battle",
      at: "2026-07-17T12:00:07.000Z"
    });

    assert.equal(battling.battle?.wild.name, identity.name.display);
    assert.match(battling.lastEvent, new RegExp(`^${identity.name.display} emerged\\.`));
    assert.notEqual(battling.encounter.phase, "idle");
    if (battling.encounter.phase !== "idle") {
      assert.equal(
        canonicalPortableCardJson(battling.encounter.discoveryIdentity),
        canonicalPortableCardJson(identity)
      );
    }
  });

  it("keeps a historically sealed long discovery name valid across naming updates", () => {
    const hotspot = nearbyHiddenHotspots(initialPlayState.player)[0]!;
    const discovered = applyWildsInput(initialPlayState, {
      type: "search-point",
      x: hotspot.position.x,
      z: hotspot.position.z,
      searchedAt: "2026-07-17T12:00:00.000Z",
      ownerReceizId: "player.receiz.id"
    });
    assert.notEqual(discovered.encounter.phase, "idle");
    if (discovered.encounter.phase === "idle" || !discovered.encounter.discoveryIdentity || !discovered.encounter.formId) return;
    const identity = structuredClone(discovered.encounter.discoveryIdentity);
    identity.name = {
      given: "Brikano",
      epithet: "Tanobaki",
      display: "Brikano Tanobaki",
      collisionLane: 0
    };
    identity.identityDigest = livingCreatureIdentityDigest(identity);

    assert.equal(validateLivingCreatureIdentity(identity).ok, true);
    const sealed = sealDiscoveredCard({
      identity,
      formId: discovered.encounter.formId,
      ownerReceizId: discovered.encounter.ownerReceizId,
      capturedAt: "2026-07-17T12:00:08.000Z"
    });
    assert.equal(sealed.manifest.name, "Brikano Tanobaki");
    assert.equal(verifyPortableCard(sealed).ok, true);
  });
});
