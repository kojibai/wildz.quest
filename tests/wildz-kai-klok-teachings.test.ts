import assert from "node:assert/strict";
import test from "node:test";
import { deriveKaiKlokMoment } from "../src/features/play/kai-klok-moment";
import {
  KAI_CHAKRA_ARKS,
  KAI_ETERNAL_MONTHS,
  KAI_HARMONIC_DAYS,
  KAI_HARMONIC_WEEKS,
  KAI_MATH_TEACHINGS,
  deriveKaiMomentExpression
} from "../src/features/play/kai-klok-teachings";

test("Kai teaching tables preserve every ordered canonical cycle", () => {
  assert.deepEqual(KAI_HARMONIC_DAYS.map((item) => item.name), ["Solhara", "Aquaris", "Flamora", "Verdari", "Sonari", "Kaelith"]);
  assert.deepEqual(KAI_HARMONIC_WEEKS.map((item) => item.name), ["Awakening Flame", "Flowing Heart", "Radiant Will", "Harmonic Voh", "Inner Mirror", "Dreamfire Memory", "Krowned Light"]);
  assert.deepEqual(KAI_ETERNAL_MONTHS.map((item) => item.name), ["Aethon", "Virelai", "Solari", "Amarin", "Kaelus", "Umbriel", "Noktura", "Liora"]);
  assert.deepEqual(KAI_CHAKRA_ARKS.map((item) => item.name), ["Ignite", "Integrate", "Harmonize", "Reflekt", "Purify", "Dream"]);
  for (const table of [KAI_HARMONIC_DAYS, KAI_HARMONIC_WEEKS, KAI_ETERNAL_MONTHS, KAI_CHAKRA_ARKS]) {
    assert.equal(new Set(table.map((item) => item.id)).size, table.length);
    for (const item of table) {
      assert.ok(item.color && item.element && item.geometry && item.meaning);
      assert.doesNotMatch(item.meaning, /\b(?:kolor|koheren|klarity|kompassion|kreation|krowned)\b/i);
    }
  }
});

test("Kai math teaching retains the exact closure and zero-based lattice", () => {
  assert.match(KAI_MATH_TEACHINGS.join(" "), /3 \+ √5/);
  assert.match(KAI_MATH_TEACHINGS.join(" "), /17,491\.270421/);
  assert.match(KAI_MATH_TEACHINGS.join(" "), /17,424/);
  assert.match(KAI_MATH_TEACHINGS.join(" "), /00–35/);
  assert.match(KAI_MATH_TEACHINGS.join(" "), /00–43/);
  assert.match(KAI_MATH_TEACHINGS.join(" "), /00–10/);
  assert.match(KAI_MATH_TEACHINGS.join(" "), /1715323541888/);
});

test("the same Kai coordinate always says the same bounded canonical meaning", () => {
  const moment = deriveKaiKlokMoment({ occurredAt: "2026-07-16T22:00:00.000Z", authority: "admitted" });
  const first = deriveKaiMomentExpression(moment);
  const second = deriveKaiMomentExpression(moment);
  assert.deepEqual(first, second);
  assert.equal(first.day.name, moment.weekday);
  assert.equal(first.week.name, moment.weekName);
  assert.equal(first.month.name, moment.monthName);
  assert.equal(first.ark.name, moment.ark);
  assert.ok(first.summary.length > 40 && first.summary.length < 280);
  assert.match(first.summary, new RegExp(moment.weekday));
  assert.match(first.summary, new RegExp(moment.monthName));
});
