import assert from "node:assert/strict";
import test from "node:test";
import type { WildsProjectedCapabilityControl } from "../src/features/play/wilds-world-capability-controls";
import {
  projectWildsCapabilityContext,
  type WildsCapabilityCandidate,
  type WildsCapabilityContextInput
} from "../src/features/play/wilds-world-capability-context";

function control(family: WildsProjectedCapabilityControl["family"], runtimeAvailable = true): WildsProjectedCapabilityControl {
  return Object.freeze({
    assetId: "asset:context",
    family,
    label: family,
    action: `${family} action`,
    icon: family === "lumber" ? "timber" : family,
    unlockLevel: 1,
    capacity: runtimeAvailable ? 88 : 0,
    currentPower: 64,
    runtimeAvailable
  });
}

function candidate(id: string, family: WildsCapabilityCandidate["family"], urgency: number, distance: number): WildsCapabilityCandidate {
  return Object.freeze({ id, family, eligible: true, urgency, distance, expectedHead: `head:${id}` });
}

function input(overrides: Partial<WildsCapabilityContextInput> = {}): WildsCapabilityContextInput {
  return Object.freeze({
    controls: Object.freeze([control("rescue")]),
    candidates: Object.freeze([]),
    activeFamilies: Object.freeze([]),
    ...overrides
  });
}

test("targets order deterministically by urgency, distance, then stable id", () => {
  const projected = projectWildsCapabilityContext(input({
    candidates: Object.freeze([
      candidate("far", "rescue", 4, 9),
      candidate("near-b", "rescue", 4, 2),
      candidate("near-a", "rescue", 4, 2),
      candidate("urgent", "rescue", 9, 8)
    ])
  })).get("rescue")!;

  assert.deepEqual(projected.candidateIds, ["urgent", "near-a", "near-b", "far"]);
  assert.equal(projected.primaryTargetId, "urgent");
  assert.equal(projected.state, "awakened");
  assert.equal(projected.intent.kind, "execute");
});

test("caps warmed candidates per family without changing deterministic order", () => {
  const candidates = Array.from({ length: 14 }, (_, index) => candidate(`trace:${String(index).padStart(2, "0")}`, "track", 1, index));
  const projected = projectWildsCapabilityContext(input({ controls: Object.freeze([control("track")]), candidates: Object.freeze(candidates) })).get("track")!;

  assert.equal(projected.candidateIds.length, 8);
  assert.deepEqual(projected.candidateIds, candidates.slice(0, 8).map((entry) => entry.id));
});

test("projects guidance, ready, active, and recovering without mutating inputs", () => {
  const track = projectWildsCapabilityContext(input({ controls: Object.freeze([control("track")]) })).get("track")!;
  const light = projectWildsCapabilityContext(input({ controls: Object.freeze([control("light")]) })).get("light")!;
  const activeLight = projectWildsCapabilityContext(input({ controls: Object.freeze([control("light")]), activeFamilies: Object.freeze(["light"]) })).get("light")!;
  const recovering = projectWildsCapabilityContext(input({ controls: Object.freeze([control("flight", false)]) })).get("flight")!;

  assert.equal(track.state, "guidance");
  assert.equal(track.intent.kind, "highlight-route");
  assert.equal(light.state, "ready");
  assert.equal(light.intent.kind, "toggle");
  assert.equal(activeLight.state, "active");
  assert.equal(activeLight.intent.kind, "toggle");
  assert.equal(recovering.state, "recovering");
  assert.equal(recovering.intent.kind, "explain-recovery");
});

test("reuses the exact immutable projection for an unchanged warmed input", () => {
  const warmed = input({ controls: Object.freeze([control("track")]), candidates: Object.freeze([candidate("trace:1", "track", 2, 1)]) });
  const first = projectWildsCapabilityContext(warmed);
  const second = projectWildsCapabilityContext(warmed);

  assert.equal(first, second);
  assert.equal(Object.isFrozen(first.get("track")), true);
  assert.equal(Object.isFrozen(first.get("track")!.candidateIds), true);
});

