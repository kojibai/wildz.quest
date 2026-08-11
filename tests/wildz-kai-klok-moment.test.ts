import test from "node:test";
import assert from "node:assert/strict";
import {
  deriveKaiKlokMoment,
  KAI_CHAKRA_GEOMETRY,
  KAI_GENESIS_TS,
  KAI_PULSE_DURATION_MS,
  millisecondsUntilNextKaiPulse
} from "../src/features/play/kai-klok-moment";

test("Kai Klok moment is deterministic at the genesis anchor", () => {
  const moment = deriveKaiKlokMoment({
    occurredAt: "2024-05-10T06:45:41.888Z",
    authority: "admitted"
  });

  assert.deepEqual(moment, {
    authority: "admitted",
    uPulse: 0,
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
    dayProgress: 0,
    arkProgress: 0,
    latticeCoordinate: "00:00:00",
    coordinate: "Y0·M1·D1·00:00:00·KAI0",
    accent: "#CC3F3F",
    hue: 0,
    sides: 4,
    gate: "Earth Gate"
  });
});

test("Kai uPulse is the exact deterministic temporal authority beneath a pulse", () => {
  const atGenesis = deriveKaiKlokMoment({ occurredAt: "2024-05-10T06:45:41.888Z", authority: "admitted" });
  const oneMillisecondLater = deriveKaiKlokMoment({ occurredAt: "2024-05-10T06:45:41.889Z", authority: "admitted" });
  const sameAgain = deriveKaiKlokMoment({ occurredAt: "2024-05-10T06:45:41.889Z", authority: "admitted" });

  assert.equal(atGenesis.uPulse, 0);
  assert.equal(oneMillisecondLater.uPulse, 191);
  assert.ok(oneMillisecondLater.uPulse > atGenesis.uPulse);
  assert.equal(oneMillisecondLater.pulse, atGenesis.pulse);
  assert.deepEqual(oneMillisecondLater, sameAgain);
  assert.ok(Number.isSafeInteger(oneMillisecondLater.uPulse));
});

test("Kai day and Ark progress are exact normalized projections", () => {
  const samples = [
    "2024-05-10T06:45:41.888Z",
    "2026-07-16T22:00:00.000Z",
    "2030-01-01T00:00:00.000Z"
  ];
  for (const occurredAt of samples) {
    const moment = deriveKaiKlokMoment({ occurredAt, authority: "world" });
    assert.ok(moment.dayProgress >= 0 && moment.dayProgress < 1);
    assert.ok(moment.arkProgress >= 0 && moment.arkProgress < 1);
    assert.equal(moment.arkIndex, Math.floor(moment.dayProgress * 6));
  }
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

test("Kai command ticks align to the next Genesis-locked pulse boundary", () => {
  assert.equal(millisecondsUntilNextKaiPulse(KAI_GENESIS_TS), Math.ceil(KAI_PULSE_DURATION_MS));
  const nearBoundary = KAI_GENESIS_TS + Math.floor(KAI_PULSE_DURATION_MS) - 1;
  const nearDelay = millisecondsUntilNextKaiPulse(nearBoundary);
  assert.ok(nearDelay > 0 && nearDelay <= 3);
  const arbitraryDelay = millisecondsUntilNextKaiPulse(Date.parse("2026-07-17T11:44:03.650Z"));
  assert.ok(arbitraryDelay > 0 && arbitraryDelay <= Math.ceil(KAI_PULSE_DURATION_MS));
});

test("invalid or non-canonical timestamps fail closed", () => {
  assert.throws(() => deriveKaiKlokMoment({ occurredAt: "not-time", authority: "local" }), /wilds_kai_moment_time_invalid/);
  assert.throws(() => deriveKaiKlokMoment({ occurredAt: "2026-07-16T22:00:00Z", authority: "world" }), /wilds_kai_moment_time_invalid/);
});
