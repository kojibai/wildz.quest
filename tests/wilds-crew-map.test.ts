import assert from "node:assert/strict";
import { test } from "node:test";
import { projectWildsCrewMap, projectWildsCrewMinimapPoint, type WildsCrewMapSource } from "../src/features/play/wilds-crew-map";
import type { PortableCardAsset } from "../src/features/play/portable-card";
import type { WildsCrewExpedition } from "../src/features/play/wilds-crew-expedition";

function source(count = 5): WildsCrewMapSource {
  const cards = Array.from({ length: count }, (_, index) => ({ id: `card-${index}`, proof: { digest: `proof-${index}` }, manifest: { name: `Creature ${index}`, ownerReceizId: "owner" } } as PortableCardAsset));
  return { owner: "owner", cards, runtime: new Map(), expeditions: new Map(cards.map(card => [card.id, {
    assetId: card.id, proofDigest: card.proof.digest, ownerReceizId: "owner", phase: "outbound", recallRequested: false,
    actualPosition: { x: 10, y: 0, z: 20 }, actualSpaceId: "wildz.space.outer.v1", goal: { x: 900, y: 0, z: 900 }
  } as WildsCrewExpedition])) };
}
function row(input: WildsCrewMapSource, index: number, patch: Partial<WildsCrewExpedition>) {
  const key = `card-${index}`;
  (input.expeditions as Map<string, WildsCrewExpedition>).set(key, { ...input.expeditions.get(key)!, ...patch });
}
test("map includes every owned active expedition, beyond companion slots, at actual coordinates", () => {
  const markers = projectWildsCrewMap(source());
  assert.equal(markers.length, 5);
  assert.ok(markers.every(marker => marker.status === "Roaming" && marker.position.x === 10));
});
test("map uses matching live physical positions and preserves recall and blocked status", () => {
  const input = source(2);
  row(input, 0, { phase: "returning", recallRequested: true });
  row(input, 1, { phase: "blocked", recallRequested: true });
  input.runtime = new Map([["card-0", { proofDigest: "proof-0", spaceId: "wildz.space.outer.v1", position: { x: 4, y: 2, z: 8 }, target: { x: 50, y: 0, z: 50 }, paused: false, blocked: false }]]);
  const markers = projectWildsCrewMap(input);
  assert.deepEqual(markers[0].position, { x: 4, z: 8 });
  assert.equal(markers[0].status, "Returning");
  assert.equal(markers[1].status, "Return blocked");
});
test("map excludes foreign, stale proof, completed, interior, and unknown physical positions", () => {
  const input = source(5);
  row(input, 0, { ownerReceizId: "someone-else" });
  row(input, 1, { proofDigest: "superseded" });
  row(input, 2, { phase: "completed" });
  row(input, 3, { actualSpaceId: "interior" });
  row(input, 4, { actualPosition: null });
  assert.deepEqual(projectWildsCrewMap(input), []);
});
test("minimap keeps distant creatures at the rim and nearby coordinates at existing scale", () => {
  assert.deepEqual(projectWildsCrewMinimapPoint({ x: 11, z: 0 }, { x: 0, z: 0 }), { x: 135, y: 90, distant: false });
  const point = projectWildsCrewMinimapPoint({ x: -1000, z: -1000 }, { x: 0, z: 0 });
  assert.equal(point.distant, true);
  assert.ok(Math.abs(Math.hypot(point.x - 90, point.y - 90) - 82) < .0001);
});
