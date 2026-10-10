import assert from "node:assert/strict";
import test from "node:test";
import { createWildsWalletTradeAgreement, createWildsWalletTradeDraft } from "../src/features/play/wallet/wilds-wallet-trade";
import { createWildsWalletStagedTradeController } from "../src/features/play/wallet/wilds-wallet-staged-trade-controller";
import { admitWildsWalletStagedTradeSourceHeads, createWildsWalletStagedTradePlan, wildsWalletStagedTradeApprovalChallenge } from "../src/features/play/wallet/wilds-wallet-staged-trade-types";
import type { WildsWalletStagedTradeApproval, WildsWalletStagedTradePorts, WildsWalletStagedTradeLegOutcome } from "../src/features/play/wallet/wilds-wallet-staged-trade-types";

function agreement() {
  const draft = (sender: string, recipient: string, amount: string, asset: string) => createWildsWalletTradeDraft({ attemptId: `trade:${sender}`, recipient, selfHandle: sender, phiMicro: amount, requestedPhiMicro: "0", requestNote: "Staged exchange", selections: [{ selection: { id: asset, label: asset, quantity: 1, asset: { kind: "creature", assetId: asset } }, quantity: 1 }] });
  return createWildsWalletTradeAgreement({ senderHandle: "alice", draft: draft("alice", "bob", "10", "creature:a") }, { senderHandle: "bob", draft: draft("bob", "alice", "20", "creature:b") });
}

test("resource consent binds the actual custody domain and exact package members independently of bearer heads", () => {
  const first = createWildsWalletTradeDraft({ attemptId: "resource:alice", recipient: "bob", selfHandle: "alice", phiMicro: "0", requestedPhiMicro: "1", requestNote: "Food for PHI",
    selections: [{ selection: { id: "food", label: "Food", quantity: 1, asset: { kind: "inventory", foodItemIds: ["food:one", "food:two"], materialLotIds: [], resourceLotIds: [] } }, quantity: 1 }] });
  const second = createWildsWalletTradeDraft({ attemptId: "resource:bob", recipient: "alice", selfHandle: "bob", phiMicro: "1", requestedPhiMicro: "0", requestNote: "Food", selections: [] });
  const plan = createWildsWalletStagedTradePlan(createWildsWalletTradeAgreement({ senderHandle: "alice", draft: first }, { senderHandle: "bob", draft: second }));
  const descriptor = { protocol: "wildz.resource-source.v128" as const, legId: plan.legs[0]!.legId, ownerHandle: "alice.receiz.id", sourceArtifactSha256: "a".repeat(64), sourcePayloadSha256: "b".repeat(64),
    packageId: `wildz:package:${"c".repeat(64)}`, packageHead: `sha256:${"d".repeat(64)}`, memberIds: ["food:one", "food:two"], domainId: "world:wildz:resource-custody:v128" as const, custodyAppendId: "wildz:resource:alice.receiz.id:offer:one", custodyHead: "e".repeat(64) };
  assert.deepEqual(admitWildsWalletStagedTradeSourceHeads(plan, "alice.receiz.id", [descriptor]), [descriptor]);
  const binding = { ownerHandle: "alice.receiz.id", keyId: "key:alice", identityArtifactDigest: "f".repeat(64), sourceHeads: [descriptor] };
  const challenge = wildsWalletStagedTradeApprovalChallenge(plan, binding);
  assert.notEqual(wildsWalletStagedTradeApprovalChallenge(plan, { ...binding, sourceHeads: [{ ...descriptor, custodyHead: "1".repeat(64) }] }).approvalId, challenge.approvalId);
  for (const altered of [{ ...descriptor, memberIds: ["food:one"] }, { ...descriptor, memberIds: ["food:two", "food:one"] }, { ...descriptor, domainId: "another-domain" }, { ...descriptor, artifactId: "1".repeat(64) }]) {
    assert.throws(() => admitWildsWalletStagedTradeSourceHeads(plan, "alice.receiz.id", [altered]), /source|member/);
  }
});

