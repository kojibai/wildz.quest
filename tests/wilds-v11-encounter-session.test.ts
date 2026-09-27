import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { describe, it } from "node:test";
import { admitLocallySealedWildsInventory } from "../src/features/play/admitted-inventory";
import { enqueueWildsV11Site, emptyWildsV11EncounterOutbox } from "../src/features/play/wilds-encounter-outbox-v11";
import { resolveWildsV11EncounterSession } from "../src/features/play/wilds-encounter-session-v11";
import { sealCollectedCard } from "../src/features/play/portable-card";
import { generateWildsRegionV11 } from "../src/features/play/wilds-region-generator-v11";
import { signWildsV11Encounter } from "../src/lib/receiz/wilds-v11-encounter-signer";

const actorId = "player.test";
const generated = generateWildsRegionV11("0", "0").encounterSites[0]!;
const site = { worldVersion: 11, regionX: "0", regionZ: "0",
  localX: generated.localX, localZ: generated.localZ } as const;
const slot = generated.slot;
const outbox = enqueueWildsV11Site(emptyWildsV11EncounterOutbox(), { actorId, site, slot });
const keys = generateKeyPairSync("ed25519");
const keyId = "test-session-v11";
const pinnedKeys = { [keyId]: keys.publicKey.export({ format: "jwk" }).x! };
const result = signWildsV11Encounter({ schema: "wildz.encounter-input.v11", keyId,
  law: "wildz.rarity.v11", actorId, site, slot }, keys.privateKey.export({ format: "pem", type: "pkcs8" }).toString());

function leader() {
  const card = sealCollectedCard({ formId: "mintcub-1", ownerReceizId: actorId,
    encounterId: "starter:session", capturedAt: "2026-09-27T12:00:00.000Z" });
  admitLocallySealedWildsInventory([card]);
  return card;
}

describe("ordinary nearby site to verified battle boundary", () => {
  it("admits the signed site before projecting its real procedural opponent", async () => {
    const actorCard = leader();
    const actions: string[] = [];
    const fetcher = (async (_url: string | URL | Request, init?: RequestInit) => {
      const action = JSON.parse(String(init?.body)).action as string;
      actions.push(action);
      return new Response(JSON.stringify(action === "travel" ? { ok: true, head: { actorId, address: site } }
        : { ok: true, result }), { status: 200, headers: { "content-type": "application/json" } });
    }) as typeof fetch;
    const session = await resolveWildsV11EncounterSession({ outbox, actorId, playerAddress: site, target: { site, slot },
      leader: actorCard, fetcher, pinnedKeys });
    assert.equal(session.kind, "ready");
    assert.deepEqual(actions, ["travel", "encounter"]);
    if (session.kind !== "ready") return;
    assert.equal(session.outbox.pending.length, 0);
    assert.equal(session.session.battle.wild.power, session.session.birth.birth.stats.power);
  });

  it("retains offline observations and rejects a fabricated leader before making a request", async () => {
    const actorCard = leader();
    const fetcher = (async () => { throw new Error("offline"); }) as typeof fetch;
    const pending = await resolveWildsV11EncounterSession({ outbox, actorId, playerAddress: site, target: { site, slot },
      leader: actorCard, fetcher, pinnedKeys });
    assert.equal(pending.kind, "pending");
    assert.equal(pending.outbox.pending.length, 1);
    await assert.rejects(() => resolveWildsV11EncounterSession({ outbox, actorId, playerAddress: site, target: { site, slot },
      leader: structuredClone(actorCard), fetcher, pinnedKeys }), /leader_unadmitted/);
  });

  it("does not substitute an older nearby observation for the site just selected", async () => {
    let requests = 0;
    const fetcher = (async () => { requests += 1; throw new Error("unexpected request"); }) as typeof fetch;
    const other = generateWildsRegionV11("0", "0").encounterSites[1]!;
    const selected = { worldVersion: 11, regionX: "0", regionZ: "0",
      localX: other.localX, localZ: other.localZ } as const;
    const pending = await resolveWildsV11EncounterSession({ outbox, actorId, playerAddress: site,
      target: { site: selected, slot: other.slot }, leader: leader(), fetcher, pinnedKeys });
    assert.equal(pending.kind, "no-nearby");
    assert.equal(requests, 0);
  });
});
