import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { deriveKaiKlokMoment } from "../src/features/play/kai-klok-moment";
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
  assert.ok(dossier.birth.teachings.length >= 5);
  const moment = deriveKaiKlokMoment({ occurredAt: asset.manifest.capturedAt, authority: "local" });
  const semanticCopy = [dossier.birth.title, dossier.birth.passage, ...dossier.birth.geometry].join(" ");
  for (const calendarName of [moment.weekday, moment.weekName, moment.monthName, moment.ark]) assert.doesNotMatch(semanticCopy, new RegExp(calendarName, "i"));
  assert.doesNotMatch([dossier.birth.passage, ...dossier.birth.teachings].join(" "), /The [A-Za-z-]+ Ark\b/);
  assert.match(semanticCopy, /crimson|orange|gold|emerald|blue|violet|indigo|white/i);
  assert.match(semanticCopy, /square|triangle|vesica|hex|wave|octa|torus|merkaba|dodeca/i);
  assert.ok(dossier.birth.statShift.some((shift) => /[+-][1-3]/.test(shift)));
  assert.ok(dossier.personality.traits.some((trait) => asset.manifest.variant.generatorVersion === 2 && asset.manifest.variant.traits.birthProfile.characterTraits.some((value) => trait.toLowerCase().includes(value))));
});

test("legacy dossier does not claim a sealed Kai birth profile", () => {
  const asset = sealCollectedCard({ formId: "mintcub-1", ownerReceizId: "receiz:dossier", encounterId: "encounter:dossier-v1", capturedAt: "2026-07-17T12:00:00.000Z" });
  const dossier = projectLivingCardDossier(asset, "https://wildz.quest");
  assert.equal(dossier.birth.sealed, false);
  assert.match(dossier.birth.pulse, /^Recovered Birth Pulse /);
  assert.match(dossier.birth.cadueusKai, /^Y/);
  assert.ok(dossier.birth.geometry.length >= 4);
  assert.ok(dossier.birth.teachings.length >= 5);
  assert.equal(dossier.birth.statShift.length, 0);
  assert.ok(dossier.personality.traits.length >= 4);
});

test("card back uses the established caduceus Kai symbol instead of spelling the label", () => {
  const source = readFileSync(resolve(process.cwd(), "src/features/play/WildsCardBack.tsx"), "utf8");
  assert.match(source, /aria-label="Caduceus KAI">☤ KAI</);
  assert.doesNotMatch(source, />Cadueus KAI</);
});