function setup() {
  let saved: unknown = null;
  let writable = true;
  let owner = "alice.receiz.id";
  let keyId = "key:alice";
  const calls: string[] = [];
  const outcomes = new Map<string, WildsWalletStagedTradeLegOutcome>();
  let lock: Promise<unknown> = Promise.resolve();
  const store = { load: () => structuredClone(saved), write: (_owner: string, value: unknown) => { if (!writable) throw Error("disk"); saved = structuredClone(value); }, withLock<T>(_owner: string, action: () => Promise<T>): Promise<T> { const work = lock.then(action); lock = work.catch(() => {}); return work; } };
  const sourceHeads = (plan: ReturnType<typeof createWildsWalletStagedTradePlan>, ownerHandle: string) => plan.legs.filter(leg => leg.senderHandle === ownerHandle && leg.kind === "asset").map(leg => ({ legId: leg.legId, sourceArtifactSha256: "c".repeat(64), sourcePayloadSha256: "d".repeat(64), artifactId: "e".repeat(64), namespace: "wildz.fixture", headReference: "head:fixture", historyDigestSha256: "f".repeat(64), projectionArtifactSha256: "1".repeat(64), projectionPayloadSha256: "2".repeat(64), projectionCardDigest: "3".repeat(64), appendCount: 0, ownerHandle }));
  const ports: WildsWalletStagedTradePorts = {
    currentBinding: () => ({ ownerHandle: owner, keyId, identityArtifactDigest: "a".repeat(64) }),
    readApprovalSources: async (plan, binding) => sourceHeads(plan, binding.ownerHandle),
    signApproval: async ({ plan, binding, challenge }) => ({ schema: "wildz.wallet.staged-trade-approval.v1", tradeId: plan.tradeId, ownerHandle: binding.ownerHandle, keyId: binding.keyId, identityArtifactDigest: binding.identityArtifactDigest, approvalId: challenge.approvalId, sourceHeads: JSON.parse(challenge.exactChallenge).sourceHeads, evidence: { challenge: challenge.exactChallenge } }),
    verifyApproval: async (approval, challenge) => {
      if ((approval.evidence as { challenge?: string })?.challenge !== challenge.exactChallenge) throw Error("signature");
      return { ownerHandle: approval.ownerHandle, keyId: approval.keyId, identityArtifactDigest: approval.identityArtifactDigest };
    },
    sendAsset: async leg => { assert.ok(saved, "durable before send"); calls.push(leg.attemptId); return { status: "sent", message: "Awaiting acceptance" }; },
    sendPhi: async leg => { assert.ok(saved, "durable before send"); calls.push(leg.attemptId); return { status: "committed", receipt: { legId: leg.legId } }; },
    observeLeg: async leg => outcomes.get(leg.legId) ?? { status: "none" },
    verifyLegReceipt: async (leg, outcome) => { if ((outcome.receipt as { legId?: string })?.legId !== leg.legId) throw Error("wrong receipt"); },
    publish: async () => {},
  };
  const controller = createWildsWalletStagedTradeController({ recoveryStore: store });
  const peer = (plan: ReturnType<typeof createWildsWalletStagedTradePlan>): WildsWalletStagedTradeApproval => {
    const binding = { ownerHandle: "bob.receiz.id", keyId: "key:bob", identityArtifactDigest: "b".repeat(64), sourceHeads: sourceHeads(plan, "bob.receiz.id") };
    const challenge = wildsWalletStagedTradeApprovalChallenge(plan, binding);
    return { schema: "wildz.wallet.staged-trade-approval.v1", tradeId: plan.tradeId, ...binding, approvalId: challenge.approvalId, evidence: { challenge: challenge.exactChallenge } };
  };
  return { controller, ports, store, calls, outcomes, peer, saved: () => saved, setSaved: (value: unknown) => { saved = value; }, setWritable: (value: boolean) => { writable = value; }, setOwner: (value: string) => { owner = value; }, setKey: (value: string) => { keyId = value; } };
}

