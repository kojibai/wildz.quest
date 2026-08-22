import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  deriveReceizSubjectIdV122,
  planReceizMultiWorldTransactionV122,
  planReceizReserveV122,
  planReceizSettlementV122,
  snapshotReceizArtifactInput,
  validateReceizSubjectAdmissionInputV122,
  validateReceizValueIntentV122,
  receizOidcScopesForRails
} from "@receiz/sdk";
import { createReceizCommerceAdapter } from "../src/lib/receiz/adapter";

describe("Wildz Receiz v123 rails", () => {
  it("exposes every exact V123 authority, namespace, world-planning, recovery, and Phi adapter rail", () => {
    const adapter = createReceizCommerceAdapter();
    for (const name of [
      "exchangeProofAuthorityV123", "admitSubjectV122", "resolveSubjectNamespacesV123",
      "planWorldCommandV122", "planWorldTransactionV122", "validateWorldTransactionV122", "executeWorldTransactionV122",
      "worldExecutionV122", "worldExecutionByIdempotencyKeyV122", "worldAdditionsV122",
      "planMultiWorldTransactionV122", "executeMultiWorldTransactionV122",
      "planPhiSettlementV123", "planPhiReserveV123", "validatePhiIntentV123",
      "executePhiSettlementV123", "executePhiReserveV123", "phiExecutionByIdempotencyKeyV123"
    ] as const) assert.equal(typeof adapter[name], "function", `${name} must be callable`);
    assert.deepEqual(receizOidcScopesForRails("settlement", "reserve"), [
      "receiz:settlement.read",
      "receiz:settlement.write",
      "receiz:reserve.read",
      "receiz:reserve.write"
    ]);
  });

  it("derives durable subject identity from exact proof bytes and snapshots admission input", async () => {
    const proofObject = new Blob(["wildz-v123-proof"], { type: "application/json" });
    const snapshot = await snapshotReceizArtifactInput(proofObject);
    const subjectId = await deriveReceizSubjectIdV122(snapshot.artifactDigest.value);
    const input = await validateReceizSubjectAdmissionInputV122({
      proofObject,
      ownerReceizId: "receiz:owner",
      idempotencyKey: `wildz:subject:${subjectId}`,
      expectedAbsent: true
    });
    assert.equal(input.ownerReceizId, "receiz:owner");
    assert.equal(input.idempotencyKey, `wildz:subject:${subjectId}`);
    assert.deepEqual(input.proofObject.exactBytes, snapshot.bytes);
  });

  it("keeps Settlement and Reserve explicit and Phi-denominated", async () => {
    const common = {
      amountPhiMicro: "2500000",
      sourceProofObjectId: "proof:phi",
      sourceValueHead: "a".repeat(64),
      destinationSubjectId: "subject:builder",
      expectedDestinationHead: "b".repeat(64),
      usdPerPhiMicrocents: "1250000",
      priceBasis: { source: "canonical-test", head: "c".repeat(64) }
    };
    const settlement = await planReceizSettlementV122(common);
    const reserve = await planReceizReserveV122(common);
    assert.equal(settlement.rail, "settlement");
    assert.equal(reserve.rail, "reserve");
    assert.equal(settlement.amountPhiMicro, common.amountPhiMicro);
    assert.equal("amountUsdCents" in settlement, false);
    assert.equal(await validateReceizValueIntentV122(settlement), true);
    assert.equal(await validateReceizValueIntentV122(reserve), true);
  });

  it("plans cross-region work as one sorted multi-world transaction", async () => {
    const transaction = (worldId: string, marker: string) => ({
      schema: "receiz.world.transaction.v122" as const,
      transactionId: marker.repeat(64),
      worldId,
      expectedWorldHead: "1".repeat(64),
      participantHeads: { "subject:builder": "2".repeat(64) },
      commands: [],
      registryDigest: "3".repeat(64),
      reducerDigest: "4".repeat(64),
      idempotencyKey: `wildz:${worldId}`,
      transactionDigest: marker.repeat(64)
    });
    const plan = await planReceizMultiWorldTransactionV122({
      worlds: [
        { worldId: "wildz:region:2", expectedWorldHead: "1".repeat(64), transaction: transaction("wildz:region:2", "b") },
        { worldId: "wildz:region:1", expectedWorldHead: "1".repeat(64), transaction: transaction("wildz:region:1", "a") }
      ],
      idempotencyKey: "wildz:cross-region:route"
    });
    assert.deepEqual(plan.worlds.map((world) => world.worldId), ["wildz:region:1", "wildz:region:2"]);
    assert.deepEqual(plan.participantSubjectIds, ["subject:builder"]);
  });
});
