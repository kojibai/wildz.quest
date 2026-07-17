import assert from "node:assert/strict";
import test from "node:test";
import { kaiTransition, type KaiWorldExpression } from "../src/features/play/kai-moment-expression";

const key = (day: string, beat: string, ark: string): KaiWorldExpression["transitionKey"] => ({ day, beat, ark });

test("Kai transition acknowledges only real beat and Ark changes", () => {
  const current = key("1", "1:2", "1:0");
  assert.equal(kaiTransition(null, current), null);
  assert.equal(kaiTransition(current, current), null);
  assert.equal(kaiTransition(current, key("1", "1:3", "1:0")), "beat");
  assert.equal(kaiTransition(current, key("1", "1:3", "1:1")), "ark");
  assert.equal(kaiTransition(current, key("2", "2:0", "2:0")), "ark");
});
