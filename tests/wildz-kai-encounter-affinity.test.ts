import assert from "node:assert/strict";
import test from "node:test";
import { creatureForm } from "../src/features/play/creature-catalog";
import { applyKaiAffinityToHotspot, kaiEncounterCandidates } from "../src/features/play/kai-encounter-affinity";
import { hotspotsForRegion } from "../src/features/play/hidden-hotspots";
import { deriveKaiKlokMoment } from "../src/features/play/kai-klok-moment";
import { isWildsAquaticForm } from "../src/features/play/wilds-creature-habitat";

test("Kai affinity preserves the physical hotspot while shaping its creature", () => {
  const hotspot = hotspotsForRegion(2, -3)[0]!;
  const moment = deriveKaiKlokMoment({ occurredAt: "2026-07-17T12:00:00.000Z", authority: "world" });
  const first = applyKaiAffinityToHotspot(hotspot, moment, "receiz:explorer");
  const second = applyKaiAffinityToHotspot(hotspot, moment, "receiz:explorer");
  assert.deepEqual(first, second);
  assert.equal(first.id, hotspot.id);
  assert.deepEqual(first.position, hotspot.position);
  assert.equal(first.cover, hotspot.cover);
  assert.ok(kaiEncounterCandidates(hotspot).some((form) => form.id === first.formId));
});

test("Kai affinity has broad habitat-valid variety without hard locks", () => {
  const hotspot = hotspotsForRegion(0, 0)[0]!;
  const base = deriveKaiKlokMoment({ occurredAt: "2024-05-10T06:45:41.888Z", authority: "world" });
  const forms = Array.from({ length: 6 }, (_, arkIndex) => applyKaiAffinityToHotspot(hotspot, {
    ...base,
    arkIndex,
    ark: (["Ignite", "Integrate", "Harmonize", "Reflekt", "Purify", "Dream"] as const)[arkIndex]!,
    arkProgress: 0.4,
    dayProgress: (arkIndex + 0.4) / 6
  }, "receiz:explorer").formId);
  assert.ok(new Set(forms).size >= 2);
  assert.ok(kaiEncounterCandidates(hotspot).length > 1);
});

test("Kai affinity never moves a creature across the physical water partition", () => {
  const hotspots = [
    ...hotspotsForRegion(-4, -10),
    ...hotspotsForRegion(0, 0)
  ];
  const water = hotspots.find((hotspot) => hotspot.cover === "water")!;
  const land = hotspots.find((hotspot) => hotspot.cover !== "water")!;
  const base = deriveKaiKlokMoment({ occurredAt: "2024-05-10T06:45:41.888Z", authority: "world" });

  for (let arkIndex = 0; arkIndex < 6; arkIndex += 1) {
    const moment = {
      ...base,
      arkIndex,
      ark: (["Ignite", "Integrate", "Harmonize", "Reflekt", "Purify", "Dream"] as const)[arkIndex]!,
      arkProgress: 0.4,
      dayProgress: (arkIndex + 0.4) / 6
    };
    assert.equal(isWildsAquaticForm(creatureForm(applyKaiAffinityToHotspot(water, moment, `owner:${arkIndex}`).formId)!), true);
    assert.equal(isWildsAquaticForm(creatureForm(applyKaiAffinityToHotspot(land, moment, `owner:${arkIndex}`).formId)!), false);
  }
});

test("Kai affinity gives powered-flight encounters only powered-flight forms", () => {
  let aerial = hotspotsForRegion(0, 0).find((hotspot) => hotspot.layer === "air")!;
  for (let region = 1; !aerial && region < 20; region += 1) aerial = hotspotsForRegion(region, -region).find((hotspot) => hotspot.layer === "air")!;
  assert.ok(aerial);
  const powered = { ...aerial, requiredCapability: "flight" as const };
  const candidates = kaiEncounterCandidates(powered);
  assert.ok(candidates.length > 0);
  assert.equal(candidates.every((form) => form.anatomy.body === "winged"), true);
});
