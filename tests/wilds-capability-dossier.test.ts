import assert from "node:assert/strict";
import test from "node:test";
import { projectCreatureCapabilityIdentity } from "../src/features/play/creature-capability-identity";
import { projectLivingCardDossier } from "../src/features/play/living-card-dossier";
import { sealCollectedCard } from "../src/features/play/portable-card";

test("card dossier explains every proof-derived world family now and how it improves", () => {
  const asset = sealCollectedCard({ formId: "ledgerfox-1", ownerReceizId: "dossier", encounterId: "dossier:capabilities", capturedAt: "2026-08-25T12:00:00.000Z" });
  const identity = projectCreatureCapabilityIdentity(asset);
  const dossier = projectLivingCardDossier(asset, "https://wildz.quest");
  const world = dossier.gameplay.worldCapabilities;

  for (const specialty of identity.specialties) {
    const entry = world.find((candidate) => candidate.family === specialty.family);
    assert.ok(entry, `missing ${specialty.family}`);
    assert.equal(entry.availableNow.length > 20, true);
    assert.match(entry.evolution, /improves|increases/i);
  }
  assert.equal(new Set(world.map((entry) => entry.family)).size, world.length);
});

