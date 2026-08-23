import assert from "node:assert/strict";
import { test } from "node:test";
import { deriveKaiKlokMoment } from "../src/features/play/kai-klok-moment";
import { receizKaiNow } from "@receiz/sdk";
import { createWildsKaiRuntimeClock, observeWildsKaiPulse, resolveWildsRuntimeKaiMoment } from "../src/features/play/wilds-kai-runtime";

test("wallet authority observes the canonical V124 Receiz Kai pulse", () => {
  const before = receizKaiNow().pulse;
  const observed = observeWildsKaiPulse();
  const after = receizKaiNow().pulse;
  assert.ok(observed >= before && observed <= after);
});

const cursor = {
  pulse: "2024-05-10T06:45:00.000Z",
  kaiKlok: 4,
  eventId: "world:event:4",
  uPulse: 1_234_567_891,
  sequence: 4
};

test("a monotonic Kai runtime advances from its exact uPulse baseline without rewinding", () => {
  const clock = createWildsKaiRuntimeClock({ baselineUPulse: 1_000_000, baselineElapsedMs: 100 });

  assert.equal(clock.read(100), 1_000_000);
  assert.ok(clock.read(5_337) >= 2_000_000);
  const advanced = clock.read(10_572, 3_500_000);
  assert.equal(advanced, 3_500_000);
  assert.equal(clock.read(10_000, 2_000_000), advanced);
});

test("live world visuals use runtime uPulse rather than a stale event cursor", () => {
  const uPulse = deriveKaiKlokMoment({ occurredAt: "2026-08-11T12:00:00.000Z", authority: "world" }).uPulse;
  const moment = resolveWildsRuntimeKaiMoment({
    mode: "receiz_live",
    uPulse,
    cursor
  });

  assert.equal(moment.authority, "world");
  assert.equal(moment.uPulse, uPulse);
  assert.notEqual(moment.uPulse, cursor.uPulse);
});

test("a local clock is never relabeled as world authority", () => {
  const moment = resolveWildsRuntimeKaiMoment({
    mode: "offline",
    uPulse: 4_321_000_000,
    cursor
  });
  assert.equal(moment.authority, "local");
  assert.equal(moment.uPulse, 4_321_000_000);
  assert.notEqual(moment.uPulse, cursor.uPulse);
});
