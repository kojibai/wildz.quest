import assert from "node:assert/strict";
import test from "node:test";
import { creatureForms } from "../src/features/play/creature-catalog";
import { deriveKaiKlokMoment, KAI_PULSE_DURATION_MS } from "../src/features/play/kai-klok-moment";
import {
  discoverLivingCreature,
  livingCreatureIdentityDigest,
  validateLivingCreatureIdentity
} from "../src/features/play/living-taxonomy";

function basis(index: number, formIndex = index % creatureForms.length) {
  const discoveredAt = new Date(Date.UTC(2026, 6, 17, 12, 0, index)).toISOString();
  return {
    encounterId: `encounter:taxonomy:${index}`,
    form: creatureForms[formIndex]!,
    discoveredAt,
    location: { x: index * 0.125, z: index * -0.25 },
    ownerScope: "receiz:taxonomy-corpus",
    moment: deriveKaiKlokMoment({ occurredAt: discoveredAt, authority: "world" })
  };
}

test("living taxonomy creates compact unique family-coherent creatures", () => {
  const identities = Array.from({ length: 1_024 }, (_, index) => discoverLivingCreature(basis(index)));
  assert.equal(new Set(identities.map((identity) => identity.name.display)).size, identities.length);
  assert.equal(new Set(identities.map((identity) => identity.identityDigest)).size, identities.length);
  for (const identity of identities) {
    assert.equal(identity.name.display.split(" ").length, 2);
    assert.ok(identity.name.display.split(" ").every((word) => /^[A-Z][a-z]{2,7}$/.test(word)), identity.name.display);
    assert.ok(identity.name.given.length <= 5, identity.name.display);
    assert.ok(identity.name.epithet.length <= 5, identity.name.display);
    assert.equal(validateLivingCreatureIdentity(identity).ok, true);
    assert.equal(identity.identityDigest, livingCreatureIdentityDigest(identity));
    assert.ok(identity.palette.primary.lightness <= 68);
    assert.ok(identity.palette.primary.chroma >= 48);
  }
});

test("related creatures inherit recognizable family anchors but remain individual", () => {
  const first = discoverLivingCreature(basis(2, 0));
  const sibling = discoverLivingCreature(basis(3, 0));
  const other = discoverLivingCreature(basis(4, 3));
  assert.equal(first.family.id, sibling.family.id);
  assert.equal(first.family.silhouette, sibling.family.silhouette);
  assert.equal(first.family.locomotion, sibling.family.locomotion);
  assert.equal(first.family.namingDialect, sibling.family.namingDialect);
  assert.notEqual(first.identityDigest, sibling.identityDigest);
  assert.notEqual(first.name.display, sibling.name.display);
  assert.notEqual(first.family.id, other.family.id);
});

test("adjacent Kai Pulses produce distinct new discoveries without renaming an identity", () => {
  const identities = Array.from({ length: 24 }, (_, index) => {
    const input = basis(index + 100);
    const discoveredAt = new Date(Date.parse(input.discoveredAt) + index * Math.ceil(KAI_PULSE_DURATION_MS)).toISOString();
    return discoverLivingCreature({ ...input, discoveredAt, moment: deriveKaiKlokMoment({ occurredAt: discoveredAt, authority: "world" }) });
  });
  assert.equal(new Set(identities.map((identity) => identity.discovery.kaiPulse)).size, identities.length);
  assert.equal(new Set(identities.map((identity) => identity.name.display)).size, identities.length);
  const first = identities[0]!;
  assert.equal(discoverLivingCreature(basis(100)).name.display, first.name.display);
});

test("name collisions advance through deterministic identity lanes", () => {
  const input = basis(900);
  const first = discoverLivingCreature(input);
  const occupied = new Set([first.name.display.toLowerCase()]);
  const rerolled = discoverLivingCreature(input, occupied);
  assert.equal(first.name.collisionLane, 0);
  assert.equal(rerolled.name.collisionLane, 1);
  assert.notEqual(rerolled.name.display, first.name.display);
  assert.deepEqual(discoverLivingCreature(input, occupied), rerolled);
});

test("every creature carries embodied emotional and motion traits", () => {
  const identity = discoverLivingCreature(basis(72));
  for (const value of Object.values(identity.personality)) assert.ok(value.length >= 3);
  for (const value of Object.values(identity.motion)) {
    if (typeof value === "string") assert.ok(value.length >= 3);
    else assert.ok(value >= 1_750 && value <= 4_500);
  }
  assert.notEqual(identity.personality.temperament, identity.personality.contrast);
});
