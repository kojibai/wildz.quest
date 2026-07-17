import assert from "node:assert/strict";
import test from "node:test";
import { applyKaiAffinityToHotspot, kaiEncounterCandidates } from "../src/features/play/kai-encounter-affinity";
import { hotspotsForRegion } from "../src/features/play/hidden-hotspots";
import { deriveKaiKlokMoment } from "../src/features/play/kai-klok-moment";

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
