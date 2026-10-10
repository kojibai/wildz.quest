import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { WildsConversation, WildsDirectMessage } from "../src/features/play/wilds-messenger-core";
import { WildsWalletTrade } from "../src/features/play/wallet/WildsWalletTrade";
import { createWildsWalletGiftAgreement } from "../src/features/play/wallet/wilds-wallet-trade";
import { projectWildsWalletStagedTradeInbox } from "../src/features/play/wallet/wilds-wallet-staged-trade-inbox";
import { admitWildsWalletStagedTradeSourceNotice } from "../src/features/play/wallet/wilds-wallet-staged-trade-source-notice";
import { createWildsWalletStagedTradePlan, wildsWalletStagedTradeApprovalChallenge, type WildsWalletStagedTradeApproval, type WildsWalletStagedTradeIncomingAsset } from "../src/features/play/wallet/wilds-wallet-staged-trade-types";

const agreement = createWildsWalletGiftAgreement("alice", { attemptId: "gift:creature:one", recipientHandle: "bob", asset: { kind: "creature", assetId: "creature:one" } });
const plan = createWildsWalletStagedTradePlan(agreement);
const leg = plan.legs[0]!;
if (leg.kind !== "asset") throw Error("Expected an asset fixture.");
const descriptor = { legId: leg.legId, ownerHandle: leg.senderHandle, sourceArtifactSha256: "a".repeat(64), sourcePayloadSha256: "b".repeat(64), artifactId: "c".repeat(64), namespace: "wildz.fixture", headReference: "native:fixture:source", historyDigestSha256: "d".repeat(64), appendCount: 0, projectionArtifactSha256: "e".repeat(64), projectionPayloadSha256: "f".repeat(64), projectionCardDigest: "1".repeat(64) };
const binding = { ownerHandle: "alice.receiz.id", keyId: "key:alice", identityArtifactDigest: "2".repeat(64), sourceHeads: [descriptor] };
const challenge = wildsWalletStagedTradeApprovalChallenge(plan, binding);
// This is transport/display fixture evidence. It is never an admitted SDK proof.
const approval: WildsWalletStagedTradeApproval = { schema: "wildz.wallet.staged-trade-approval.v1", tradeId: plan.tradeId, ...binding, approvalId: challenge.approvalId, evidence: { displayFixture: true } };
const context = { kind: "trade-staged-approval" as const, plan, approval };
function message(overrides: Partial<WildsDirectMessage> = {}): WildsDirectMessage {
  return { schema: "receiz.wilds_direct_message.v1", id: "message:one", clientMessageId: "message:one", conversationId: "conversation:one", senderId: "alice", senderHandle: "alice.receiz.id", recipientId: "bob", recipientHandle: "bob.receiz.id", body: "Gift", createdAt: "2026-10-09T12:00:00Z", editedAt: null, deletedAt: null, replyToId: null, reactions: [], authority: { source: "receiz-id-proof-object", projection: "sync-only" }, context, ...overrides };
}
function conversation(messages: WildsDirectMessage[]): WildsConversation {
  return { schema: "receiz.wilds_conversation.v1", id: "conversation:one", revision: 1, participants: [{ id: "alice", handle: "alice.receiz.id" }, { id: "bob", handle: "bob.receiz.id" }], messages, readThrough: {}, createdAt: "2026-10-09T12:00:00Z", updatedAt: "2026-10-09T12:00:00Z" };
}
const recoveryStore = { load: () => null, write() { throw Error("Rendering must not save a trade."); }, clear() { throw Error("Rendering must not clear a trade."); } };

test("gift inbox projects one exact agreement, without an empty recipient counteroffer", () => {
  const inbox = projectWildsWalletStagedTradeInbox([conversation([message(), message({ id: "duplicate" })])], "bob");
  assert.equal(inbox.length, 1);
  assert.equal(inbox[0]!.agreement.purpose, "gift");
  assert.deepEqual(inbox[0]!.agreement.second.draft.offered, { phiMicro: "0", assets: [] });
  let approvals = 0;
  const markup = renderToStaticMarkup(<WildsWalletTrade publicUsername="bob" incomingAgreements={inbox} recoveryStore={recoveryStore} onApproveTrade={async () => { approvals++; return { status: "awaiting-peer", message: "Approved" }; }} />);
  assert.match(markup, /Review gift/);
  assert.match(markup, /Creature · creature:one/);
  assert.doesNotMatch(markup, /Choose what you send|Build your counteroffer/);
  assert.equal(approvals, 0, "an inbox projection never approves or sends");
});

