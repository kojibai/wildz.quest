import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyAdventureCondition } from "../src/features/play/adventure/card-condition";
import { stepMarketRuntime, type MarketInput, type MarketRuntimeState } from "../src/features/play/market/runtime";
import { marketTranscript } from "../src/features/play/market/transcript";
import { sealMarketReceipt, verifyMarketReceipt } from "../src/features/play/market/receipt";
import { marketRuntimeFixture } from "./support/market-fixtures";

type InputIntent = MarketInput extends infer Value ? Value extends MarketInput ? Omit<Value, "sequence" | "tick"> : never : never;

function apply(state: MarketRuntimeState, input: InputIntent, contract: ReturnType<typeof marketRuntimeFixture>["contract"]) {
  return stepMarketRuntime(state, { ...input, sequence: state.sequence + 1, tick: state.tick + 1 } as MarketInput, contract);
}

function receiptFixture() {
  const fixture = marketRuntimeFixture();
  let state = fixture.state;
  const cargo = fixture.contract.intelligence.find((node) => node.kind === "cargo")!;
  while (Math.hypot(state.player.x - cargo.position.x, state.player.z - cargo.position.z) > 1) {
    state = apply(state, { kind: "move", vector: { x: Math.sign(cargo.position.x - state.player.x), z: Math.sign(cargo.position.z - state.player.z) } }, fixture.contract);
  }
  state = apply(state, { kind: "inspect", targetId: cargo.id }, fixture.contract);
  state = apply(state, { kind: "negotiate", action: { kind: "commit" } }, fixture.contract);
  state = apply(state, { kind: "extract" }, fixture.contract);
  const priorConditions = Object.fromEntries(fixture.squad.map((card) => [card.assetId, emptyAdventureCondition(card.assetId)]));
  return { ...fixture, state, priorConditions, transcript: marketTranscript(state) };
}

describe("Wayfarer receipt", () => {
  it("round-trips a complete replay-verifiable receipt", () => {
    const fixture = receiptFixture();
    const receipt = sealMarketReceipt({
      contract: fixture.contract,
      terms: fixture.terms,
      transcript: fixture.transcript,
      squad: fixture.squad,
      priorConditions: fixture.priorConditions,
      mortalConsent: null,
      actorId: "market.player",
      publicationRevision: 1,
      createdAt: "2026-07-16T23:10:00.000Z",
    });
    assert.deepEqual(verifyMarketReceipt(receipt, fixture.squad), { ok: true, errors: [] });
  });

  it("rejects changed actor, transcript, conditions, consequences, and digest", () => {
    const fixture = receiptFixture();
    const receipt = sealMarketReceipt({
      contract: fixture.contract, terms: fixture.terms, transcript: fixture.transcript, squad: fixture.squad,
      priorConditions: fixture.priorConditions, mortalConsent: null, actorId: "market.player", publicationRevision: 1,
      createdAt: "2026-07-16T23:10:00.000Z",
    });
    const changed = [
      { ...receipt, actorId: "intruder" },
      { ...receipt, transcript: { ...receipt.transcript, digest: `sha256:${"1".repeat(64)}` } },
      { ...receipt, priorConditions: { ...receipt.priorConditions, [fixture.squad[0].assetId]: { ...fixture.priorConditions[fixture.squad[0].assetId]!, fatigue: 1 } } },
      { ...receipt, consequences: { ...receipt.consequences, reputationDelta: receipt.consequences.reputationDelta + 1 } },
      { ...receipt, digest: `sha256:${"2".repeat(64)}` },
    ];
    for (const value of changed) assert.equal(verifyMarketReceipt(value, fixture.squad).ok, false);
  });
});
