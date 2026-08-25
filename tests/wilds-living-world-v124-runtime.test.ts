import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { compileWildsLivingOperation } from "../src/features/play/wilds-living-operation";
import { executeWildsLivingWorldV124 } from "../src/lib/receiz/wilds-living-world-v124-runtime";

const H = (value: string) => value.repeat(64);
const operation = compileWildsLivingOperation({
  operationId: "grove:pollinate:runtime",
  category: "ecology",
  intention: { kind: "grove.pollinate", regionId: "region:0:0", featureId: "grove:one" },
  participants: [
    { id: "player:one", kind: "player", expectedHead: H("1"), role: "steward" },
    { id: "creature:bee", kind: "creature", expectedHead: H("2"), role: "pollinator" },
    { id: "grove:one", kind: "world", expectedHead: H("3"), role: "living-grove" }
  ],
  stages: [{ id: "stage:pollinate", profession: "pollinate", participantIds: ["player:one", "creature:bee"] }],
  consequences: { usefulOutput: 2, ecologicalRenewal: 5, publicBenefit: 1, cooperation: 2, durability: 1, extraction: 0, damage: 0, waste: 0, restorationDebt: 0 },
  kaiUPulse: 1_000_000,
  expiresAtKaiUPulse: 2_000_000,
  semanticIdempotencyKey: "wildz:grove:pollinate:runtime"
});

const heads = {
  world: { id: "wilds:global:v3", current: H("3"), next: H("4") },
  emission: { id: "world-emission:one", current: H("5"), next: H("6"), sourceProofObjectId: "proof:world-emission" },
  player: { id: "player:one", current: H("1"), next: H("7") },
  creature: { id: "creature:bee", current: H("2"), next: H("8") },
  inventory: { id: "inventory:player:one", current: H("9"), next: H("a") }
} as const;

function fixture(status: "committed" | "zero-write" | "unknown" = "committed") {
  let staged: Record<string, unknown> | null = null;
  let resolutions = 0;
  const committedHeads = Object.fromEntries(Object.values(heads).map((entry) => [entry.id, entry.next]));
  const rail = {
    openAuthoritySessionV124: async () => ({ authoritySessionHandle: "session:one" }),
    closeAuthoritySessionV124: async () => ({ status: "closed" }),
    stageExecutionV124: async (plan: Record<string, unknown>) => {
      staged = plan;
      return { executionId: "execution:one", exactPlanDigest: plan.exactPlanDigest, semanticIdempotencyKey: operation.semanticIdempotencyKey };
    },
    executeV124: async (handle: Record<string, unknown>) => status === "committed"
      ? { status: "committed", exactPlanDigest: handle.exactPlanDigest, semanticIdempotencyKey: handle.semanticIdempotencyKey, committedHeads }
      : status === "zero-write"
        ? { status: "zero-write", reasonCode: "STALE_HEAD", writes: 0 }
        : { status: "unknown", exactPlanDigest: handle.exactPlanDigest, semanticIdempotencyKey: handle.semanticIdempotencyKey },
    resolveExecutionByIdempotencyV124: async () => {
      resolutions += 1;
      return { status: "committed", exactPlanDigest: staged?.exactPlanDigest, semanticIdempotencyKey: operation.semanticIdempotencyKey, committedHeads };
    }
  };
  return { rail, committedHeads, metrics: () => ({ staged, resolutions }) };
}

const input = (rail: ReturnType<typeof fixture>["rail"], amountPhiMicro = "110000") => ({
  rail,
  authoritySessionInput: { completeReceizProofAuthority: true },
  operation,
  heads,
  amountPhiMicro,
  registryDigest: H("b"),
  reducerDigest: H("c"),
  usdPerPhiMicrocents: "1000000",
  priceBasis: { schema: "wildz.world-emission-price.v1", lawfulAward: true },
  attemptId: "attempt:grove:one"
});

describe("Receiz V124 living-world atomic runtime", () => {
  it("stages world, subject, inventory, and settlement together and admits exact committed heads", async () => {
    const state = fixture();
    const result = await executeWildsLivingWorldV124(input(state.rail));
    assert.equal(result.status, "committed");
    const plan = state.metrics().staged as { exactPlanBytesB64u?: string };
    const exact = JSON.parse(Buffer.from(String(plan.exactPlanBytesB64u), "base64url").toString("utf8"));
    assert.deepEqual(exact.operations.map((item: { category: string }) => item.category), ["inventory", "settlement", "subject", "world"]);
  });

  it("omits settlement for zero-Phi useful work", async () => {
    const state = fixture();
    await executeWildsLivingWorldV124(input(state.rail, "0"));
    const plan = state.metrics().staged as { exactPlanBytesB64u?: string };
    const exact = JSON.parse(Buffer.from(String(plan.exactPlanBytesB64u), "base64url").toString("utf8"));
    assert.deepEqual(exact.operations.map((item: { category: string }) => item.category), ["inventory", "subject", "world"]);
  });

  it("returns SDK zero-write unchanged and resolves ambiguous execution before success", async () => {
    const zero = fixture("zero-write");
    assert.deepEqual(await executeWildsLivingWorldV124(input(zero.rail)), { status: "zero-write", reasonCode: "STALE_HEAD", writes: 0 });
    const unknown = fixture("unknown");
    assert.equal((await executeWildsLivingWorldV124(input(unknown.rail))).status, "committed");
    assert.equal(unknown.metrics().resolutions, 1);
  });

  it("rejects a committed receipt whose participant heads do not match the source successors", async () => {
    const state = fixture();
    state.rail.executeV124 = async (handle: Record<string, unknown>) => ({
      status: "committed", exactPlanDigest: handle.exactPlanDigest,
      semanticIdempotencyKey: handle.semanticIdempotencyKey,
      committedHeads: { ...state.committedHeads, "player:one": H("f") }
    });
    await assert.rejects(() => executeWildsLivingWorldV124(input(state.rail)), /committed_heads_mismatch/);
  });
});
