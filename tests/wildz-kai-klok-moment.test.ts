import test from "node:test";
import assert from "node:assert/strict";
import {
  deriveKaiKlokMoment,
  KAI_CHAKRA_GEOMETRY
} from "../src/features/play/kai-klok-moment";

test("Kai Klok moment is deterministic at the genesis anchor", () => {
  const moment = deriveKaiKlokMoment({
    occurredAt: "2024-05-10T06:45:41.888Z",
    authority: "admitted"
  });

  assert.deepEqual(moment, {
    authority: "admitted",
    pulse: 0,
    beat: 0,
    stepIndex: 0,
    pulseInStep: 0,
    percentIntoPulse: 0,
    stepPctAcrossBeat: 0,
    weekday: "Solhara",
    chakra: "Root",
    year: 0,
    month: 1,
    day: 1,
    week: 1,
    weekName: "Awakening Flame",
    monthName: "Aethon",
    ark: "Ignite",
    arkIndex: 0,
    latticeCoordinate: "00:00:00",
    coordinate: "Y0·M1·D1·00:00:00·KAI0",
    accent: "#CC3F3F",
    hue: 0,
    sides: 4,
    gate: "Earth Gate"
  });
});

test("chakra geometry uses the canonical Kai tables", () => {
  assert.deepEqual(KAI_CHAKRA_GEOMETRY.Heart, {
    accent: "#2CCB99",
    hue: 140,
    sides: 8,
    gate: "Air Gate"
  });
  assert.equal(KAI_CHAKRA_GEOMETRY.Crown.sides, 16);
});

test("the same admitted time always produces identical moment state", () => {
  const input = {
    occurredAt: "2026-07-16T22:00:00.000Z",
    authority: "admitted" as const
  };
  assert.deepEqual(deriveKaiKlokMoment(input), deriveKaiKlokMoment(input));
});

test("the inner pulse rolls from ten to zero as the step advances", () => {
  const pulseTen = deriveKaiKlokMoment({ occurredAt: "2024-05-10T06:46:34.451Z", authority: "local" });
  const pulseEleven = deriveKaiKlokMoment({ occurredAt: "2024-05-10T06:46:39.708Z", authority: "local" });
  assert.equal(pulseTen.pulseInStep, 10);
  assert.equal(pulseEleven.pulseInStep, 0);
  assert.equal(pulseEleven.stepIndex, 1);
});

test("invalid or non-canonical timestamps fail closed", () => {
  assert.throws(() => deriveKaiKlokMoment({ occurredAt: "not-time", authority: "local" }), /wilds_kai_moment_time_invalid/);
  assert.throws(() => deriveKaiKlokMoment({ occurredAt: "2026-07-16T22:00:00Z", authority: "world" }), /wilds_kai_moment_time_invalid/);
});
