import assert from "node:assert/strict";
import { test } from "node:test";
import { admitLocallySealedWildsInventory } from "../src/features/play/admitted-inventory";
import { sealCollectedCard } from "../src/features/play/portable-card";
import { createPublicWildsCardRecord, createPublicWildsCardTransportRecord, parsePublicWildsCardRecord } from "../src/features/play/public-card-record";
import { requireGloballyAvailablePublicWildsCard } from "../src/features/play/public-card-registry";
import { admitWildzVaultProofObjects } from "../src/lib/receiz/wildz-vault-card-admission";

function fixture() {
  const asset = sealCollectedCard({ formId: "mintcub-1", capturedAt: "2026-10-09T00:00:00.000Z", encounterId: "admitted-public-read", ownerReceizId: "public_read_owner" });
  admitLocallySealedWildsInventory([asset]);
  return { asset, record: createPublicWildsCardRecord(asset, "https://wildz.quest", "2026-10-09T00:00:00.000Z") };
}

test("unchanged anonymous reads retain the exact admitted object, including compressed and reordered transport", async () => {
  const { asset, record } = fixture();
  record.asset = Object.fromEntries(Object.entries(record.asset).reverse()) as typeof asset;
  const transport = createPublicWildsCardTransportRecord(record);
  for (const payload of [record, transport, { data: { record: transport } }]) assert.equal(parsePublicWildsCardRecord(payload, asset)?.asset, asset);
  const { proofObjects } = admitWildzVaultProofObjects({ cards: [asset], playerHandle: "public_read_owner" });
  const calls: RequestInit[] = [];
  const fetcher = (async (_url, init) => { calls.push(init!); return Response.json({ ok: true, record: transport }); }) as typeof fetch;
  const result = await requireGloballyAvailablePublicWildsCard(asset, fetcher, { proofObjects });
  assert.equal(result.asset, asset);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "GET");
  assert.equal(calls[0].credentials, "omit");
});

test("matching IDs and head digests cannot conceal any changed proof content", () => {
  const { asset, record } = fixture();
  for (const change of [(r: typeof record) => r.asset.manifest.stats.power++,
    (r: typeof record) => { r.asset.manifest.name = "Substituted creature"; },
    (r: typeof record) => { (r.asset as unknown as Record<string, unknown>).extra = true; },
    (r: typeof record) => { delete (r.asset.manifest as Partial<typeof r.asset.manifest>).name; }]) {
    const changed = structuredClone(record); change(changed);
    assert.equal(changed.asset.proof.digest, asset.proof.digest);
    assert.equal(parsePublicWildsCardRecord(changed, asset), null);
  }
});

test("retaining a local object still validates metadata and never admits an untrusted copy", () => {
  const { asset, record } = fixture();
  for (const changed of [{ ...record, registeredAt: "invalid" }, { ...record, sourceUrl: record.sourceUrl + "?unexpected=1" },
    { ...record, assetId: "wilds:" + "0".repeat(24) }]) assert.equal(parsePublicWildsCardRecord(changed, asset), null);
  const copy = structuredClone(asset);
  assert.notEqual(parsePublicWildsCardRecord(record, copy)?.asset, copy);
  const transport = createPublicWildsCardTransportRecord(record);
  assert.equal(parsePublicWildsCardRecord({ ...transport, sourceUrl: record.sourceUrl + "bad" }, asset), null);
});
