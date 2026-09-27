import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { createReceizInMemoryAdmissionStore } from "@receiz/sdk";
import { describe, it } from "node:test";
import { generateWildsRegionV11 } from "../src/features/play/wilds-region-generator-v11";
import { admitWildsV11Travel, issueWildsV11Encounter } from "../src/lib/receiz/wilds-v11-encounter-authority";

const actorId = "player.receiz.id";
const origin = { worldVersion: 11, regionX: "0", regionZ: "0", localX: 0, localZ: 0 } as const;
const slot = generateWildsRegionV11("0", "0").encounterSites[0]!;
const site = { ...origin, localX: slot.localX, localZ: slot.localZ };

function signer() {
  const keys = generateKeyPairSync("ed25519");
  return { keyId: "test-release-v11", privateKeyPem: keys.privateKey.export({ format: "pem", type: "pkcs8" }).toString(),
    pinnedKeys: { "test-release-v11": keys.publicKey.export({ format: "jwk" }).x! } };
}

describe("durable v11 encounter admission", () => {
  it("requires origin and admitted travel before issuing one repeatable result", async () => {
    const store = createReceizInMemoryAdmissionStore();
    await assert.rejects(admitWildsV11Travel(store, actorId, site, 1_000), /origin_required/);
    await admitWildsV11Travel(store, actorId, origin, 1_000);
    const configured = { store, actorId, site, slot: 0, ...signer() };
    await assert.rejects(issueWildsV11Encounter(configured), /site_not_reached/);
    await assert.rejects(admitWildsV11Travel(store, actorId, { ...origin, regionX: "9007199254740993" }, 2_000), /speed_exceeded/);
    await admitWildsV11Travel(store, actorId, site, 2_000);
    const first = await issueWildsV11Encounter(configured);
    assert.deepEqual(await issueWildsV11Encounter(configured), first);
    assert.deepEqual(await Promise.all([issueWildsV11Encounter(configured), issueWildsV11Encounter(configured)]), [first, first]);
    await assert.rejects(issueWildsV11Encounter({ ...configured, actorId: "other.player" }), /site_not_reached/);
    await assert.rejects(issueWildsV11Encounter({ ...configured, site: { ...site, localX: site.localX + 1 } }), /site_not_generated/);
  });

  it("does not grant free distance through repeated zero-time travel requests", async () => {
    const store = createReceizInMemoryAdmissionStore();
    await admitWildsV11Travel(store, actorId, origin, 1_000);
    await assert.rejects(admitWildsV11Travel(store, actorId, { ...origin, localX: 1 }, 1_000), /speed_exceeded/);
    await assert.rejects(admitWildsV11Travel(store, actorId, { ...origin, localX: 1 }, 999), /time_regressed/);
    await admitWildsV11Travel(store, actorId, { ...origin, localX: 12_000 }, 1_001);
  });

  it("serializes simultaneous travel branches under one actor head", async () => {
    const store = createReceizInMemoryAdmissionStore();
    await admitWildsV11Travel(store, actorId, origin, 1_000);
    const branches = await Promise.allSettled([
      admitWildsV11Travel(store, actorId, { ...origin, localX: 1_000_000 }, 2_000),
      admitWildsV11Travel(store, actorId, { ...origin, localZ: 1_000_000 }, 2_000)
    ]);
    assert.equal(branches.filter(branch => branch.status === "fulfilled").length, 1);
    assert.equal(branches.filter(branch => branch.status === "rejected").length, 1);
  });

  it("bounds new site issuances per actor while allowing identical retries", async () => {
    const store = createReceizInMemoryAdmissionStore();
    const signed = signer();
    const start = 100_000;
    await admitWildsV11Travel(store, actorId, origin, start);
    const sites = ["0", "1", "2"].flatMap(regionX => generateWildsRegionV11(regionX, "0").encounterSites
      .map((candidate, index) => ({ site: { ...origin, regionX, localX: candidate.localX, localZ: candidate.localZ }, slot: index })));
    const results = [];
    for (let index = 0; index < 12; index += 1) {
      const candidate = sites[index]!;
      const at = start + (index + 1) * 4_000;
      await admitWildsV11Travel(store, actorId, candidate.site, at);
      results.push(await issueWildsV11Encounter({ store, actorId, ...candidate, ...signed, issuedAtMs: at }));
    }
    const thirteenth = sites[12]!;
    await admitWildsV11Travel(store, actorId, thirteenth.site, start + 13 * 4_000);
    await assert.rejects(issueWildsV11Encounter({ store, actorId, ...thirteenth, ...signed,
      issuedAtMs: start + 13 * 4_000 }), /rate_limited/);
    await admitWildsV11Travel(store, actorId, sites[0]!.site, start + 56_000);
    assert.deepEqual(await issueWildsV11Encounter({ store, actorId, ...sites[0]!, ...signed,
      issuedAtMs: start + 56_000 }), results[0]);
    await admitWildsV11Travel(store, actorId, thirteenth.site, start + 70_000);
    assert.ok(await issueWildsV11Encounter({ store, actorId, ...thirteenth, ...signed,
      issuedAtMs: start + 70_000 }));
  });
});
