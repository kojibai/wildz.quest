import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveWildsRuntimeKaiMoment } from "../src/features/play/wilds-kai-runtime";

const cursor = {
  pulse: "2024-05-10T06:45:00.000Z",
  kaiKlok: 4,
  eventId: "world:event:4",
  uPulse: 1_234_567_891,
  sequence: 4
};

test("live world visuals consume the exact admitted cursor uPulse", () => {
  const moment = resolveWildsRuntimeKaiMoment({
    mode: "receiz_live",
    observedAt: "2026-08-11T12:00:00.000Z",
    cursor
  });
  assert.equal(moment.authority, "world");
  assert.equal(moment.uPulse, cursor.uPulse);
});

test("a local clock is never relabeled as world authority", () => {
  const moment = resolveWildsRuntimeKaiMoment({
    mode: "offline",
    observedAt: "2026-08-11T12:00:00.000Z",
    cursor
  });
  assert.equal(moment.authority, "local");
  assert.notEqual(moment.uPulse, cursor.uPulse);
});
