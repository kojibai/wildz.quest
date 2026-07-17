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
  assert.equal(first.geometrySides, moment.sides);
  assert.ok(first.atmosphericInfluence > 0 && first.atmosphericInfluence < 0.1);
});
