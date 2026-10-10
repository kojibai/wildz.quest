import assert from "node:assert/strict";
import { test } from "node:test";
import { admitLegacyCard, appendLivingCardHistory, currentLivingGenome, verifyLivingCard } from "../src/features/play/living-card-proof";
import { canonicalPortableCardJson, sealCollectedCard } from "../src/features/play/portable-card";
import { projectCardCreatureLevelAppearance } from "../src/features/play/wilds-creature-level-appearance";
import { projectCardCreatureVisualIdentity } from "../src/features/play/creature-visual-identity";
import { projectCardKaiAppearance } from "../src/features/play/card-kai-appearance";
import { wildsCardArtwork } from "../src/features/play/wilds-card-artwork";
import { renderPortableCreatureThumbnail } from "../src/features/play/WildsCreatureThumbnail";
import { renderWildsCardSvg } from "../src/features/play/card-export";
import { renderHeartboundSvg } from "../src/features/play/heartbound-renderer";

const legacy = sealCollectedCard({ formId: "mintcub-1", ownerReceizId: "growth_keeper.receiz.id", encounterId: "level-appearance", capturedAt: "2026-08-11T12:00:00.000Z" });
const birth = admitLegacyCard(legacy, "2026-08-11T12:00:00.000Z");
function train(asset = birth, xpDelta = 100, sequence = 1) {
  return appendLivingCardHistory({ asset, event: {
    eventId: `training:appearance:${sequence}`, rulesetVersion: "wildz.progression.v1", occurredAt: `2026-08-11T12:${String(sequence).padStart(2, "0")}:00.000Z`,
    source: { mode: "training", activityId: `training:appearance:${sequence}`, actorId: asset.manifest.ownerReceizId, authority: "local" },
    evidence: {}, effects: [{ kind: "progress", xpDelta, growthEvents: [] }]
  } });
}

test("birth and legacy level-one art remain byte-for-byte unchanged", () => {
  assert.deepEqual(projectCardCreatureLevelAppearance(legacy), { level: 1, head: 1, torso: 1, limb: 1 });
  assert.deepEqual(projectCardCreatureLevelAppearance(birth), projectCardCreatureLevelAppearance(legacy));
  assert.equal(wildsCardArtwork(birth), renderHeartboundSvg(currentLivingGenome(birth), "card", { width: 640, height: 405, title: birth.manifest.name, fit: "full-body" }));
});

test("actual XP history grows the same creature at level two without changing its genesis or stage", () => {
  const before = canonicalPortableCardJson(birth), trained = train(), base = projectCardCreatureVisualIdentity(birth), grown = projectCardCreatureVisualIdentity(trained);
  const growth = projectCardCreatureLevelAppearance(trained);
  assert.equal(growth.level, 2);
  assert.ok(Math.abs(grown.morphology.head / base.morphology.head - growth.head) < 1e-12);
  assert.ok(Math.abs(grown.morphology.torso / base.morphology.torso - growth.torso) < 1e-12);
  assert.ok(Math.abs(grown.morphology.limb / base.morphology.limb - growth.limb) < 1e-12);
  assert.deepEqual(projectCardKaiAppearance(trained).morphology, grown.morphology);
  assert.deepEqual(grown.face, base.face); assert.equal(grown.fingerprint, base.fingerprint);
  assert.deepEqual(grown.appendages, base.appendages); assert.deepEqual(grown.palette, base.palette);
  assert.deepEqual(currentLivingGenome(trained), currentLivingGenome(birth));
  assert.deepEqual(trained.manifest.birth, birth.manifest.birth); assert.deepEqual(trained.manifest.revisions, birth.manifest.revisions);
  assert.equal(trained.manifest.stage, 1); assert.equal(trained.manifest.formId, birth.manifest.formId);
  assert.equal(canonicalPortableCardJson(birth), before); assert.equal(verifyLivingCard(trained).ok, true);
});

test("card, deck thumbnail, and exported card use the exact same growth sizing as the 3D projection", () => {
  const trained = train(), growth = projectCardCreatureLevelAppearance(trained);
  for (const svg of [wildsCardArtwork(trained), renderPortableCreatureThumbnail(trained), renderWildsCardSvg(trained)]) {
    assert.match(svg, /data-creature-level="2"/);
    assert.ok(svg.includes(`scale(${growth.torso} ${growth.limb})`));
    assert.ok(svg.includes(`scale(${growth.head / growth.torso} ${growth.head / growth.limb})`));
  }
  assert.notEqual(wildsCardArtwork(trained), wildsCardArtwork(birth));
});

test("maximum earned growth stays bounded and survives an exact portable reload", () => {
  const levelTwo = train(), maximum = train(levelTwo, 10_000, 2), growth = projectCardCreatureLevelAppearance(maximum);
  assert.equal(growth.level, 10);
  assert.ok(growth.head > 1 && growth.head < 1.07); assert.ok(growth.torso > 1.1 && growth.torso < 1.34); assert.ok(growth.limb > 1.06 && growth.limb < 1.2);
  const reopened = JSON.parse(canonicalPortableCardJson(maximum));
  assert.equal(verifyLivingCard(reopened).ok, true);
  assert.deepEqual(projectCardCreatureVisualIdentity(reopened), projectCardCreatureVisualIdentity(maximum));
  assert.equal(wildsCardArtwork(reopened), wildsCardArtwork(maximum));
  assert.equal(maximum.manifest.stage, 1); assert.deepEqual(projectCardCreatureVisualIdentity(maximum).appendages, projectCardCreatureVisualIdentity(birth).appendages);
});
