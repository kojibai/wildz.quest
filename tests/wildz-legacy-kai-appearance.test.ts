import assert from "node:assert/strict";
import test from "node:test";
import { projectCardKaiAppearance } from "../src/features/play/card-kai-appearance";
import { canonicalPortableCardJson, sealCollectedCard } from "../src/features/play/portable-card";

const basis = {
  formId: "mintcub-1",
  ownerReceizId: "receiz:legacy-appearance",
  capturedAt: "2026-07-17T12:00:00.000Z"
};

test("legacy Wildz recover deterministic Kai appearance without changing their proof or colors", () => {
  const legacy = sealCollectedCard({
    ...basis,
    encounterId: "encounter:legacy-appearance",
    kaiPulse: "kai:historical-pulse",
    generatorVersion: 1
  });
  const before = canonicalPortableCardJson(legacy);
  const first = projectCardKaiAppearance(legacy);
  const second = projectCardKaiAppearance(legacy);

  assert.equal(first.source, "recovered");
  assert.equal(first.historicalPulse, legacy.manifest.variant.kaiPulse);
  assert.deepEqual(first.palette, legacy.manifest.variant.traits.palette);
  assert.deepEqual(first.profile.palette, legacy.manifest.variant.traits.palette);
  assert.deepEqual(first, second);
  assert.match(first.profile.cadueusKai, /^Y/);
  assert.ok(first.profile.geometry.sides >= 3);
  assert.ok(first.profile.morphology.head > 0);
  assert.equal(canonicalPortableCardJson(legacy), before);
});

test("Kai-born Wildz use their sealed birth profile", () => {
  const born = sealCollectedCard({
    ...basis,
    encounterId: "encounter:sealed-appearance",
    generatorVersion: 2
  });
  const appearance = projectCardKaiAppearance(born);

  assert.equal(appearance.source, "sealed");
  assert.equal(appearance.historicalPulse, born.manifest.variant.kaiPulse);
  if (born.manifest.variant.generatorVersion !== 2) assert.fail("expected v2 card");
  assert.deepEqual(appearance.profile, born.manifest.variant.traits.birthProfile);
  assert.deepEqual(appearance.palette, born.manifest.variant.traits.palette);
});
