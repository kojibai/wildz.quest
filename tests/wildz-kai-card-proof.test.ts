import assert from "node:assert/strict";
import test from "node:test";
import { canonicalPortableCardJson, sealCollectedCard, sha256PortableBasis, verifyPortableCard } from "../src/features/play/portable-card";

const basis = {
  formId: "mintcub-1",
  ownerReceizId: "receiz:kai-proof",
  encounterId: "encounter:kai-proof",
  capturedAt: "2026-07-17T12:00:00.000Z"
};

test("legacy v1 and Kai-born v2 cards verify independently", () => {
  const legacy = sealCollectedCard({ ...basis, generatorVersion: 1 });
  const born = sealCollectedCard({ ...basis, encounterId: "encounter:kai-born", generatorVersion: 2 });
  assert.equal(legacy.manifest.variant.generatorVersion, 1);
  assert.equal(born.manifest.variant.generatorVersion, 2);
  assert.equal(verifyPortableCard(legacy).ok, true);
  assert.equal(verifyPortableCard(born).ok, true);
  if (born.manifest.variant.generatorVersion !== 2) assert.fail("expected v2 card");
  assert.equal(born.manifest.name, born.manifest.variant.traits.birthProfile.name.display);
  assert.deepEqual(born.manifest.stats, born.manifest.variant.traits.birthProfile.adjustedStats);
});

test("v2 proof fails closed after semantic mutation even with a recomputed envelope digest", () => {
  const born = sealCollectedCard({ ...basis, encounterId: "encounter:kai-tamper", generatorVersion: 2 });
  const tampered = structuredClone(born);
  if (tampered.manifest.variant.generatorVersion !== 2) assert.fail("expected v2 card");
  tampered.manifest.variant.traits.birthProfile.morphology.head += 0.01;
  tampered.manifest.variant.traits.morphology.head += 0.01;
  tampered.manifest.variant.traitsDigest = sha256PortableBasis(canonicalPortableCardJson(tampered.manifest.variant.traits));
  tampered.proof.digest = sha256PortableBasis(canonicalPortableCardJson(tampered.manifest));
  const result = verifyPortableCard(tampered);
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes("variant_traits_mismatch"));
});
