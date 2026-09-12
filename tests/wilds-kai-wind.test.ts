import test from "node:test";
import assert from "node:assert/strict";
import { KAI_N_DAY_MICRO, KAI_DAYS_PER_YEAR } from "../src/features/play/kai-klok-moment";
import { wildsKaiWindClimate, writeWildsKaiWind } from "../src/features/play/wilds-kai-wind";
const sample = (pulse: number, x = 10) => writeWildsKaiWind({ x: 0, z: 0 }, pulse, x, 30, wildsKaiWindClimate(pulse, "clear"));
test("the exact Kai moment and place reproduce wind without a random source or frame clock", () => {
  const pulse = 8_500_000_000_000;
  assert.deepEqual(sample(pulse), sample(pulse));
  assert.notDeepEqual(sample(pulse), sample(pulse + 11_000_000));
  assert.notDeepEqual(sample(pulse), sample(pulse, 80));
});
test("wind remains continuous across gust, day and Kai year boundaries", () => {
  for (const boundary of [1_370_000, Number(KAI_N_DAY_MICRO), Number(KAI_N_DAY_MICRO) * KAI_DAYS_PER_YEAR]) {
    const a = sample(boundary - 1), b = sample(boundary + 1);
    assert.ok(Math.hypot(a.x - b.x, a.z - b.z) < .000001);
  }
  const a = sample(7_000_000_000, 11.999), b = sample(7_000_000_000, 12.001);
  assert.ok(Math.hypot(a.x - b.x, a.z - b.z) < .00001);
});
test("season, time of day and local weather modulate a bounded field", () => {
  const day = Number(KAI_N_DAY_MICRO);
  assert.notEqual(wildsKaiWindClimate(Math.round(day * .25), "clear"), wildsKaiWindClimate(Math.round(day * .75), "clear"));
  assert.notEqual(wildsKaiWindClimate(0, "clear"), wildsKaiWindClimate(day * 168, "clear"));
  assert.ok(wildsKaiWindClimate(0, "sun-shower") > wildsKaiWindClimate(0, "clear"));
  const target = { x: 0, z: 0 };
  for (let index = 0; index < 500; index++) {
    const pulse = index * 123_456_789_123;
    assert.equal(writeWildsKaiWind(target, pulse, index, -index, wildsKaiWindClimate(pulse, "sun-shower")), target);
    assert.ok(Math.hypot(target.x, target.z) < .04);
  }
  for (const invalid of [-1, NaN, Infinity, .5]) assert.throws(() => wildsKaiWindClimate(invalid, "clear"));
});
