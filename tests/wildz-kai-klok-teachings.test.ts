import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";
import { deriveKaiKlokMoment } from "../src/features/play/kai-klok-moment";
import { KaiTeachingSpectrum } from "../src/features/play/command-center/WildsKaiMomentInspector";
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

test("every Kai teaching exposes its exact visible color pair", () => {
  const exactColors = {
    Solhara: ["#8F1537", "#E44957"], Aquaris: ["#F26A21", "#FFB347"], Flamora: ["#F4B41A", "#FFE66D"],
    Verdari: ["#118C5B", "#4DE2A5"], Sonari: ["#1356B8", "#45B8FF"], Kaelith: ["#7B4DCC", "#F7F2FF"],
    "Awakening Flame": ["#8F1537", "#E44957"], "Flowing Heart": ["#F47A23", "#FFC04D"], "Radiant Will": ["#E8A90E", "#FFF08A"],
    "Harmonic Voh": ["#174EA6", "#51C8FF"], "Inner Mirror": ["#2F2A8C", "#7568FF"], "Dreamfire Memory": ["#7F3FCB", "#D9D6E8"],
    "Krowned Light": ["#F5D36B", "#FFFFFF"], Aethon: ["#8F1537", "#E44957"], Virelai: ["#F26A21", "#F7C948"],
    Solari: ["#E8A90E", "#FFF08A"], Amarin: ["#0F8B72", "#5FE0C0"], Kaelus: ["#174EA6", "#51C8FF"],
    Umbriel: ["#251333", "#7D3C98"], Noktura: ["#3C2A8C", "#E15B97"], Liora: ["#F5D36B", "#FFFFFF"],
    Ignite: ["#8F1537", "#E44957"], Integrate: ["#F26A21", "#F7C948"], Harmonize: ["#118C5B", "#63E6D2"],
    Reflekt: ["#2F2A8C", "#3B82F6"], Purify: ["#6F2DBD", "#FFF0A8"], Dream: ["#8C66C7", "#D8FFF4"]
  } as const;
  const teachings = [KAI_HARMONIC_DAYS, KAI_HARMONIC_WEEKS, KAI_ETERNAL_MONTHS, KAI_CHAKRA_ARKS].flat();

  assert.equal(teachings.length, 27);
  assert.deepEqual(Object.fromEntries(teachings.map((item) => [item.name, item.visual])), exactColors);
});

test("a collapsed Kai teaching group still paints every canonical color", () => {
  const markup = renderToStaticMarkup(createElement(KaiTeachingSpectrum, { items: KAI_HARMONIC_DAYS }));

  assert.equal((markup.match(/class="wilds-kai-spectrum-color"/g) ?? []).length, 6);
  assert.match(markup, /aria-label="Deep crimson, Ember orange, Golden yellow, Emerald green, Deep blue, Violet-white"/);
  assert.match(markup, /--kai-teaching-start:#8F1537;--kai-teaching-end:#E44957/);
  assert.match(markup, /--kai-teaching-start:#7B4DCC;--kai-teaching-end:#F7F2FF/);
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

test("Beat Step Pulse derives from the full Kai day instead of wrapping at the semantic grid", () => {
  const moment = deriveKaiKlokMoment({ occurredAt: "2024-05-11T08:07:31.143Z", authority: "world" });

  assert.equal(moment.pulse, 17_438);
  assert.equal(moment.beat, 35);
  assert.equal(moment.stepIndex, 39);
  assert.equal(moment.pulseInStep, 2);
  assert.equal(moment.latticeCoordinate, "35:39:02");
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