test("staged trade freezes exact deterministic leg ids and waits for both approvals", async () => {
  const h = setup(), plan = createWildsWalletStagedTradePlan(agreement());
  assert.equal(plan.executionMode, "staged");
  assert.deepEqual(plan.legs.map(leg => leg.kind), ["asset", "phi", "asset", "phi"]);
  assert.deepEqual(createWildsWalletStagedTradePlan(agreement()), plan);
  const result = await h.controller.approve(plan.agreement, h.ports);
  assert.equal(result.status, "awaiting-peer");
  assert.deepEqual(h.calls, []);
  assert.ok(h.saved());
});

test("a delivered asset offer is awaiting acceptance and does not authorize the next Phi leg", async () => {
  const h = setup(), plan = createWildsWalletStagedTradePlan(agreement());
  await h.controller.approve(plan.agreement, h.ports);
  await h.controller.receiveApproval(plan, h.peer(plan), h.ports);
  const result = await h.controller.advance(plan.tradeId, h.ports);
  assert.equal(result.status, "awaiting-acceptance");
  assert.equal(h.calls.length, 1);
  await h.controller.advance(plan.tradeId, h.ports);
  assert.equal(h.calls.length, 1, "offered asset is never issued twice");
});

test("a locally prepared or globally reserved source is privately delivered before awaiting acceptance", async () => {
  const h = setup(), plan = createWildsWalletStagedTradePlan(agreement());
  await h.controller.approve(plan.agreement, h.ports);
  await h.controller.receiveApproval(plan, h.peer(plan), h.ports);
  h.outcomes.set(plan.legs[0]!.legId, { status: "offered" });
  assert.equal((await h.controller.advance(plan.tradeId, h.ports)).status, "awaiting-acceptance");
  assert.deepEqual(h.calls, [plan.legs[0]!.attemptId], "a source reservation is not private delivery");
  await h.controller.advance(plan.tradeId, h.ports);
  assert.deepEqual(h.calls, [plan.legs[0]!.attemptId], "the original delivered source is not replaced");
});

test("only exact accepted receipts permit staged progress and peer legs are never sent locally", async () => {
  const h = setup(), plan = createWildsWalletStagedTradePlan(agreement());
  await h.controller.approve(plan.agreement, h.ports);
  await h.controller.receiveApproval(plan, h.peer(plan), h.ports);
  await h.controller.advance(plan.tradeId, h.ports);
  h.outcomes.set(plan.legs[0]!.legId, { status: "accepted", receipt: { legId: plan.legs[0]!.legId } });
  const result = await h.controller.advance(plan.tradeId, h.ports);
  assert.equal(result.status, "awaiting-peer");
  assert.deepEqual(h.calls, [plan.legs[0]!.attemptId, plan.legs[1]!.attemptId]);
  h.outcomes.set(plan.legs[2]!.legId, { status: "accepted", receipt: { legId: plan.legs[2]!.legId } });
  h.outcomes.set(plan.legs[3]!.legId, { status: "committed", receipt: { legId: plan.legs[3]!.legId } });
  assert.equal((await h.controller.advance(plan.tradeId, h.ports)).status, "completed");
  assert.equal(h.calls.length, 2);
});

test("lost financial response resolves the original leg across reload and never executes again", async () => {
  const h = setup(), plan = createWildsWalletStagedTradePlan(agreement());
  await h.controller.approve(plan.agreement, h.ports);
  await h.controller.receiveApproval(plan, h.peer(plan), h.ports);
  h.outcomes.set(plan.legs[0]!.legId, { status: "accepted", receipt: { legId: plan.legs[0]!.legId } });
  h.ports.sendPhi = async leg => { h.calls.push(leg.attemptId); throw Error("lost response"); };
  assert.equal((await h.controller.advance(plan.tradeId, h.ports)).status, "pending");
  const reopened = createWildsWalletStagedTradeController({ recoveryStore: h.store });
  assert.equal((await reopened.advance(plan.tradeId, h.ports)).status, "pending");
  assert.deepEqual(h.calls, [plan.legs[1]!.attemptId]);
  h.outcomes.set(plan.legs[1]!.legId, { status: "committed", receipt: { legId: plan.legs[1]!.legId } });
  assert.equal((await reopened.advance(plan.tradeId, h.ports)).status, "awaiting-peer");
  assert.equal(h.calls.length, 1);
});

