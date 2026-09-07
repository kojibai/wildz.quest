import assert from "node:assert/strict";
import { test } from "node:test";
import { appendWildsActivity, ledgerKaiTime, normalizeWildsActivityHistory } from "../src/features/play/wallet/wilds-activity-history";
import { deriveKaiKlokMoment } from "../src/features/play/kai-klok-moment";
import { applyWildsInput, initialPlayState } from "../src/features/play/game-state";
test("ledger derives one Kai coordinate from either historical timestamp or pulse", () => {
  const occurredAt = "2026-09-07T12:00:00.000Z";
  const moment = deriveKaiKlokMoment({ occurredAt, authority: "admitted" });
  assert.deepEqual(ledgerKaiTime({ occurredAt }), ledgerKaiTime({ uPulse: moment.uPulse }));
  assert.match(ledgerKaiTime({ occurredAt }).timing, /^Kai Klok \d+:\d+:\d+$/);
  assert.equal(ledgerKaiTime({}).uPulse, null);
});
test("local admission is immediate, deduplicated, and survives serialized history", () => {
  const activity = { id: "event:one", kind: "activity" as const, title: "construction component placed", detail: "Admitted", uPulse: 100, authority: "world" as const };
  const next = applyWildsInput(initialPlayState, { type: "record-world-activity", activity });
  assert.equal(next.actionHistory.at(-1)?.id, activity.id);
  assert.deepEqual(normalizeWildsActivityHistory(JSON.parse(JSON.stringify(next.actionHistory))), next.actionHistory);
  assert.equal(appendWildsActivity(next.actionHistory, activity).length, next.actionHistory.length);
  assert.deepEqual(normalizeWildsActivityHistory([null, { id: "bad" }]), []);
});
test("repeated gameplay actions with identical feedback each appear immediately", () => {
  const first=applyWildsInput(initialPlayState,{type:"rest",kaiUPulse:100});
  const second=applyWildsInput(first,{type:"rest",kaiUPulse:101});
  assert.equal(second.lastEvent,first.lastEvent);
  assert.equal(second.actionHistory.length,first.actionHistory.length+1);
  assert.equal(second.actionHistory.at(-1)?.uPulse,101);
});
