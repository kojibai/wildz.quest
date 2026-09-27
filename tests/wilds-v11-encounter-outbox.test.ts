import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { describe, it } from "node:test";
import { emptyWildsV11EncounterOutbox, enqueueWildsV11Site, flushOneWildsV11Site,
  restoreWildsV11EncounterOutbox } from "../src/features/play/wilds-encounter-outbox-v11";
import { generateWildsRegionV11 } from "../src/features/play/wilds-region-generator-v11";
import { offsetWildsWorldAddress } from "../src/features/play/wilds-world-address";
import { signWildsV11Encounter } from "../src/lib/receiz/wilds-v11-encounter-signer";

const actorId = "player.test";
const candidate = generateWildsRegionV11("0", "0").encounterSites[0]!;
const site = { worldVersion: 11, regionX: "0", regionZ: "0",
  localX: candidate.localX, localZ: candidate.localZ } as const;
const item = { actorId, site, slot: candidate.slot };
const keys = generateKeyPairSync("ed25519");
const keyId = "test-outbox-v11";
const pinnedKeys = { [keyId]: keys.publicKey.export({ format: "jwk" }).x! };
const result = signWildsV11Encounter({ schema: "wildz.encounter-input.v11", keyId,
  law: "wildz.rarity.v11", ...item }, keys.privateKey.export({ format: "pem", type: "pkcs8" }).toString());

describe("offline encounter observations", () => {
  it("keeps only exact owner-bound generated sites and deduplicates retries", () => {
    const once = enqueueWildsV11Site(emptyWildsV11EncounterOutbox(), item);
    const twice = enqueueWildsV11Site(once, item);
    assert.equal(twice.pending.length, 1);
    assert.deepEqual(restoreWildsV11EncounterOutbox(JSON.parse(JSON.stringify(twice)), actorId), twice);
    assert.equal(restoreWildsV11EncounterOutbox(twice, "another.player").pending.length, 0);
    assert.throws(() => enqueueWildsV11Site(twice, { ...item, site: { ...site, localX: site.localX + 1 } }), /invalid/);
  });

  it("restores a historical owner handle under its canonical profile coordinate", () => {
    const old = enqueueWildsV11Site(emptyWildsV11EncounterOutbox(), { ...item, actorId: "keeper" });
    const restored = restoreWildsV11EncounterOutbox(JSON.parse(JSON.stringify(old)), "keeper.receiz.id");
    assert.equal(restored.pending.length, 1);
    assert.equal(restored.pending[0]?.actorId, "keeper.receiz.id");
    assert.equal(restoreWildsV11EncounterOutbox(old, "other.receiz.id").pending.length, 0);
  });

  it("does not query distant sites or turn an offline observation into a rarity", async () => {
    const outbox = enqueueWildsV11Site(emptyWildsV11EncounterOutbox(), item);
    const fetcher = (async () => { throw new Error("offline"); }) as typeof fetch;
    const distant = await flushOneWildsV11Site({ outbox, actorId,
      playerAddress: offsetWildsWorldAddress(site, 4_000_000n, 0n), fetcher, pinnedKeys });
    assert.equal(distant.kind, "no-nearby");
    assert.equal(distant.outbox.pending.length, 1);
    const nearby = await flushOneWildsV11Site({ outbox, actorId, playerAddress: site, fetcher, pinnedKeys });
    assert.equal(nearby.kind, "pending");
    assert.equal(nearby.birth, undefined);
    assert.equal(nearby.outbox.pending.length, 1);
  });

  it("replays one nearby request, verifies the signed birth, and removes only that item", async () => {
    const outbox = enqueueWildsV11Site(emptyWildsV11EncounterOutbox(), item);
    const actions: string[] = [];
    const fetcher = (async (_url: string | URL | Request, init?: RequestInit) => {
      const action = JSON.parse(String(init?.body)).action as string;
      actions.push(action);
      return new Response(JSON.stringify(action === "travel"
        ? { ok: true, head: { actorId, address: site } }
        : { ok: true, result }), { status: 200, headers: { "content-type": "application/json" } });
    }) as typeof fetch;
    const admitted = await flushOneWildsV11Site({ outbox, actorId, playerAddress: site, fetcher, pinnedKeys });
    assert.deepEqual(actions, ["travel", "encounter"]);
    assert.equal(admitted.kind, "admitted");
    assert.equal(admitted.birth?.birth.identity.actorId, actorId);
    assert.equal(admitted.outbox.pending.length, 0);
  });
});
