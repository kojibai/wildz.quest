import assert from "node:assert/strict";
import { test } from "node:test";
import { readWildsStoredRoamingHandoff, storeWildsRoamingHandoff, readWildsRoamingClaimResult, storeWildsRoamingClaimResult,
  wildsRoamingCaptureSourceUrl, type WildsStoredRoamingHandoff, type WildsRoamingClaimResult } from "../src/lib/receiz/wilds-roaming-capture-store";
import { sealWildsRoamingTransport } from "../src/lib/receiz/wilds-roaming-transport-integrity";
import type { createReceizCommerceAdapter } from "../src/lib/receiz/adapter";

// Storage rail mock verifies transport privacy/integrity, never native ownership.
test("private capture store roundtrips encrypted envelope and rejects tampering or wrong purpose", async () => {
  const prior = process.env.RECEIZ_OAUTH_STATE_SECRET;
  process.env.RECEIZ_OAUTH_STATE_SECRET = "test-roaming-store-secret-at-least-32-bytes";
  try {
    let value: unknown; let visibility: unknown;
    const adapter = { client: { appState: { publish: async (input: { state: unknown; visibility: unknown }) => {
      value = input.state; visibility = input.visibility; return { ok: true };
    } } }, readAppStateByUrl: async () => ({ state: value }) } as unknown as ReturnType<typeof createReceizCommerceAdapter>;
    const row = { schema: "wildz.roaming-capture-transport.v1", battleId: "roaming:test", ownerPlayerId: "owner", winnerPlayerId: "winner",
      winnerReceizId: "receiz:winner", expiresAtUPulse: 123, handoff: { schema: "wildz.roaming-handoff.v1", battleId: "roaming:test", source: { exactBytesB64u: "PRIVATE_ORIGINAL_BEARER_BYTES" }, currentCard: { manifest: { name: "PRIVATE_CREATURE_NAME" } } } } as WildsStoredRoamingHandoff;
    await storeWildsRoamingHandoff("https://wildz.quest", "owner", row, adapter);
    assert.equal(visibility, "private");
    assert.doesNotMatch(JSON.stringify(value), /PRIVATE_ORIGINAL|PRIVATE_CREATURE|manifest|exactBytesB64u/);
    const encrypted = structuredClone(value) as { ciphertext: string };
    value = { ...encrypted, ciphertext: (encrypted.ciphertext.startsWith("A") ? "B" : "A") + encrypted.ciphertext.slice(1) };
    await assert.rejects(readWildsStoredRoamingHandoff("https://wildz.quest", row.battleId, adapter), /transport_invalid/);
    value = encrypted;
    assert.deepEqual(await readWildsStoredRoamingHandoff("https://wildz.quest", row.battleId, adapter), row);
    value = { ...(value as object), record: { ...row, winnerReceizId: "intruder" } };
    await assert.rejects(readWildsStoredRoamingHandoff("https://wildz.quest", row.battleId, adapter), /transport_invalid/);
    value = sealWildsRoamingTransport(row, "wildz.roaming-capture-result.v1");
    await assert.rejects(readWildsStoredRoamingHandoff("https://wildz.quest", row.battleId, adapter), /transport_invalid/);
    value = sealWildsRoamingTransport({ ...row, schema: "wrong" }, "wildz.roaming-capture-offer.v1");
    await assert.rejects(readWildsStoredRoamingHandoff("https://wildz.quest", row.battleId, adapter), /transport_invalid/);
  } finally { if (prior === undefined) delete process.env.RECEIZ_OAUTH_STATE_SECRET; else process.env.RECEIZ_OAUTH_STATE_SECRET = prior; }
});

test("completed-result locator supports longest accepted encounter ID and independently authenticated result", async () => {
  const prior = process.env.RECEIZ_OAUTH_STATE_SECRET;
  process.env.RECEIZ_OAUTH_STATE_SECRET = "test-roaming-store-secret-at-least-32-bytes";
  try {
    let value: unknown;
    const adapter = { client: { appState: { publish: async (input: { state: unknown; visibility: unknown }) => {
      assert.equal(input.visibility, "private"); value = input.state; return { ok: true };
    } } }, readAppStateByUrl: async () => value } as unknown as ReturnType<typeof createReceizCommerceAdapter>;
    const battleId = "a".repeat(160);
    const result = { schema: "wildz.roaming-claim-result.v1", battleId, winnerReceizId: "winner", card: {}, artifact: {} } as WildsRoamingClaimResult;
    await storeWildsRoamingClaimResult("https://wildz.quest", result, adapter);
    assert.deepEqual(await readWildsRoamingClaimResult("https://wildz.quest", battleId, adapter), result);
    assert.match(wildsRoamingCaptureSourceUrl("https://wildz.quest", `${battleId}:claimed`), /%3Aclaimed$/);
  } finally { if (prior === undefined) delete process.env.RECEIZ_OAUTH_STATE_SECRET; else process.env.RECEIZ_OAUTH_STATE_SECRET = prior; }
});

test("missing persisted offer/result is empty only for structured 404, never for outages", async () => {
  const missing = { readAppStateByUrl: async () => { throw Object.assign(new Error("missing"), { status: 404 }); } } as unknown as ReturnType<typeof createReceizCommerceAdapter>;
  assert.equal(await readWildsStoredRoamingHandoff("https://wildz.quest", "roaming:test", missing), null);
  assert.equal(await readWildsRoamingClaimResult("https://wildz.quest", "roaming:test", missing), null);
  const unavailable = { readAppStateByUrl: async () => { throw Object.assign(new Error("unavailable"), { status: 500 }); } } as unknown as ReturnType<typeof createReceizCommerceAdapter>;
  await assert.rejects(readWildsRoamingClaimResult("https://wildz.quest", "roaming:test", unavailable), /unavailable/);
});
