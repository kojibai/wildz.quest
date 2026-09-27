import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { describe, it } from "node:test";
import { admitWildsV11EncounterFromSite } from "../src/features/play/wilds-encounter-client-v11";
import { verifyWildsV11Birth } from "../src/features/play/wilds-card-proof-v11";
import { generateWildsRegionV11 } from "../src/features/play/wilds-region-generator-v11";
import { signWildsV11Encounter } from "../src/lib/receiz/wilds-v11-encounter-signer";

const actorId = "player.test";
const generated = generateWildsRegionV11("0", "0").encounterSites[0]!;
const site = { worldVersion: 11, regionX: "0", regionZ: "0", localX: generated.localX, localZ: generated.localZ } as const;
const keys = generateKeyPairSync("ed25519");
const pinnedKeys = { "test-client": keys.publicKey.export({ format: "jwk" }).x! };
const result = signWildsV11Encounter({ schema: "wildz.encounter-input.v11", keyId: "test-client",
  law: "wildz.rarity.v11", actorId, site, slot: 0 }, keys.privateKey.export({ format: "pem", type: "pkcs8" }).toString());

function transport(replies: object[]) {
  const calls: Array<{ action: string; body: Record<string, unknown> }> = [];
  const fetcher = (async (_url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    calls.push({ action: String(body.action), body });
    return new Response(JSON.stringify(replies.shift()), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  return { calls, fetcher };
}

const travel = { ok: true, head: { actorId, address: site } };

describe("browser encounter admission boundary", () => {
  it("admits travel before the site and verifies a one-of-one birth locally", async () => {
    const { calls, fetcher } = transport([travel, { ok: true, result }]);
    const birth = await admitWildsV11EncounterFromSite({ actorId, playerAddress: site, site, slot: 0, fetcher, pinnedKeys });
    assert.deepEqual(calls.map(call => call.action), ["travel", "encounter"]);
    assert.deepEqual(calls[0]!.body.address, site);
    assert.deepEqual(calls[1]!.body.site, site);
    assert.equal(await verifyWildsV11Birth(birth, pinnedKeys), true);
    assert.equal(birth.birth.identity.actorId, actorId);
  });

  it("rejects a response for a different actor, site, or altered signed rarity", async () => {
    const altered = { ...result, className: result.className === "rare" ? "trail" : "rare" };
    for (const reply of [
      { ...result, input: { ...result.input, actorId: "another.player" } },
      { ...result, input: { ...result.input, site: { ...site, localX: site.localX + 1 } } },
      altered
    ]) {
      const { fetcher } = transport([travel, { ok: true, result: reply }]);
      await assert.rejects(admitWildsV11EncounterFromSite({ actorId, playerAddress: site, site, slot: 0,
        fetcher, pinnedKeys }), /wilds_v11_/);
    }
  });

  it("stops before revealing a result when travel is unconfirmed or the connection fails", async () => {
    const badHead = transport([{ ok: true, head: { actorId, address: { ...site, localX: site.localX + 1 } } }]);
    await assert.rejects(admitWildsV11EncounterFromSite({ actorId, playerAddress: site, site, slot: 0,
      fetcher: badHead.fetcher, pinnedKeys }), /travel_reply_invalid/);
    assert.deepEqual(badHead.calls.map(call => call.action), ["travel"]);
    const offline = (async () => { throw new Error("offline"); }) as typeof fetch;
    await assert.rejects(admitWildsV11EncounterFromSite({ actorId, playerAddress: site, site, slot: 0,
      fetcher: offline, pinnedKeys }), /connection_pending/);
  });
});
