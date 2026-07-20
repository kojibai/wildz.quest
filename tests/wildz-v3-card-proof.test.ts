import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { creatureForm } from "../src/features/play/creature-catalog.js";
import { deriveKaiKlokMoment } from "../src/features/play/kai-klok-moment.js";
import { discoverLivingCreature } from "../src/features/play/living-taxonomy.js";
import { admitLegacyCard, verifyLivingCard } from "../src/features/play/living-card-proof.js";
import {
  embedPortableCardInPng,
  embedPortableVaultInPng,
  readWildzProofAppendsFromPng,
  verifyPortableCardPng,
  verifyPortableVaultPng
} from "../src/features/play/card-export.js";
import {
  canonicalPortableCardJson,
  sealDiscoveredCard,
  verifyPortableCard
} from "../src/features/play/portable-card.js";
import { extractVerifiedWildzCards } from "../src/lib/receiz/wildz-cross-platform-cards.js";

const BASE_PNG = Uint8Array.from(Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
));

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

  it("saves v3 Wildz identity as an append without changing the cross-platform proof object", () => {
    const discoveredAt = "2026-07-17T12:00:00.000Z";
    const form = creatureForm("mintcub-1")!;
    const identity = discoverLivingCreature({
      encounterId: "encounter:v3-cross-platform",
      form,
      discoveredAt,
      location: { x: 7, z: 11 },
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

    const png = embedPortableCardInPng(BASE_PNG, card);
    const portable = verifyPortableCardPng(png);
    assert.equal(portable.ok, true);
    assert.equal(portable.asset?.id, card.id);
    assert.equal(portable.asset?.manifest.variant.generatorVersion, 1);
    assert.notEqual(portable.asset?.proof.digest, card.proof.digest);

    const appends = readWildzProofAppendsFromPng(png);
    assert.equal(appends.length, 1);
    assert.equal(appends[0]!.base.assetId, portable.asset!.id);
    assert.equal(appends[0]!.base.proofDigest, portable.asset!.proof.digest);
    assert.equal(appends[0]!.asset.proof.digest, card.proof.digest);

    const restored = extractVerifiedWildzCards({
      pngBasis: png,
      verifiedPortableSnapshot: null,
      restoredVaultFiles: []
    });
    assert.equal(restored.assets.length, 1);
    assert.equal(restored.assets[0]!.proof.digest, card.proof.digest);
    assert.equal(restored.assets[0]!.manifest.variant.generatorVersion, 3);
    if (restored.assets[0]!.manifest.variant.generatorVersion !== 3) return;
    assert.equal(
      canonicalPortableCardJson(restored.assets[0]!.manifest.variant.traits.identity),
      canonicalPortableCardJson(identity)
    );
  });

  it("saves v3 Wildz vault cards as base portable proofs plus appends", () => {
    const discoveredAt = "2026-07-17T12:00:00.000Z";
    const form = creatureForm("mintcub-1")!;
    const card = sealDiscoveredCard({
      identity: discoverLivingCreature({
        encounterId: "encounter:v3-vault-cross-platform",
        form,
        discoveredAt,
        location: { x: 2, z: 3 },
        ownerScope: "player.receiz.id",
        moment: deriveKaiKlokMoment({ occurredAt: discoveredAt, authority: "world" })
      }),
      formId: form.id,
      ownerReceizId: "player.receiz.id",
      capturedAt: "2026-07-17T12:04:00.000Z",
      battleTranscriptDigest: "sha256:none"
    });

    const png = embedPortableVaultInPng(BASE_PNG, [card]);
    const vault = verifyPortableVaultPng(png);
    assert.equal(vault.ok, true);
    assert.equal(vault.assets[0]!.id, card.id);
    assert.equal(vault.assets[0]!.manifest.variant.generatorVersion, 1);
    assert.notEqual(vault.assets[0]!.proof.digest, card.proof.digest);

    const restored = extractVerifiedWildzCards({
      pngBasis: png,
      verifiedPortableSnapshot: null,
      restoredVaultFiles: []
    });
    assert.equal(restored.assets.length, 1);
    assert.equal(restored.assets[0]!.proof.digest, card.proof.digest);
    assert.equal(restored.assets[0]!.manifest.variant.generatorVersion, 3);
  });
});