test("tampered saved approval, wrong receipt, changed identity and storage failures cannot send", async () => {
  const plan = createWildsWalletStagedTradePlan(agreement());
  const blocked = setup(); blocked.setWritable(false);
  assert.equal((await blocked.controller.approve(plan.agreement, blocked.ports)).status, "failed");
  assert.deepEqual(blocked.calls, []);
  const h = setup(); await h.controller.approve(plan.agreement, h.ports);
  await h.controller.receiveApproval(plan, h.peer(plan), h.ports);
  h.outcomes.set(plan.legs[0]!.legId, { status: "accepted", receipt: { legId: "another leg" } });
  assert.equal((await h.controller.advance(plan.tradeId, h.ports)).status, "pending");
  assert.deepEqual(h.calls, []);
  h.setKey("key:replacement");
  assert.equal((await h.controller.advance(plan.tradeId, h.ports)).status, "failed");
  assert.deepEqual(h.calls, []);
  h.setKey("key:alice");
  const damaged = structuredClone(h.saved()) as { trades: Array<{ approvals: WildsWalletStagedTradeApproval[] }> };
  damaged.trades[0]!.approvals[1] = { ...damaged.trades[0]!.approvals[1]!, evidence: { challenge: "forged" } };
  h.setSaved(damaged);
  const reopened = createWildsWalletStagedTradeController({ recoveryStore: h.store });
  assert.equal((await reopened.advance(plan.tradeId, h.ports)).status, "failed");
  assert.deepEqual(h.calls, []);
});

test("duplicate peer approval and concurrent advancement reuse the same leg", async () => {
  const h = setup(), plan = createWildsWalletStagedTradePlan(agreement());
  await h.controller.approve(plan.agreement, h.ports);
  await h.controller.receiveApproval(plan, h.peer(plan), h.ports);
  await h.controller.receiveApproval(plan, h.peer(plan), h.ports);
  await Promise.all([h.controller.advance(plan.tradeId, h.ports), h.controller.advance(plan.tradeId, h.ports)]);
  assert.deepEqual(h.calls, [plan.legs[0]!.attemptId]);
});

test("lost private receipt delivery retries the saved settlement locator without another payment", async () => {
  const h = setup(), plan = createWildsWalletStagedTradePlan(agreement());
  await h.controller.approve(plan.agreement, h.ports);
  await h.controller.receiveApproval(plan, h.peer(plan), h.ports);
  h.outcomes.set(plan.legs[0]!.legId, { status: "accepted", receipt: { legId: plan.legs[0]!.legId } });
  let failDelivery = true;
  const published: string[] = [];
  h.ports.publish = async message => {
    if (message.kind !== "trade-staged-progress" || message.legId !== plan.legs[1]!.legId) return;
    if (failDelivery) throw Error("lost private delivery");
    published.push(message.legId);
  };
  assert.equal((await h.controller.advance(plan.tradeId, h.ports)).status, "pending");
  assert.deepEqual(h.calls, [plan.legs[1]!.attemptId]);
  failDelivery = false;
  const reopened = createWildsWalletStagedTradeController({ recoveryStore: h.store });
  assert.equal((await reopened.advance(plan.tradeId, h.ports)).status, "awaiting-peer");
  assert.deepEqual(published, [plan.legs[1]!.legId]);
  assert.deepEqual(h.calls, [plan.legs[1]!.attemptId], "only the same native receipt is delivered again");
});

test("identity changing while consent is open cannot save an approval or start a leg", async () => {
  const h = setup(), plan = createWildsWalletStagedTradePlan(agreement());
  const originalSign = h.ports.signApproval;
  h.ports.signApproval = async input => {
    const approval = await originalSign(input);
    h.setKey("key:replacement");
    return approval;
  };
  assert.equal((await h.controller.approve(plan.agreement, h.ports)).status, "failed");
  const saved = h.saved() as { trades: Array<{ approvals: unknown[] }> };
  assert.deepEqual(saved.trades[0]!.approvals, []);
  assert.deepEqual(h.calls, []);
});

