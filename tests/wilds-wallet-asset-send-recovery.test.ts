import assert from "node:assert/strict";
import { test } from "node:test";
import { createWildsWalletAssetSendDriver, type WildsWalletAssetSendPorts } from "../src/features/play/wallet/wilds-wallet-asset-send-driver";
import type { WildsWalletAssetSendRequest } from "../src/features/play/wallet/wilds-wallet-asset-send";
import { WildsMessageZeroWriteError } from "../src/features/play/wilds-messenger-delivery";
import { admitWildsWalletAssetSendRecovery } from "../src/features/play/wallet/wilds-wallet-asset-send-recovery";

type RecoveryStore = { load(owner: string): unknown; write(owner: string, value: unknown): void };
const factory = createWildsWalletAssetSendDriver;
function storage() {
  const entries = new Map<string, string>();
  const store: RecoveryStore = { load: owner => JSON.parse(entries.get(owner) ?? "null"), write: (owner, value) => { entries.set(owner, JSON.stringify(value)); } };
  return { entries, store };
}
function fixture() {
  const commands: string[] = [], creatures: string[] = [], packages = new Map<string, string>(), transfers: string[] = [];
  const ports: WildsWalletAssetSendPorts = {
    owner: "explorer.receiz.id", currentOwner: () => "explorer.receiz.id", authorize: async () => {}, validate: async () => {}, findCreatureDelivery: () => false,
    validateRecoveryPackage: async () => {},
    issueCreatureOffer: async (assetId, recipient) => { creatures.push(`${assetId}:${recipient}`); throw Error("lost_offer_response"); },
    createInventoryPackage: async request => { commands.push(request.attemptId); const id = packages.get(request.attemptId) ?? `package:${request.attemptId}`; packages.set(request.attemptId, id); return id; },
    transferPackage: async id => { transfers.push(id); return { claimId: "claim:one", claimProof: "SECRET_BEARER_PROOF", claimUrl: "https://wildz.quest/claim#SECRET_BEARER_PROOF" }; },
    deliverResourceClaim: async () => {}
  };
  return { ports, commands, creatures, packages, transfers };
}
function request(attemptId = "wallet:reload:one", recipientHandle = "friend"): WildsWalletAssetSendRequest {
  return { attemptId, recipientHandle, asset: { kind: "inventory", foodItemIds: ["food:one"], materialLotIds: [], resourceLotIds: [] } };
}

test("asset recovery reuses the original source command after a full reload loses package admission", async () => {
  const f = fixture(), saved = storage(), create = f.ports.createInventoryPackage;
  let lose = true;
  f.ports.createInventoryPackage = async exact => { const id = await create(exact); if (lose) { lose = false; throw Error("lost_admission_response"); } return id; };
  assert.equal((await factory({ recoveryStore: saved.store }).send(request(), f.ports)).status, "pending");
  assert.equal((await factory({ recoveryStore: saved.store }).send(request("wallet:reload:two"), f.ports)).status, "sent");
  assert.deepEqual(f.commands, ["wallet:reload:one", "wallet:reload:one"]);
  assert.equal(f.packages.size, 1);
});

test("asset recovery retains unknown creature locks across reload and recipient changes", async () => {
  const f = fixture(), saved = storage();
  const creature: WildsWalletAssetSendRequest = { attemptId: "wallet:creature:reload", recipientHandle: "friend", asset: { kind: "creature", assetId: "creature:one" } };
  assert.equal((await factory({ recoveryStore: saved.store }).send(creature, f.ports)).status, "pending");
  const restored = factory({ recoveryStore: saved.store });
  assert.equal((await restored.send({ ...creature, attemptId: "wallet:creature:second", recipientHandle: "other" }, f.ports)).status, "pending");
  assert.equal((await restored.send({ ...creature, attemptId: "wallet:creature:third" }, f.ports)).status, "pending");
  assert.equal(f.creatures.length, 1);
});

test("asset recovery stores exact package custody metadata without private claim authority", async () => {
  const f = fixture(), saved = storage();
  let lose = true;
  f.ports.deliverResourceClaim = async () => { if (lose) { lose = false; throw Error("lost_message_response"); } };
  assert.equal((await factory({ recoveryStore: saved.store }).send(request(), f.ports)).status, "pending");
  const serialized = saved.entries.get(f.ports.owner)!;
  assert.ok(serialized);
  assert.match(serialized, /package:wallet:reload:one/);
  assert.doesNotMatch(serialized, /SECRET_BEARER_PROOF|claimProof|claimUrl|authorization|token/i);
  assert.equal((await factory({ recoveryStore: saved.store }).send(request("wallet:reload:two"), f.ports)).status, "sent");
  assert.equal(f.commands.length, 1);
  assert.deepEqual(f.transfers, ["package:wallet:reload:one", "package:wallet:reload:one"]);
});

test("corrupt or unavailable recovery storage stops sends before source mutation", async () => {
  for (const store of [
    { load: () => ({ schema: "corrupt", attempts: [] }), write: () => {} },
    { load: () => { throw Error("blocked_storage"); }, write: () => {} },
    { load: () => null, write: () => { throw Error("quota_exceeded"); } }
  ]) {
    const f = fixture();
    const result = await factory({ recoveryStore: store }).send(request(), f.ports);
    assert.equal(result.status, "failed");
    assert.match(result.message, /saved|recovery|storage/i);
    assert.equal(f.commands.length, 0);
    assert.equal(f.creatures.length, 0);
  }
});

