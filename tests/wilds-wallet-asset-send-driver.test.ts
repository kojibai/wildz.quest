import assert from "node:assert/strict";
import { test } from "node:test";
import { createWildsWalletAssetSendDriver, type WildsWalletAssetSendPorts } from "../src/features/play/wallet/wilds-wallet-asset-send-driver";
import type { WildsWalletAssetSendRequest } from "../src/features/play/wallet/wilds-wallet-asset-send";
import { WildsMessageZeroWriteError } from "../src/features/play/wilds-messenger-delivery";

function request(attemptId = "wallet:send:one", recipientHandle = "@Friend") : WildsWalletAssetSendRequest {
  return { attemptId, recipientHandle, asset: { kind: "inventory", foodItemIds: ["food:two", "food:one"], materialLotIds: ["timber:one"], resourceLotIds: ["honey:one"] } };
}

function fixture(overrides: Partial<WildsWalletAssetSendPorts> = {}) {
  const created = new Map<string, string>();
  const commands: WildsWalletAssetSendRequest[] = [];
  const delivered = new Set<string>();
  const transfers: string[] = [];
  const creatures: string[] = [];
  const ports: WildsWalletAssetSendPorts = {
    owner: "explorer.receiz.id",
    currentOwner: () => "explorer.receiz.id",
    authorize: async () => {},
    validate: async () => {},
    findCreatureDelivery: () => false,
    issueCreatureOffer: async (assetId, recipient) => { creatures.push(`${assetId}:${recipient}`); },
    createInventoryPackage: async (input) => {
      commands.push(input);
      const id = created.get(input.attemptId) ?? `package:${input.attemptId}`;
      created.set(input.attemptId, id);
      return id;
    },
    transferPackage: async (id, recipient) => {
      transfers.push(`${id}:${recipient}`);
      return { claimId: "claim:one", claimProof: "sealed:one", claimUrl: "https://wildz.quest/claim#one" };
    },
    deliverResourceClaim: async (_recipient, claim) => { delivered.add(claim.claimId); },
    ...overrides
  };
  return { ports, created, commands, delivered, transfers, creatures };
}

test("direct wallet inventory sends preserve exact source IDs and deliver a recipient-bound claim", async () => {
  const f = fixture(), driver = createWildsWalletAssetSendDriver();
  const result = await driver.send(request(), f.ports);
  assert.equal(result.status, "sent");
  assert.match(result.message, /@friend.*awaiting acceptance/i);
  assert.deepEqual(f.commands[0], { attemptId: "wallet:send:one", recipientHandle: "friend.receiz.id", asset: { kind: "inventory", foodItemIds: ["food:one", "food:two"], materialLotIds: ["timber:one"], resourceLotIds: ["honey:one"] } });
  assert.deepEqual(f.transfers, ["package:wallet:send:one:friend.receiz.id"]);
  assert.deepEqual([...f.delivered], ["claim:one"]);
});

test("an ambiguous package creation replays its original command after the wallet reopens", async () => {
  const f = fixture(), create = f.ports.createInventoryPackage;
  let lostResponse = true;
  f.ports.createInventoryPackage = async input => {
    const id = await create(input);
    if (lostResponse) { lostResponse = false; throw Error("connection_lost_after_admission"); }
    return id;
  };
  const driver = createWildsWalletAssetSendDriver();
  const first = await driver.send(request(), f.ports);
  assert.equal(first.status, "pending");
  assert.equal(first.retryable, true);
  const replayed = await driver.send(request("wallet:send:reopened"), f.ports);
  assert.equal(replayed.status, "sent");
  assert.equal(f.created.size, 1);
  assert.deepEqual(f.commands.map(command => command.attemptId), ["wallet:send:one", "wallet:send:one"]);
});

test("message recovery retains the issued claim and does not repack or reissue it", async () => {
  const f = fixture(), deliver = f.ports.deliverResourceClaim;
  let lostResponse = true;
  f.ports.deliverResourceClaim = async (recipient, claim) => {
    await deliver(recipient, claim);
    if (lostResponse) { lostResponse = false; throw Error("delivery_response_lost"); }
  };
  const driver = createWildsWalletAssetSendDriver();
  assert.equal((await driver.send(request(), f.ports)).status, "pending");
  assert.equal((await driver.send(request("wallet:send:retry"), f.ports)).status, "sent");
  assert.equal(f.created.size, 1);
  assert.equal(f.transfers.length, 1);
  assert.deepEqual([...f.delivered], ["claim:one"]);
});

