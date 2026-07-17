import assert from "node:assert/strict";
import test from "node:test";
import { projectLivingCardDossier } from "../src/features/play/living-card-dossier";
import { sealCollectedCard } from "../src/features/play/portable-card";

test("Kai-born dossier turns the sealed moment into emotional creature identity", () => {
  const asset = sealCollectedCard({
    formId: "mintcub-1",
    ownerReceizId: "receiz:dossier",
    encounterId: "encounter:dossier-v2",
    capturedAt: "2026-07-17T12:00:00.000Z",
    generatorVersion: 2
  });
  const dossier = projectLivingCardDossier(asset, "https://wildz.quest");
  assert.equal(dossier.birth.sealed, true);
  assert.match(dossier.birth.pulse, /^Birth Pulse /);
  assert.match(dossier.birth.cadueusKai, /^Y/);
  assert.match(dossier.birth.passage, new RegExp(asset.manifest.name));
  assert.ok(dossier.birth.geometry.length >= 4);
  assert.ok(dossier.birth.statShift.some((shift) => /[+-][1-3]/.test(shift)));
  assert.ok(dossier.personality.traits.some((trait) => asset.manifest.variant.generatorVersion === 2 && asset.manifest.variant.traits.birthProfile.characterTraits.some((value) => trait.toLowerCase().includes(value))));
});

test("legacy dossier does not claim a sealed Kai birth profile", () => {
  const asset = sealCollectedCard({ formId: "mintcub-1", ownerReceizId: "receiz:dossier", encounterId: "encounter:dossier-v1", capturedAt: "2026-07-17T12:00:00.000Z" });
  const dossier = projectLivingCardDossier(asset, "https://wildz.quest");
  assert.equal(dossier.birth.sealed, false);
  assert.equal(dossier.birth.statShift.length, 0);
});