test("a failed mutation checkpoint prevents dispatch and preserves the existing recovery entry", async () => {
  const f = fixture(), saved = storage();
  let writes = 0;
  const store: RecoveryStore = { load: saved.store.load, write(owner, value) { writes += 1; if (writes > 1) throw Error("quota_exceeded"); saved.store.write(owner, value); } };
  assert.equal((await factory({ recoveryStore: store }).send(request(), f.ports)).status, "failed");
  assert.equal(f.commands.length, 0);
  assert.ok(saved.entries.get(f.ports.owner));
});

test("a private-message zero-write failure retains already mutated resource custody across reload", async () => {
  const f = fixture(), saved = storage();
  f.ports.deliverResourceClaim = async () => { throw new WildsMessageZeroWriteError("No message was published."); };
  assert.equal((await factory({ recoveryStore: saved.store }).send(request(), f.ports)).status, "pending");
  const restored = factory({ recoveryStore: saved.store });
  assert.equal((await restored.send(request("wallet:other:recipient", "other"), f.ports)).status, "pending");
  assert.equal(f.commands.length, 1);
});

test("recovery metadata is strictly bounded and rejects added claim authority", () => {
  const owner = "explorer.receiz.id", exact = { ...request(), recipientHandle: "friend.receiz.id" };
  const base = { schema: "wildz.wallet.asset-send.v1", owner, attempts: [{ request: exact, keys: ["source:food:one"], stage: "mutated" }] };
  assert.equal(admitWildsWalletAssetSendRecovery(base, owner).attempts.length, 1);
  assert.throws(() => admitWildsWalletAssetSendRecovery({ ...base, attempts: [{ ...base.attempts[0], claimProof: "SECRET" }] }, owner), /recovery/i);
  assert.throws(() => admitWildsWalletAssetSendRecovery({ ...base, attempts: Array.from({ length: 65 }, (_, index) => ({ request: { ...exact, attemptId: `wallet:bounded:${index}`, asset: { kind: "creature", assetId: `creature:${index}` } }, keys: [`creature:creature:${index}`], stage: "mutated" })) }, owner), /recovery/i);
  assert.throws(() => admitWildsWalletAssetSendRecovery(base, "other.receiz.id"), /recovery/i);
});

test("a restored package must bind to the original exact source command before any custody retry", async () => {
  const f = fixture(), saved = storage();
  f.ports.deliverResourceClaim = async () => { throw Error("lost_delivery_response"); };
  assert.equal((await factory({ recoveryStore: saved.store }).send(request(), f.ports)).status, "pending");
  let checked = false;
  f.ports.validateRecoveryPackage = async (exact, packageId) => {
    checked = true;
    assert.equal(exact.attemptId, "wallet:reload:one");
    assert.equal(packageId, "package:wallet:reload:one");
    throw Error("Canonical package source members do not match.");
  };
  assert.equal((await factory({ recoveryStore: saved.store }).send(request("wallet:reload:two"), f.ports)).status, "pending");
  assert.equal(checked, true);
  assert.equal(f.commands.length, 1);
  assert.equal(f.transfers.length, 1);
});

test("a syntactically valid saved sent checkpoint cannot prove creature or resource delivery", async () => {
  for (const asset of [{ kind: "creature" as const, assetId: "creature:forged" }, { kind: "package" as const, packageId: "package:forged" }]) {
    const f = fixture(), saved = storage();
    const exact: WildsWalletAssetSendRequest = { attemptId: "wallet:forged:sent", recipientHandle: "friend.receiz.id", asset };
    const key = asset.kind === "creature" ? `creature:${asset.assetId}` : `package:${asset.packageId}`;
    saved.store.write(f.ports.owner, { schema: "wildz.wallet.asset-send.v1", owner: f.ports.owner, attempts: [{ request: exact, keys: [key], stage: "sent", ...(asset.kind === "package" ? { packageId: asset.packageId } : {}) }] });
    let executionCalls = 0;
    const unavailable = async () => { executionCalls++; throw Error("Canonical execution is unavailable."); };
    f.ports.authorize = unavailable;
    f.ports.validate = unavailable;
    f.ports.validateRecoveryPackage = unavailable;
    f.ports.issueCreatureOffer = unavailable;
    f.ports.createInventoryPackage = async () => { await unavailable(); return "never"; };
    f.ports.transferPackage = async () => { await unavailable(); throw Error("never"); };
    f.ports.deliverResourceClaim = unavailable;
    for (let reload = 0; reload < 2; reload++) {
      const result = await factory({ recoveryStore: saved.store }).send(exact, f.ports);
      assert.equal(result.status, "pending");
      assert.equal(result.retryable, false);
      assert.doesNotMatch(result.message, /sent to|was delivered/i);
      assert.match(result.message, /held|unconfirmed|could not be confirmed/i);
    }
    assert.equal(executionCalls, 0);
  }
});

test("a restored creature sent checkpoint is confirmed only by actual delivery evidence", async () => {
  const f = fixture(), saved = storage();
  const exact: WildsWalletAssetSendRequest = { attemptId: "wallet:delivered:creature", recipientHandle: "friend.receiz.id", asset: { kind: "creature", assetId: "creature:one" } };
  saved.store.write(f.ports.owner, { schema: "wildz.wallet.asset-send.v1", owner: f.ports.owner, attempts: [{ request: exact, keys: ["creature:creature:one"], stage: "sent" }] });
  f.ports.findCreatureDelivery = () => true;
  assert.equal((await factory({ recoveryStore: saved.store }).send(exact, f.ports)).status, "sent");
  assert.equal(f.creatures.length, 0);
});
