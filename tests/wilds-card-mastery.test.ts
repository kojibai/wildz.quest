import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  issueBossArtifact,
  artifactDigest,
  type BossArtifact
} from "../src/features/play/wilds-card-mastery.js";
import { craftRecipe, recipeFor, type CraftInventory } from "../src/features/play/wilds-crafting.js";
import { lineageUtility, lineagePath } from "../src/features/play/wilds-lineage-utility.js";
import {
  appendPortableRecord,
  reconcilePortableRecords,
  type PortableReconciliationRecord
} from "../src/features/play/wilds-portable-reconciliation.js";

describe("Slice 6 card mastery civilization", () => {
  it("issues the same boss artifact for the same canonical reward event", () => {
    const input = { bossId: "boss:ember-wyrm", victoryEventId: "evt:raid-42", ownerReceizId: "rz:alice", issuedAt: "2026-07-15T00:00:00.000Z", rewardIndex: 0 } as const;
    const first = issueBossArtifact(input);
    const second = issueBossArtifact(input);
    assert.deepEqual(first, second);
    assert.match(first.id, /^artifact:/);
    assert.equal(first.proof.digest, artifactDigest(first));
  });

  it("crafts deterministically and never mutates the caller inventory", () => {
    const recipe = recipeFor("ember-sigil");
    const inventory: CraftInventory = { ember_shard: 3, boss_essence: 1 };
    const result = craftRecipe({ recipe, inventory, ownerReceizId: "rz:alice", craftEventId: "evt:craft-1", craftedAt: "2026-07-15T00:00:00.000Z" });
    assert.deepEqual(inventory, { ember_shard: 3, boss_essence: 1 });
    assert.equal(result.consumed.ember_shard, 2);
    assert.equal(result.output.kind, "ember-sigil");
    assert.throws(() => craftRecipe({ recipe, inventory: { ember_shard: 1, boss_essence: 1 }, ownerReceizId: "rz:alice", craftEventId: "evt:craft-2", craftedAt: "2026-07-15T00:00:00.000Z" }), /insufficient_materials/);
  });

  it("returns a stable lineage path and utility score", () => {
    const lineage = { rootAssetId: "root", rootDigest: "sha256:root", previousAssetId: "parent", previousDigest: "sha256:parent", evolvedAt: "2026-07-15T00:00:00.000Z", parentAssetIds: ["a", "b"] as [string, string], parentDigests: ["sha256:a", "sha256:b"] as [string, string] };
    assert.deepEqual(lineagePath(lineage), ["root", "parent"]);
    assert.equal(lineageUtility(lineage), 4);
  });

  it("deduplicates portable records and rejects conflicting event payloads", () => {
    const record: PortableReconciliationRecord = { eventId: "evt:1", sequence: 2, kind: "craft", payload: { outputId: "artifact:1" }, digest: "sha256:a" };
    const appended = appendPortableRecord([], record);
    assert.deepEqual(appendPortableRecord(appended, record), appended);
    assert.throws(() => appendPortableRecord(appended, { ...record, digest: "sha256:b" }), /reconciliation_conflict/);
    assert.deepEqual(reconcilePortableRecords([record], [{ ...record, sequence: 1 }, { eventId: "evt:2", sequence: 3, kind: "artifact", payload: {}, digest: "sha256:c" }]).map((item) => item.eventId), ["evt:1", "evt:2"]);
  });
});
