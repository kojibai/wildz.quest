import assert from "node:assert/strict";
import { test } from "node:test";
import { createOwnerBoundInitialPlayState } from "../src/features/play/game-state";
import { prepareWildsCrewDisposition, chooseWildsCrewWork, readWildsCrewCondition } from "../src/features/play/wilds-crew-policy";
import { projectWildsResourceRegion } from "../src/features/play/wilds-resource-authority";

const state = createOwnerBoundInitialPlayState("crew_policy", "2026-09-12T12:00:00.000Z");
const card = state.inventory[0]!;
const disposition = prepareWildsCrewDisposition(card)!;
const condition = readWildsCrewCondition(card, state.adventureConditions)!;
const sources = projectWildsResourceRegion(0, 0);
const source = sources.find(s => disposition.workFamilies.includes(s.requirements.creature))!;
const input = () => ({ disposition, currentProofDigest: card.proof.digest, condition,
  position: source.position, opportunities: [{ source, sourceHead: "a".repeat(64), availableCapacity: 1, risk: 0, reachable: true }],
  reservedSourceIds: new Set<string>(), recentSourceIds: new Set<string>(), kaiUPulse: 100 });

test("canonical creature policy is deterministic and proposes only its current work family", () => {
  assert.ok(disposition); assert.ok(source);
  assert.ok(Number.isSafeInteger(disposition.preferenceSeed));
  assert.ok(prepareWildsCrewDisposition(state.inventory[0]));
  assert.equal(readWildsCrewCondition(state.inventory[0], {})?.life, "alive");
  assert.deepEqual(prepareWildsCrewDisposition(card), disposition);
  const choice = chooseWildsCrewWork(input());
  assert.equal(choice.kind, "gather"); assert.equal(choice.authority, "proposal-only");
  if (choice.kind === "gather") { assert.equal(choice.sourceId, source.sourceId); assert.equal(choice.quantity, 1); }
  assert.equal(chooseWildsCrewWork({ ...input(), requestedFamily: "excavate" }).kind, "wait");
});
test("policy respects rest, current proof, unavailable, hazardous and contested sources", () => {
  assert.equal(chooseWildsCrewWork({ ...input(), condition: { ...condition, fatigue: 90 } }).kind, "rest");
  assert.equal(chooseWildsCrewWork({ ...input(), currentProofDigest: "changed" }).kind, "wait");
  for (const change of [{ availableCapacity: 0 }, { risk: 100 }, { reachable: false }, { sourceHead: "unverified" }])
    assert.equal(chooseWildsCrewWork({ ...input(), opportunities: [{ ...input().opportunities[0], ...change }] }).kind, "wait");
  assert.equal(chooseWildsCrewWork({ ...input(), reservedSourceIds: new Set([source.sourceId]) }).kind, "wait");
  assert.equal(chooseWildsCrewWork({ ...input(), position: { x: source.position.x + 100, z: source.position.z } }).kind, "wait");
});
