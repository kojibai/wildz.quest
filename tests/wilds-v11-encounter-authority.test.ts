import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { createReceizInMemoryAdmissionStore } from "@receiz/sdk";
import { describe, it } from "node:test";
import { generateWildsRegionV11 } from "../src/features/play/wilds-region-generator-v11";
import { issueWildsV11Encounter } from "../src/lib/receiz/wilds-v11-encounter-authority";

const actorId = "player.receiz.id";
const origin = { worldVersion: 11, regionX: "0", regionZ: "0", localX: 0, localZ: 0 } as const;
const slot = generateWildsRegionV11("0", "0").encounterSites[0]!;
const site = { ...origin, localX: slot.localX, localZ: slot.localZ };

function signer() {
  const keys = generateKeyPairSync("ed25519");
  return { keyId: "test-release-v11", privateKeyPem: keys.privateKey.export({ format: "pem", type: "pkcs8" }).toString(),
    pinnedKeys: { "test-release-v11": keys.publicKey.export({ format: "jwk" }).x! } };
}

describe("durable encounter admission from the player source", () => {
  it("requires the source address near the generated site and issues one repeatable result", async () => {
    const store = createReceizInMemoryAdmissionStore();
    const configured = { store, actorId, playerAddress: origin, site, slot: 0, ...signer() };
    await assert.rejects(issueWildsV11Encounter(configured), /site_not_reached/);
    const reached = { ...configured, playerAddress: site };
    const first = await issueWildsV11Encounter(reached);
    assert.deepEqual(await issueWildsV11Encounter(reached), first);
    assert.deepEqual(await Promise.all([issueWildsV11Encounter(reached), issueWildsV11Encounter(reached)]), [first, first]);
    await assert.rejects(issueWildsV11Encounter({ ...configured, actorId: "other.player" }), /site_not_reached/);
    await assert.rejects(issueWildsV11Encounter({ ...reached, site: { ...site, localX: site.localX + 1 } }), /site_not_generated/);
  });

  it("bounds new site issuances per actor while allowing identical retries", async () => {
    const store = createReceizInMemoryAdmissionStore();
    const signed = signer();
    const start = 100_000;
    const sites = ["0", "1", "2"].flatMap(regionX => generateWildsRegionV11(regionX, "0").encounterSites
      .map((candidate, index) => ({ site: { ...origin, regionX, localX: candidate.localX, localZ: candidate.localZ }, slot: index })));
    const results = [];
    for (let index = 0; index < 12; index += 1) {
      const candidate = sites[index]!;
      const at = start + (index + 1) * 4_000;
      results.push(await issueWildsV11Encounter({ store, actorId, playerAddress: candidate.site, ...candidate, ...signed, issuedAtMs: at }));
    }
    const thirteenth = sites[12]!;
    await assert.rejects(issueWildsV11Encounter({ store, actorId, playerAddress: thirteenth.site, ...thirteenth, ...signed,
      issuedAtMs: start + 13 * 4_000 }), /rate_limited/);
    assert.deepEqual(await issueWildsV11Encounter({ store, actorId, playerAddress: sites[0]!.site, ...sites[0]!, ...signed,
      issuedAtMs: start + 56_000 }), results[0]);
    assert.ok(await issueWildsV11Encounter({ store, actorId, playerAddress: thirteenth.site, ...thirteenth, ...signed,
      issuedAtMs: start + 70_000 }));
  });
});