test("native source descriptor is signed into consent and cannot be replaced during reload", async () => {
  const h = setup(), plan = createWildsWalletStagedTradePlan(agreement());
  await h.controller.approve(plan.agreement, h.ports);
  await h.controller.receiveApproval(plan, h.peer(plan), h.ports);
  const record = structuredClone(h.saved()) as { trades: Array<{ approvals: WildsWalletStagedTradeApproval[] }> };
  const local = record.trades[0]!.approvals[0]!;
  record.trades[0]!.approvals[0] = { ...local, sourceHeads: local.sourceHeads.map(head => ({ ...head, sourceArtifactSha256: "1".repeat(64) })) };
  h.setSaved(record);
  const reopened = createWildsWalletStagedTradeController({ recoveryStore: h.store });
  assert.equal((await reopened.advance(plan.tradeId, h.ports)).status, "failed");
  assert.deepEqual(h.calls, []);
});

test("recipient retries delivery of its saved accepted native asset proof before later stages", async () => {
  const h = setup(), plan = createWildsWalletStagedTradePlan(agreement());
  await h.controller.approve(plan.agreement, h.ports);
  await h.controller.receiveApproval(plan, h.peer(plan), h.ports);
  for (const [index, status] of [[0, "accepted"], [1, "committed"], [2, "accepted"]] as const) h.outcomes.set(plan.legs[index]!.legId, { status, receipt: { legId: plan.legs[index]!.legId } });
  let failDelivery = true;
  const delivered: string[] = [];
  h.ports.publish = async message => {
    if (message.kind !== "trade-staged-progress" || message.legId !== plan.legs[2]!.legId) return;
    if (failDelivery) throw Error("lost accepted proof publication");
    delivered.push(message.legId);
  };
  assert.equal((await h.controller.advance(plan.tradeId, h.ports)).status, "pending");
  failDelivery = false;
  assert.equal((await createWildsWalletStagedTradeController({ recoveryStore: h.store }).advance(plan.tradeId, h.ports)).status, "awaiting-peer");
  assert.deepEqual(delivered, [plan.legs[2]!.legId]);
  assert.deepEqual(h.calls, [], "only receipt transport is retried");
});

test("explicit recipient acceptance checkpoints the exact current stage and requires its actual receipt", async () => {
  const h = setup(), plan = createWildsWalletStagedTradePlan(agreement());
  await h.controller.approve(plan.agreement, h.ports);
  await h.controller.receiveApproval(plan, h.peer(plan), h.ports);
  h.outcomes.set(plan.legs[0]!.legId, { status: "accepted", receipt: { legId: plan.legs[0]!.legId } });
  h.outcomes.set(plan.legs[1]!.legId, { status: "committed", receipt: { legId: plan.legs[1]!.legId } });
  h.outcomes.set(plan.legs[2]!.legId, { status: "offered" });
  const accepted: string[] = [];
  h.ports.acceptAsset = async leg => {
    const record = h.saved() as { trades: Array<{ legs: Array<{ legId: string; status: string }> }> };
    assert.equal(record.trades[0]!.legs[2]!.status, "pending", "same original checkpoint is durable before claim");
    accepted.push(leg.attemptId);
    return { status: "accepted", receipt: { legId: leg.legId } };
  };
  assert.equal((await h.controller.acceptIncomingAsset(plan.tradeId, plan.legs[2]!.legId, h.ports)).status, "awaiting-peer");
  assert.deepEqual(accepted, [plan.legs[2]!.attemptId]);
  assert.deepEqual(h.calls, [], "already verified previous stages are not sent again");
});

