import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { WildsWorldService } from "../src/features/play/wilds-world-service.js";
import { createReceizWildsWorldRepository } from "../src/lib/receiz/wilds-world-repository.js";

const sourceUrl = "https://wildz.quest/api/wilds/world/snapshot";

function record() {
  const service = new WildsWorldService();
  service.tick({ pulse: "2026-07-15T12:00:00.000Z", occurredAt: "2026-07-15T12:00:00.000Z", systemActorId: "receiz:pulse" });
  return { checkpoint: service.checkpoint(), eventTail: service.events() };
}

describe("Receiz Wilds world repository", () => {
  it("recovers only a complete V3 record through SDK app-state envelopes", async () => {
    const expected = record();
    const repository = createReceizWildsWorldRepository({
      adapterFactory: () => ({ readAppStateByUrl: async () => ({ result: { appState: expected } }) }) as never
    });
    assert.deepEqual(await repository.recover(sourceUrl), expected);

    const invalid = createReceizWildsWorldRepository({
      adapterFactory: () => ({ readAppStateByUrl: async () => ({ state: { schema: "receiz.wilds_world_checkpoint.v2" } }) }) as never
    });
    assert.equal(await invalid.recover(sourceUrl), null);
  });

  it("keeps practice isolated without publishing through the SDK", async () => {
    let adapterCalls = 0;
    const repository = createReceizWildsWorldRepository({
      adapterFactory: () => { adapterCalls += 1; return {} as never; }
    });
    const result = await repository.publish({
      sourceUrl,
      actor: { handle: "Explorer", practice: true },
      record: record(),
      expectedHead: { revision: 0, lastEventId: null }
    });
    assert.equal(result.mode, "local_practice");
    assert.equal(result.published, false);
    assert.equal(adapterCalls, 0);
  });

  it("publishes the exact V3 namespace and idempotency key", async () => {
    const calls: Array<{ input: Record<string, unknown>; options: Record<string, unknown> }> = [];
    const worldRecord = record();
    let reads = 0;
    const repository = createReceizWildsWorldRepository({
      adapterFactory: () => ({
        readAppStateByUrl: async () => ({ state: reads++ === 0 ? null : worldRecord }),
        publishPublicStore: async (input: Record<string, unknown>, options: Record<string, unknown>) => {
          calls.push({ input, options });
          return { ok: true, accepted: 1 };
        }
      }) as never
    });
    const result = await repository.publish({
      sourceUrl,
      actor: { handle: "receiz", practice: false, accessToken: "token" },
      record: worldRecord,
      expectedHead: { revision: 0, lastEventId: null }
    });
    assert.equal(result.mode, "receiz_live");
    assert.equal(calls[0]?.input.namespace, "wilds:global:v3");
    assert.equal(calls[0]?.input.sourceUrl, sourceUrl);
    assert.equal("expectedHead" in (calls[0]?.input ?? {}), false);
    assert.equal("mutationMode" in (calls[0]?.input ?? {}), false);
    assert.equal(calls[0]?.options.idempotencyKey, `wilds:global:v3:${worldRecord.checkpoint.revision}:${worldRecord.checkpoint.lastEventId}`);
  });

  it("attributes scoped Vault publication to the artifact principal, never its carried handle", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const worldRecord = record();
    let reads = 0;
    const repository = createReceizWildsWorldRepository({
      adapterFactory: () => ({
        readAppStateByUrl: async () => ({ state: reads++ === 0 ? null : worldRecord }),
        publishPublicStore: async (input: Record<string, unknown>) => {
          calls.push(input);
          return { ok: true, accepted: 1 };
        }
      }) as never
    });

    const result = await repository.publish({
      sourceUrl,
      actor: {
        handle: "bjklock.receiz.id",
        receizActorId: `vault:${"a".repeat(64)}`,
        practice: false
      },
      record: worldRecord,
      expectedHead: { revision: 0, lastEventId: null }
    });

    assert.equal(result.published, true);
    assert.equal(calls[0]?.merchantReceizId, `vault:${"a".repeat(64)}`);
    assert.notEqual(calls[0]?.merchantReceizId, "bjklock.receiz.id");
  });

  it("recognizes an already-synced exact record despite a stale caller head", async () => {
    const remote = record();
    let publishes = 0;
    const repository = createReceizWildsWorldRepository({
      adapterFactory: () => ({
        readAppStateByUrl: async () => ({ state: remote }),
        publishPublicStore: async () => { publishes += 1; return { ok: true }; }
      }) as never
    });
    const publication = await repository.publish({
      sourceUrl,
      actor: { handle: "receiz", practice: false },
      record: remote,
      expectedHead: { revision: 0, lastEventId: null }
    });
    assert.equal(publication.published, true);
    assert.equal(publication.conflict, false);
    assert.deepEqual(publication.record, remote);
    assert.equal(publishes, 0);
  });

  it("fast-forwards a verified local descendant when the remote projection is behind", async () => {
    const older = record();
    const service = new WildsWorldService({ checkpoint: older.checkpoint, events: older.eventTail });
    service.tickEcology({ pulse: "2026-07-15T12:00:01.000Z", occurredAt: "2026-07-15T12:00:01.000Z", systemActorId: "receiz:pulse" });
    const newer = { checkpoint: service.checkpoint(), eventTail: service.events() };
    let reads = 0;
    let publishes = 0;
    const repository = createReceizWildsWorldRepository({ adapterFactory: () => ({
      readAppStateByUrl: async () => ({ state: reads++ === 0 ? older : newer }),
      publishPublicStore: async () => { publishes += 1; return { ok: true, accepted: 1 }; }
    }) as never });
    const publication = await repository.publish({ sourceUrl, actor: { handle: "receiz", practice: false }, record: newer,
      expectedHead: { revision: newer.checkpoint.revision, lastEventId: newer.checkpoint.lastEventId } });
    assert.equal(publication.published, true);
    assert.equal(publishes, 1);
  });

  it("reports publication and audit failures without claiming canonical durability", async () => {
    const repository = createReceizWildsWorldRepository({
      adapterFactory: () => ({
        publishPublicStore: async () => ({ ok: false }),
        auditAppend: async () => { throw new Error("offline"); }
      }) as never
    });
    const publication = await repository.publish({
      sourceUrl,
      actor: { handle: "receiz", practice: false },
      record: record(),
      expectedHead: { revision: 0, lastEventId: null }
    });
    assert.equal(publication.mode, "receiz_recovery_pending");
    assert.equal(publication.published, false);
    assert.equal(await repository.audit({
      sourceUrl,
      actor: { handle: "receiz", practice: false },
      events: record().eventTail
    }), false);
  });

  it("fails closed when the supported feed response does not confirm an accepted record", async () => {
    const worldRecord = record();
    const repository = createReceizWildsWorldRepository({
      adapterFactory: () => ({
        readAppStateByUrl: async () => ({ state: null }),
        publishPublicStore: async () => ({ ok: true, state: worldRecord })
      }) as never
    });
    const publication = await repository.publish({
      sourceUrl,
      actor: { handle: "receiz", practice: false },
      record: worldRecord,
      expectedHead: { revision: 0, lastEventId: null }
    });
    assert.equal(publication.published, false);
    assert.equal(publication.mode, "receiz_recovery_pending");
  });

  it("serializes every canonical mutation and rehydrates a competing remote winner", () => {
    const source = readFileSync("src/lib/receiz/wilds-world-server.ts", "utf8");
    const multiplayer = readFileSync("src/lib/receiz/wilds-multiplayer-server.ts", "utf8");
    assert.match(source, /serializeWildsWorldMutation/);
    assert.match(source, /mutationQueueKey/);
    assert.match(source, /recoverCanonicalWorldBeforeMutation/);
    assert.match(source, /worldRecordContainsHead/);
    assert.match(source, /wilds_world_canonical_conflict/);
    assert.match(multiplayer, /sameWildzPlayerCoordinate/);
    assert.doesNotMatch(multiplayer, /owner !== "wilds\.player\.receiz\.id"/);
  });
});
