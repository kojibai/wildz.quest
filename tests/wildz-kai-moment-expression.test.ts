import assert from "node:assert/strict";
import test from "node:test";
import { deriveKaiKlokMoment } from "../src/features/play/kai-klok-moment";
import { projectKaiWorldExpression } from "../src/features/play/kai-moment-expression";

test("Kai world expression is a pure projection of the canonical moment", () => {
  const moment = deriveKaiKlokMoment({ occurredAt: "2026-07-16T22:00:00.000Z", authority: "world" });
  const first = projectKaiWorldExpression(moment);
  const second = projectKaiWorldExpression(moment);
  assert.deepEqual(first, second);
  assert.equal(first.accent, moment.accent);
  assert.equal(first.particles.geometrySides, moment.sides);
  assert.ok(first.atmosphericInfluence > 0 && first.atmosphericInfluence <= 0.18);
  assert.equal(first.dayProgress, moment.dayProgress);
  assert.ok(first.sun.elevation >= -0.5 && first.sun.elevation <= 1);
  assert.ok(first.sky.luminance >= 0.2 && first.sky.luminance <= 1);
  assert.equal(first.transitionKey.ark.endsWith(`:${moment.arkIndex}`), true);
});

test("Kai day begins at sunrise and remains continuously readable", () => {
  const genesis = deriveKaiKlokMoment({ occurredAt: "2024-05-10T06:45:41.888Z", authority: "world" });
  const sunrise = projectKaiWorldExpression(genesis);
  assert.equal(sunrise.dayPhase, "sunrise");
  assert.equal(sunrise.dayProgress, 0);
  assert.ok(sunrise.sun.elevation >= 0);
  assert.ok(sunrise.sun.elevation < 0.1, "00:00:00 is horizon sunrise, never the solar peak");
  assert.ok(sunrise.sky.luminance >= 0.2);

  const midday = projectKaiWorldExpression({
    ...genesis,
    beat: 12,
    ark: "Harmonize",
    arkIndex: 2,
    arkProgress: 0,
    dayProgress: 2 / 6,
    latticeCoordinate: "12:00:00"
  });
  assert.equal(midday.dayPhase, "midday");
  assert.ok(midday.sun.elevation > 0.85, "the peak belongs to midday, not 00:00:00");

  const samples = Array.from({ length: 72 }, (_, index) => ({
    ...genesis,
    dayProgress: index / 72,
    arkIndex: Math.floor(index / 12),
    arkProgress: (index % 12) / 12,
    ark: (["Ignite", "Integrate", "Harmonize", "Reflekt", "Purify", "Dream"] as const)[Math.floor(index / 12)]!
  }));
  for (const sample of samples) {
    const expression = projectKaiWorldExpression(sample);
    assert.ok(expression.atmosphericInfluence <= 0.18);
    assert.ok(expression.sky.luminance >= 0.06);
    assert.ok(expression.particles.opacity >= 0 && expression.particles.opacity <= 1);
  }
});

test("Dream becomes a genuinely dark star-lit night before a short predawn", () => {
  const genesis = deriveKaiKlokMoment({ occurredAt: "2024-05-10T06:45:41.888Z", authority: "world" });
  const deepNightMoment = {
    ...genesis,
    beat: 30,
    ark: "Dream",
    arkIndex: 5,
    arkProgress: 0,
    dayProgress: 5 / 6,
    latticeCoordinate: "30:00:00"
  } as const;
  const deepNight = projectKaiWorldExpression(deepNightMoment);
  assert.equal(deepNight.dayPhase, "night");
  assert.ok(deepNight.sky.luminance <= 0.1);
  assert.ok(deepNight.sun.elevation < 0);
  assert.ok(deepNight.sun.intensity <= 0.05);
  assert.ok(deepNight.night.amount >= 0.95);
  assert.ok(deepNight.night.starOpacity >= 0.9);
  assert.ok(deepNight.night.constellationOpacity >= 0.75);
  assert.ok(deepNight.celestial.moon.intensity > deepNight.sun.intensity);
  assert.ok(deepNight.lighting.rim > deepNight.lighting.hemisphere);

  const predawn = projectKaiWorldExpression({
    ...deepNightMoment,
    arkProgress: 0.9,
    dayProgress: 0.99
  });
  assert.equal(predawn.dayPhase, "night");
  assert.ok(predawn.night.predawn > 0);
  assert.ok(predawn.night.amount < deepNight.night.amount);
  assert.ok(predawn.night.starOpacity < deepNight.night.starOpacity);
  assert.ok(predawn.sky.luminance > deepNight.sky.luminance);
});
