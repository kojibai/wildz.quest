import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { compileWildsLivingOperation } from "../src/features/play/wilds-living-operation.js";
import {
  createWildsGroveResourceLot,
  verifyWildsResourceLot
} from "../src/features/play/wilds-resource-lot.js";

const digest = (character: string) => character.repeat(64);

function operation(kind = "grove.harvest-honey") {
  return compileWildsLivingOperation({
    operationId: `grove:one:${kind.split(".").at(-1)}:1000000`,
    category: "ecology",
    intention: { kind, regionId: "region:0:0", featureId: "grove:one" },
    participants: [
      { id: "explorer", kind: "player", expectedHead: digest("a"), role: "steward" },
      { id: "creature:bee", kind: "creature", expectedHead: digest("b"), role: "harvest-honey" },
      { id: "grove:one", kind: "world", expectedHead: digest("c"), role: "living-grove" }
    ],
    stages: [{ id: "stage:harvest-honey", profession: "harvest-honey", participantIds: ["explorer", "creature:bee"] }],
    consequences: {
      usefulOutput: 2, ecologicalRenewal: 0, publicBenefit: 0, cooperation: 0, durability: 0,
      extraction: 0, damage: 0, waste: 0, restorationDebt: 0
    },
    kaiUPulse: 1_000_000,
    expiresAtKaiUPulse: 2_000_000,
    semanticIdempotencyKey: `wildz:grove:one:${kind.split(".").at(-1)}:1000000`
  });
}

function input(kind = "grove.harvest-honey") {
  return {
    operation: operation(kind),
    ownerReceizId: "explorer",
    sourceGrove: { groveId: "grove:one", head: `sha256:${digest("c")}`, honey: 2 },
    admittedGrove: { groveId: "grove:one", head: `sha256:${digest("d")}`, parentHead: `sha256:${digest("c")}`, honey: 1 }
  } as const;
}

describe("exact Grove resource lots", () => {
  it("creates one deterministic player-owned Living Honey lot from the exact admitted harvest", () => {
    const first = createWildsGroveResourceLot(input());
    const second = createWildsGroveResourceLot(structuredClone(input()));

    assert.deepEqual(second, first);
    assert.ok(first);
    assert.equal(first.schema, "wildz.resource-lot.v1");
    assert.equal(first.kind, "living-honey");
    assert.equal(first.quantity, 1);
    assert.equal(first.ownerReceizId, "explorer");
    assert.equal(first.source.operationId, input().operation.operationId);
    assert.equal(first.source.groveSourceHead, `sha256:${digest("c")}`);
    assert.equal(first.source.groveAdmittedHead, `sha256:${digest("d")}`);
    assert.match(first.lotId, /^wildz:resource:living-honey:[a-f0-9]{64}$/);
    assert.match(first.head, /^sha256:[a-f0-9]{64}$/);
    assert.equal(first.authority, "source-proof-objects");
    assert.equal(first.transferable, true);
    assert.equal(verifyWildsResourceLot(first), true);
    assert.equal(Object.isFrozen(first), true);
  });

  it("does not create personal custody for intermediate Grove work", () => {
    assert.equal(createWildsGroveResourceLot(input("grove.pollinate")), null);
  });

  it("rejects a caller that cannot prove exact source consumption and ownership", () => {
    assert.throws(() => createWildsGroveResourceLot({ ...input(), ownerReceizId: "stranger" }), /wilds_resource_lot_owner_invalid/);
    assert.throws(() => createWildsGroveResourceLot({ ...input(), admittedGrove: { ...input().admittedGrove, honey: 2 } }), /wilds_resource_lot_conservation_invalid/);
    assert.throws(() => createWildsGroveResourceLot({ ...input(), admittedGrove: { ...input().admittedGrove, parentHead: `sha256:${digest("e")}` } }), /wilds_resource_lot_source_invalid/);
  });

  it("detects any mutation of the admitted lot", () => {
    const lot = createWildsGroveResourceLot(input());
    assert.ok(lot);
    assert.equal(verifyWildsResourceLot({ ...lot, quantity: 2 }), false);
    assert.equal(verifyWildsResourceLot({ ...lot, ownerReceizId: "stranger" }), false);
    assert.equal(verifyWildsResourceLot({ ...lot, head: `sha256:${digest("f")}` }), false);
  });
});
