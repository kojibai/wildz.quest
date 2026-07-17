import assert from "node:assert/strict";
import test from "node:test";
import { creatureForms } from "../src/features/play/creature-catalog";
import { deriveKaiCreatureBirth } from "../src/features/play/kai-creature-birth";
import { deriveKaiKlokMoment } from "../src/features/play/kai-klok-moment";

const form = creatureForms[0]!;
const seed = `sha256:${"18a3cf90".repeat(8)}`;

test("Kai creature birth is deterministic, named, and conserves power", () => {
  const moment = deriveKaiKlokMoment({ occurredAt: "2026-07-17T12:00:00.000Z", authority: "admitted" });
  const first = deriveKaiCreatureBirth({ form, moment, seed });
  const second = deriveKaiCreatureBirth({ form, moment, seed });
  assert.deepEqual(first, second);
  assert.match(first.name.display, new RegExp(form.name.replace(/\s/g, ""), "i"));
  assert.equal(first.cadueusKai, moment.coordinate);
  assert.equal(Object.values(first.statShift).reduce((sum, value) => sum + value, 0), 0);
  assert.equal(
    Object.values(first.adjustedStats).reduce((sum, value) => sum + value, 0),
    Object.values(form.stats).reduce((sum, value) => sum + value, 0)
  );
  assert.ok(first.morphology.head >= 0.78 && first.morphology.head <= 1.22);
  assert.ok(first.morphology.signature.length >= 12);
});

test("all Kai Arks produce bounded but visibly distinct living forms", () => {
  const base = deriveKaiKlokMoment({ occurredAt: "2024-05-10T06:45:41.888Z", authority: "admitted" });
  const profiles = Array.from({ length: 6 }, (_, arkIndex) => deriveKaiCreatureBirth({
    form,
    seed,
    moment: {
      ...base,
      arkIndex,
      ark: (["Ignite", "Integrate", "Harmonize", "Reflekt", "Purify", "Dream"] as const)[arkIndex]!,
      arkProgress: 0.5,
      dayProgress: (arkIndex + 0.5) / 6
    }
  }));
  assert.equal(new Set(profiles.map((profile) => `${profile.name.display}|${profile.palette.primary}|${profile.markings.topology}`)).size, 6);
  for (const profile of profiles) {
    assert.ok(profile.palette.primary.startsWith("hsl("));
    assert.equal(profile.characterTraits.length, 4);
    assert.equal(profile.emotionalSignals.length, 3);
  }
});

test("offspring carry both parents and their own Kai birth moment", () => {
  const moment = deriveKaiKlokMoment({ occurredAt: "2026-07-17T12:00:00.000Z", authority: "admitted" });
  const parents = {
    parentIds: ["wilds:parent-a", "wilds:parent-b"] as const,
    inheritedSignals: ["parent-a:constellation", "parent-b:ember"] as const
  };
  const child = deriveKaiCreatureBirth({ form, moment, seed, lineage: parents });
  const swapped = deriveKaiCreatureBirth({
    form,
    moment,
    seed,
    lineage: { parentIds: [parents.parentIds[1], parents.parentIds[0]], inheritedSignals: [...parents.inheritedSignals].reverse() }
  });
  assert.deepEqual(child, swapped);
  assert.deepEqual(child.lineage?.parentIds, ["wilds:parent-a", "wilds:parent-b"]);
  assert.ok(child.lineage?.inheritedSignals.some((signal) => signal.startsWith("parent-a:")));
  assert.ok(child.lineage?.inheritedSignals.some((signal) => signal.startsWith("parent-b:")));
});