test("gift inbox excludes altered terms, substituted source heads, extra approval fields and other recipients", () => {
  const bad = [
    message({ recipientHandle: "carol.receiz.id" }),
    message({ deletedAt: "2026-10-09T12:01:00Z" }),
    message({ editedAt: "2026-10-09T12:01:00Z" }),
    message({ context: { ...context, approval: { ...approval, sourceHeads: [{ ...descriptor, sourceArtifactSha256: "3".repeat(64) }] } } }),
    message({ context: { ...context, approval: { ...approval, accepted: true } } as unknown as WildsDirectMessage["context"] }),
    message({ context: { ...context, plan: { ...plan, executionMode: "atomic" } } as unknown as WildsDirectMessage["context"] }),
  ];
  assert.deepEqual(projectWildsWalletStagedTradeInbox([conversation(bad)], "bob"), []);
  assert.deepEqual(projectWildsWalletStagedTradeInbox([conversation([message()])], null), []);
});

test("received gift exposes explicit delivery acceptance and uncertain claims keep the same source", () => {
  const item: WildsWalletStagedTradeIncomingAsset = { tradeId: plan.tradeId, leg, descriptor, authority: { plan, approvals: [approval], acceptedNotBeforeKai: "10" }, status: "offered" };
  let accepts = 0;
  const render = (status: WildsWalletStagedTradeIncomingAsset["status"]) => renderToStaticMarkup(<WildsWalletTrade publicUsername="bob" recoveryStore={recoveryStore} incomingAssets={[{ ...item, status }]} onAcceptIncomingAsset={async () => { accepts++; return { status: "committed", message: "Received" }; }} />);
  assert.match(render("offered"), /Accept gift delivery/);
  assert.match(render("pending"), /Check same acceptance/);
  assert.match(render("projection-pending"), /Refresh received asset/);
  assert.equal(accepts, 0, "rendering never claims or accepts a source");
  const unavailable = renderToStaticMarkup(<WildsWalletTrade publicUsername="bob" recoveryStore={recoveryStore} incomingAssets={[item]} />);
  assert.match(unavailable, /<button disabled=""[^>]*>Accept gift delivery/);
});

test("private source notices route only exact saved asset legs and do not establish acceptance", () => {
  const original = { schema: "receiz.sealed-artifact-bytes.v124" as const, exactBytesB64u: "cHVibGljLXJvdXRpbmctZml4dHVyZQ", filename: "fixture.png", mimeType: "image/png", artifactSha256: "a".repeat(64), payloadSha256: "b".repeat(64) };
  const notice = { kind: "trade-bearer-source", tradeId: plan.tradeId, legId: leg.legId, original, projectionOriginal: original, originProof: { displayFixture: true } };
  assert.doesNotThrow(() => admitWildsWalletStagedTradeSourceNotice(notice, "alice.receiz.id", "bob.receiz.id", plan));
  for (const changed of [{ ...notice, legId: `${plan.tradeId}:1` }, { ...notice, tradeId: `staged:${"f".repeat(64)}` }, { ...notice, kind: "trade-resource-source" }, { ...notice, accepted: true }]) assert.throws(() => admitWildsWalletStagedTradeSourceNotice(changed, "alice.receiz.id", "bob.receiz.id", plan));
  assert.throws(() => admitWildsWalletStagedTradeSourceNotice(notice, "carol.receiz.id", "bob.receiz.id", plan));
  // Routing accepts bounded bytes, never an SDK branded source or receipt.
  assert.deepEqual(projectWildsWalletStagedTradeInbox([conversation([message({ context: notice as WildsDirectMessage["context"] })])], "bob"), []);
});
