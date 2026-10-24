import assert from "node:assert/strict";
import { test } from "node:test";
import { sealCollectedCard, wildsCardVerificationDiagnostics } from "../src/features/play/portable-card";
import { createWildzProfileVaultPacket, parseWildzProfileVaultPacket, readWildzProfileVaultPacket, readWildzProfileVaultPacketAsync } from "../src/features/profile/profile-vault-packet";
import { createPublicWildzProfileRecord, parsePublicWildzProfileRecord, publicWildzProfileCards } from "../src/lib/receiz/wildz-profile-record";
import { prepareWildzProfilePageSeed } from "../src/lib/receiz/wildz-profile-page-seed";
import { projectWildzMarketCollection } from "../src/lib/receiz/wildz-market-collection";

const assets = Array.from({ length: 6 }, (_, index) => sealCollectedCard({ capturedAt: "2026-08-11T12:00:00.000Z", encounterId: `packet-profile-${index}`, formId: "mintcub-1", ownerReceizId: "packet_owner" }));
const record = createPublicWildzProfileRecord({ username: "@packet_owner", vault: assets.map(card => ({ id: card.id, name: card.manifest.name, proofDigest: card.proof.digest, visibility: "public" })) }, "https://wildz.quest/u/packet_owner");
const packet = createWildzProfileVaultPacket(assets)!;

test("complete public collection delivery preserves exact card bytes in both decoders", async () => {
  assert.deepEqual(readWildzProfileVaultPacket(packet), assets);
  assert.deepEqual(await readWildzProfileVaultPacketAsync(packet), assets);
  assert.deepEqual(createWildzProfileVaultPacket(assets), packet, "unchanged source bytes produce the same delivery");
  assert.ok(JSON.stringify(packet).length < JSON.stringify(assets).length);
});

test("identical public deliveries reuse admitted immutable cards while checking the requested Vault revision", () => {
  const first = parsePublicWildzProfileRecord({ ...record, vaultPacket: packet })!;
  assert.ok(first);
  const cards = publicWildzProfileCards(first), before = wildsCardVerificationDiagnostics().executions;
  const second = parsePublicWildzProfileRecord(JSON.parse(JSON.stringify({ ...record, vaultPacket: packet })))!;
  assert.equal(publicWildzProfileCards(second)[0], cards[0]);
  assert.equal(Object.isFrozen(cards[0]!.manifest), true);
  assert.equal(wildsCardVerificationDiagnostics().executions, before);
  const revised = structuredClone(record);
  revised.profile.vault[0]!.proofDigest = `sha256:${"0".repeat(64)}`;
  assert.equal(parsePublicWildzProfileRecord({ ...revised, vaultPacket: packet }), null);
});

test("compressed delivery never bypasses the existing full-card proof checks", () => {
  const changed = structuredClone(assets);
  changed[0]!.manifest.name = "altered";
  assert.equal(parsePublicWildzProfileRecord({ ...record, vaultPacket: createWildzProfileVaultPacket(changed) }), null);
  assert.equal(parsePublicWildzProfileRecord({ ...record, vaultPacket: createWildzProfileVaultPacket(assets.slice(0, 4)) }), null, "a published complete collection cannot silently omit later cards");
});

test("malformed and over-budget deliveries fail before they can expand past their declared size", async () => {
  for (const value of [{ ...packet, bytes: 33 * 1024 * 1024 }, { ...packet, data: "!" }, { ...packet, data: "A".repeat(700004) }, { ...packet, private: "omitted" }]) {
    assert.throws(() => parseWildzProfileVaultPacket(value), /packet_invalid/);
  }
  assert.throws(() => readWildzProfileVaultPacket({ ...packet, bytes: 2 }), /packet_invalid/);
  await assert.rejects(readWildzProfileVaultPacketAsync({ ...packet, bytes: 2 }), /packet_invalid/);
  assert.throws(() => readWildzProfileVaultPacket({ ...packet, bytes: packet.bytes + 1 }), /packet_invalid/);
});

test("a cold profile consumes its complete public delivery without separate card recovery", async () => {
  const published = parsePublicWildzProfileRecord({ ...record, vaultPacket: packet })!;
  let reads = 0;
  const seed = await prepareWildzProfilePageSeed(published, async () => { reads++; return null; });
  assert.equal(reads, 0);
  assert.equal(seed.vaultPacket, published.vaultPacket, "the existing delivery is reused without recompression");
  assert.equal(Object.values(seed.values).filter(value => value.status === "ready").length, 2);
  assert.deepEqual(readWildzProfileVaultPacket(seed.vaultPacket!), assets);
});

test("Market consumes the same admitted public collection instead of discarding its carried cards", () => {
  const profile = parsePublicWildzProfileRecord({ ...record, vaultPacket: packet })!;
  const cards = publicWildzProfileCards(profile), market = projectWildzMarketCollection([profile], []);
  assert.equal(market.length, assets.length);
  for (const card of cards) assert.equal(market.find(row => row.assetId === card.id)?.asset, card);
});