test("a resource package exposed after an uncertain inventory send recovers its original attempt", async () => {
  const f = fixture(), create = f.ports.createInventoryPackage, deliver = f.ports.deliverResourceClaim;
  let loseCreate = true, loseMessage = true;
  f.ports.packageMemberIds = () => ["food:one", "food:two", "timber:one", "honey:one"];
  f.ports.createInventoryPackage = async exact => {
    const id = await create(exact);
    if (loseCreate) { loseCreate = false; throw Error("creation_response_lost"); }
    return id;
  };
  f.ports.deliverResourceClaim = async (recipient, claim) => {
    await deliver(recipient, claim);
    if (loseMessage) { loseMessage = false; throw Error("message_response_lost"); }
  };
  const driver = createWildsWalletAssetSendDriver();
  assert.equal((await driver.send(request(), f.ports)).status, "pending");
  const reopened: WildsWalletAssetSendRequest = { attemptId: "wallet:reopened:package", recipientHandle: "friend", asset: { kind: "package", packageId: "package:wallet:send:one" } };
  assert.equal((await driver.send(reopened, f.ports)).status, "pending");
  assert.equal((await driver.send(reopened, f.ports)).status, "sent");
  assert.equal(f.created.size, 1);
  assert.equal(f.transfers.length, 1);
});

test("concurrent confirms share one source operation and one private delivery", async () => {
  const f = fixture(), driver = createWildsWalletAssetSendDriver();
  const [one, two] = await Promise.all([driver.send(request(), f.ports), driver.send(request("wallet:send:second-click"), f.ports)]);
  assert.equal(one.status, "sent");
  assert.equal(two.status, "sent");
  assert.equal(f.commands.length, 1);
  assert.equal(f.transfers.length, 1);
  assert.equal(f.delivered.size, 1);
});

test("pending creature issuance blocks a second offer and resolves only from delivery evidence", async () => {
  const f = fixture();
  let deliveriesConfirmed = false;
  f.ports.findCreatureDelivery = () => deliveriesConfirmed;
  f.ports.issueCreatureOffer = async (assetId, recipient) => { f.creatures.push(`${assetId}:${recipient}`); throw Error("issuance_response_lost"); };
  const driver = createWildsWalletAssetSendDriver();
  const creature: WildsWalletAssetSendRequest = { attemptId: "wallet:creature:one", recipientHandle: "friend", asset: { kind: "creature", assetId: "creature:one" } };
  const first = await driver.send(creature, f.ports);
  assert.equal(first.status, "pending");
  assert.equal(first.retryable, false);
  assert.equal((await driver.send({ ...creature, attemptId: "wallet:creature:two" }, f.ports)).status, "pending");
  assert.equal((await driver.send({ ...creature, attemptId: "wallet:creature:three", recipientHandle: "other" }, f.ports)).status, "pending");
  assert.equal(f.creatures.length, 1);
  deliveriesConfirmed = true;
  assert.equal((await driver.send(creature, f.ports)).status, "sent");
  assert.equal(f.creatures.length, 1);
});

test("a packed resource card sends its existing package without creating another", async () => {
  const f = fixture(), driver = createWildsWalletAssetSendDriver();
  assert.equal((await driver.send({ attemptId: "wallet:package:one", recipientHandle: "friend", asset: { kind: "package", packageId: "package:existing" } }, f.ports)).status, "sent");
  assert.equal(f.created.size, 0);
  assert.deepEqual(f.transfers, ["package:existing:friend.receiz.id"]);
});

test("duplicate source IDs and self sends fail before source mutation", async () => {
  const f = fixture(), driver = createWildsWalletAssetSendDriver();
  const duplicate = { ...request(), asset: { kind: "inventory" as const, foodItemIds: ["food:one", "food:one"], materialLotIds: [], resourceLotIds: [] } };
  assert.equal((await driver.send(duplicate, f.ports)).status, "failed");
  assert.equal((await driver.send(request("wallet:self", "@Explorer"), f.ports)).status, "failed");
  assert.equal(f.created.size, 0);
  assert.equal(f.transfers.length, 0);
});

test("a known zero-write creature failure permits a corrected review without locking a nonexistent offer", async () => {
  const f = fixture(), driver = createWildsWalletAssetSendDriver();
  const input: WildsWalletAssetSendRequest = { attemptId: "wallet:creature:preflight", recipientHandle: "friend", asset: { kind: "creature", assetId: "creature:one" } };
  f.ports.issueCreatureOffer = async () => { throw new WildsMessageZeroWriteError("The verified recipient identity is unavailable."); };
  assert.equal((await driver.send(input, f.ports)).status, "failed");
  f.ports.issueCreatureOffer = async (assetId, recipient) => { f.creatures.push(`${assetId}:${recipient}`); };
  assert.equal((await driver.send({ ...input, attemptId: "wallet:creature:corrected", recipientHandle: "other" }, f.ports)).status, "sent");
  assert.deepEqual(f.creatures, ["creature:one:other.receiz.id"]);
});