test("recipient cannot accept a later stage, an undelivered source, or an offer without their own approval", async () => {
  const plan = createWildsWalletStagedTradePlan(agreement());
  for (const scenario of ["later", "undelivered", "unapproved"] as const) {
    const h = setup();
    if (scenario !== "unapproved") await h.controller.approve(plan.agreement, h.ports);
    await h.controller.receiveApproval(plan, h.peer(plan), h.ports);
    if (scenario === "undelivered") {
      h.outcomes.set(plan.legs[0]!.legId, { status: "accepted", receipt: { legId: plan.legs[0]!.legId } });
      h.outcomes.set(plan.legs[1]!.legId, { status: "committed", receipt: { legId: plan.legs[1]!.legId } });
    }
    let accepts = 0;
    h.ports.acceptAsset = async leg => { accepts++; return { status: "accepted", receipt: { legId: leg.legId } }; };
    const result = await h.controller.acceptIncomingAsset(plan.tradeId, plan.legs[2]!.legId, h.ports);
    assert.notEqual(result.status, "completed");
    assert.equal(accepts, 0, scenario);
    assert.deepEqual(h.calls, [], "an Accept button cannot start an earlier financial stage");
  }
});

test("lost acceptance response stays on the same source and only explicit Accept retries its canonical claim", async () => {
  const h = setup(), plan = createWildsWalletStagedTradePlan(agreement());
  await h.controller.approve(plan.agreement, h.ports);
  await h.controller.receiveApproval(plan, h.peer(plan), h.ports);
  h.outcomes.set(plan.legs[0]!.legId, { status: "accepted", receipt: { legId: plan.legs[0]!.legId } });
  h.outcomes.set(plan.legs[1]!.legId, { status: "committed", receipt: { legId: plan.legs[1]!.legId } });
  h.outcomes.set(plan.legs[2]!.legId, { status: "offered" });
  const accepts: string[] = [];
  h.ports.acceptAsset = async leg => { accepts.push(leg.attemptId); throw Error("lost claim reply"); };
  assert.equal((await h.controller.acceptIncomingAsset(plan.tradeId, plan.legs[2]!.legId, h.ports)).status, "pending");
  const reopened = createWildsWalletStagedTradeController({ recoveryStore: h.store });
  await reopened.advance(plan.tradeId, h.ports);
  assert.deepEqual(accepts, [plan.legs[2]!.attemptId]);
  h.ports.acceptAsset = async leg => { accepts.push(leg.attemptId); return { status: "accepted", receipt: { legId: "forged-other-stage" } }; };
  assert.equal((await reopened.acceptIncomingAsset(plan.tradeId, plan.legs[2]!.legId, h.ports)).status, "pending");
  assert.deepEqual(accepts, [plan.legs[2]!.attemptId, plan.legs[2]!.attemptId]);
  assert.deepEqual(h.calls, []);
});

test("failed received-asset adoption preserves accepted custody and Check repairs the same saved proof", async () => {
  const h = setup(), plan = createWildsWalletStagedTradePlan(agreement());
  await h.controller.approve(plan.agreement, h.ports);
  await h.controller.receiveApproval(plan, h.peer(plan), h.ports);
  for (const [index, status] of [[0, "accepted"], [1, "committed"], [2, "accepted"], [3, "committed"]] as const) h.outcomes.set(plan.legs[index]!.legId, { status, receipt: { legId: plan.legs[index]!.legId }, ...(index === 2 ? { projectionPending: true as const } : {}) });
  const accepted = await h.controller.advance(plan.tradeId, h.ports);
  assert.equal(accepted.status, "completed");
  assert.equal(accepted.assetRecoveryRequired, true);
  h.outcomes.set(plan.legs[2]!.legId, { status: "pending" });
  const reopened = createWildsWalletStagedTradeController({ recoveryStore: h.store });
  const pending = await reopened.advance(plan.tradeId, h.ports);
  assert.equal(pending.status, "pending");
  assert.equal(pending.assetRecoveryRequired, true);
  const saved = h.saved() as { trades: Array<{ legs: Array<{ status: string; projectionPending?: true }> }> };
  assert.equal(saved.trades[0]!.legs[2]!.status, "accepted", "projection failure cannot erase actual delivery");
  h.outcomes.set(plan.legs[2]!.legId, { status: "accepted", receipt: { legId: plan.legs[2]!.legId } });
  const repaired = await reopened.acceptIncomingAsset(plan.tradeId, plan.legs[2]!.legId, h.ports);
  assert.equal(repaired.status, "completed");
  assert.equal(repaired.assetRecoveryRequired, undefined);
  assert.deepEqual(h.calls, [], "adoption repair never sends or claims again");
});
