import assert from "node:assert/strict";
import test from "node:test";
import { createArenaCausalEvent, mergeArenaCausalBranches, type ArenaCausalEventInput } from "../src/features/play/arena/offline-ledger.js";

const digest = (char: string) => `sha256:${char.repeat(64)}`;
const base = { ownerId: "player-1", resources: { shard: 5 }, cardHeadDigests: { wolf: digest("a") } };
function event(overrides: Partial<ArenaCausalEventInput> = {}) {
  return createArenaCausalEvent({
    id: `event-${Math.random()}`,
    assetId: "wolf",
    parentDigest: base.cardHeadDigests.wolf!,
    occurredAt: "2026-07-16T12:00:00.000Z",
    ownerId: "player-1",
    kind: "progress",
    xp: { arena: 10 },
    historyIds: [], rewardIds: [], resourceDelta: {}, injuryIds: [],
    ...overrides,
  });
}

test("causal branches combine compatible XP/history and deduplicate rewards deterministically", () => {
  const left = event({ id: "left", historyIds: ["found-cave"], rewardIds: ["reward-1"], resourceDelta: { shard: 2 } });
  const right = event({ id: "right", historyIds: ["met-rival"], rewardIds: ["reward-1"], xp: { arena: 7 } });
  const first = mergeArenaCausalBranches({ base, branches: [[left], [right]] });
  const reversed = mergeArenaCausalBranches({ base, branches: [[right], [left]] });
  assert.deepEqual(first, reversed);
  assert.equal(first.xp.wolf?.arena, 17);
  assert.deepEqual(first.historyIds, ["found-cave", "met-rival"]);
  assert.deepEqual(first.rewardIds, ["reward-1"]);
  assert.equal(first.resources.shard, 7);
});

test("children are admitted after their named parent even when branches arrive out of order", () => {
  const parent = event({ id: "parent", xp: { arena: 3 } });
  const child = event({ id: "child", parentDigest: parent.digest, occurredAt: "2026-07-16T12:00:01.000Z", xp: { arena: 6 } });
  const result = mergeArenaCausalBranches({ base, branches: [[child], [parent]] });
  assert.equal(result.xp.wolf?.arena, 9);
  assert.deepEqual(result.rejected, []);
  assert.deepEqual(result.cardHeadDigests.wolf, [child.digest]);
});

test("valid injury and spend accumulate while insufficient resources remain inspectable", () => {
  const spend = event({ id: "spend", resourceDelta: { shard: -4 }, injuryIds: ["injury-1"] });
  const overspend = event({ id: "overspend", occurredAt: "2026-07-16T12:00:01.000Z", resourceDelta: { shard: -3 }, injuryIds: ["injury-2"] });
  const result = mergeArenaCausalBranches({ base, branches: [[spend], [overspend]] });
  assert.equal(result.resources.shard, 1);
  assert.deepEqual(result.injuryIds.wolf, ["injury-1"]);
  assert.deepEqual(result.rejected.map((item) => [item.eventId, item.reason]), [["overspend", "insufficient_resource"]]);
});

test("canonical retirement dominates stale living activity from an older branch", () => {
  const retirement = event({ id: "death", kind: "retirement", occurredAt: "2026-07-16T12:00:01.000Z" });
  const stale = event({ id: "stale", occurredAt: "2026-07-16T12:00:02.000Z", xp: { arena: 99 } });
  const earlier = event({ id: "earlier", occurredAt: "2026-07-16T11:59:59.000Z", xp: { arena: 4 } });
  const result = mergeArenaCausalBranches({ base, branches: [[retirement], [stale], [earlier]] });
  assert.deepEqual(result.retiredAssetIds, ["wolf"]);
  assert.equal(result.xp.wolf?.arena, 4);
  assert.equal(result.rejected.find((item) => item.eventId === "stale")?.reason, "stale_living_after_retirement");
});

test("ownership contradictions fail closed and broken causal parents are inspectable", () => {
  const saleA = event({ id: "sale-a", kind: "ownership", ownershipTo: "player-2" });
  const saleB = event({ id: "sale-b", kind: "ownership", ownershipTo: "player-3" });
  const orphan = event({ id: "orphan", parentDigest: digest("f") });
  const result = mergeArenaCausalBranches({ base, branches: [[saleA], [saleB], [orphan]] });
  assert.equal(result.ownership.wolf, "player-1");
  assert.deepEqual(result.rejected.map((item) => item.reason).sort(), ["causal_parent_missing", "ownership_conflict", "ownership_conflict"]);
});
