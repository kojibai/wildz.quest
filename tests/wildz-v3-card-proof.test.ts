import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { creatureForm } from "../src/features/play/creature-catalog.js";
import { deriveKaiKlokMoment } from "../src/features/play/kai-klok-moment.js";
import { discoverLivingCreature } from "../src/features/play/living-taxonomy.js";
import { admitLegacyCard, verifyLivingCard } from "../src/features/play/living-card-proof.js";
import {
  canonicalPortableCardJson,
  sealDiscoveredCard,
  verifyPortableCard
} from "../src/features/play/portable-card.js";

describe("Wildz v3 discovery card proof", () => {
  it("seals the exact discovered identity and rejects identity tampering", () => {
    const discoveredAt = "2026-07-17T12:00:00.000Z";
    const form = creatureForm("mintcub-1")!;
    const identity = discoverLivingCreature({
      encounterId: "encounter:v3-proof",
      form,
      discoveredAt,
      location: { x: 4.25, z: -8.5 },
      ownerScope: "player.receiz.id",
      moment: deriveKaiKlokMoment({ occurredAt: discoveredAt, authority: "world" })
    });

    const card = sealDiscoveredCard({
      identity,
      formId: form.id,
      ownerReceizId: "player.receiz.id",
      capturedAt: "2026-07-17T12:04:00.000Z",
      battleTranscriptDigest: "sha256:none"
    });

    assert.equal(card.manifest.variant.generatorVersion, 3);
    if (card.manifest.variant.generatorVersion !== 3) return;
    assert.equal(card.manifest.name, identity.name.display);
    assert.equal(card.manifest.species, identity.species.name);
    assert.equal(
      canonicalPortableCardJson(card.manifest.variant.traits.identity),
      canonicalPortableCardJson(identity)
    );
    assert.equal(verifyPortableCard(card).ok, true);
    const living = admitLegacyCard(card, card.manifest.capturedAt);
    assert.equal(verifyLivingCard(living).ok, true);
    assert.equal(living.manifest.name, identity.name.display);
    assert.equal(living.manifest.birthGenome.palette.primary, identity.palette.primary.css);

    const tampered = structuredClone(card);
    if (tampered.manifest.variant.generatorVersion !== 3) return;
    tampered.manifest.variant.traits.identity.palette.primary.css = "hsl(0 0% 100%)";
    const checked = verifyPortableCard(tampered);
    assert.equal(checked.ok, false);
    assert.ok(checked.errors.includes("discovery_identity_invalid") || checked.errors.includes("variant_traits_mismatch"));
  });
});
