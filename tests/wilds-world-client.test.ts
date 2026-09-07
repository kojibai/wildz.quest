import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { initialWildsWorldProjection } from "../src/features/play/wilds-world-state.js";
import { deriveKaiKlokMomentFromUPulse } from "../src/features/play/kai-klok-moment.js";
import { createKaiTemporalRoot } from "../src/features/play/kai-temporal-root.js";
import { createReceizInMemoryOfflineProofQueueStorage } from "@receiz/sdk";
import { acknowledgeWildsWorldCommand, createWildsWorldEdgeAdmissionQueue, enqueueWildsWorldCommand, readWildsWorldOutbox } from "../src/features/play/wilds-world-outbox.js";
import { WILDS_WORLD_OFFLINE_MESSAGE, WILDS_NETWORK_RETRY_BACKOFF_MS } from "../src/features/play/wilds-network-status.js";
import {
  acceptWildsWorldSnapshot,
  buildWildsWorldCommandBody,
  parseWildsWorldCommandResponse,
  parseWildsWorldSnapshotResponse,
  shouldQueueWildsWorldCommandLocally,
  shouldSynchronizeWildsWorldCommandAfterPaint,
  wildsWorldModeAfterConfirmedBootstrap,
  wildsWorldModeAfterRequestFailure,
  refreshWildsWorldClient
} from "../src/features/play/use-wilds-world.js";

describe("Wilds world client contract", () => {
  const kai = createKaiTemporalRoot(deriveKaiKlokMomentFromUPulse({ uPulse: 7_654_321_000, authority: "local" }));
  it("never rolls a client back to an older canonical revision", () => {
    const current = { ...initialWildsWorldProjection(), revision: 8 };
    const stale = { ...initialWildsWorldProjection(), revision: 7 };
    const fresh = { ...initialWildsWorldProjection(), revision: 9 };

    assert.equal(acceptWildsWorldSnapshot(current, stale), current);
    assert.equal(acceptWildsWorldSnapshot(current, fresh), fresh);
  });

  it("admits work locally until the shared projection exists", () => {
    assert.equal(shouldQueueWildsWorldCommandLocally({ commandPending: false, networkEnabled: true, networkAvailable: true, canonicalAvailable: false }), true);
    assert.equal(shouldQueueWildsWorldCommandLocally({ commandPending: false, networkEnabled: true, networkAvailable: true, canonicalAvailable: true }), false);
  });

  it("updates the local source projection before attempting global synchronization", () => {
    const source = readFileSync("src/features/play/use-wilds-world.ts", "utf8");
    const admit = source.indexOf("const locallyAdmittedProjection = await edgeQueue.admit(entry)");
    const send = source.indexOf("await sendEntry(entry)", admit);
    assert.ok(admit >= 0 && send > admit);
    const queue = readFileSync("src/features/play/wilds-world-outbox.ts", "utf8");
    assert.ok(queue.indexOf("await input.persist(durable)") < queue.indexOf("input.onAdmitted?.(projection,"));
    assert.match(source, /return synchronizedProjection/);
    const acknowledgement = source.indexOf("await acknowledgeWildsWorldPublication(entry, parsed)", send);
    const synchronized = source.indexOf("const synchronizedProjection", acknowledgement);
    assert.ok(acknowledgement > send && synchronized > acknowledgement);
  });

  it("keeps material harvest network work out of the visible action path", () => {
    assert.equal(shouldSynchronizeWildsWorldCommandAfterPaint({ type: "resource.material.harvest" } as never), true);
    assert.equal(shouldSynchronizeWildsWorldCommandAfterPaint({ type: "team.create" } as never), false);
    for (const type of ["construction.project.create", "construction.component.place", "construction.component.deposit", "construction.component.work"]) assert.equal(shouldSynchronizeWildsWorldCommandAfterPaint({ type } as never), true);
    const source = readFileSync("src/features/play/use-wilds-world.ts", "utf8");
    assert.match(source, /scheduleWildsWorldBackgroundSync/);
    assert.match(source, /return locallyAdmittedProjection/);
  });

  it("builds one explicit guest-aware command envelope", () => {
    assert.deepEqual(buildWildsWorldCommandBody("guest-12345678", { type: "raid.join", bossId: "boss:one", commandId: "command:one", kai }), {
      guestId: "guest-12345678",
      command: { type: "raid.join", bossId: "boss:one", commandId: "command:one", kai }
    });
  });

  it("sends sealed card material only for semantic raid actions", () => {
    const card = { id: "card:one", proof: { digest: `sha256:${"a".repeat(64)}` } } as never;
    const cardAdmission = { schema: "receiz.wilds.vault_card_membership.v1", leafIndex: 0 } as never;
    assert.deepEqual(buildWildsWorldCommandBody("guest-12345678", { type: "raid.act", bossId: "boss:one", roundId: "round:one", intent: "strike", commandId: "command:act" }, card, cardAdmission), {
      guestId: "guest-12345678",
      command: { type: "raid.act", bossId: "boss:one", roundId: "round:one", intent: "strike", commandId: "command:act" },
      card,
      cardAdmission
    });
  });

  it("accepts exactly one projection and mode layer", () => {
    const projection = initialWildsWorldProjection();
    assert.deepEqual(parseWildsWorldSnapshotResponse({ ok: true, projection, mode: "kai_live" }), {
      projection,
      mode: "kai_live"
    });
    assert.deepEqual(parseWildsWorldSnapshotResponse({ ok: true, projection, mode: "local_practice" }), {
      projection,
      mode: "local_practice"
    });
    assert.throws(() => parseWildsWorldSnapshotResponse({ ok: true, projection: { projection, mode: "local_practice" }, mode: "local_practice" }), /wilds_world_snapshot_invalid/);
    assert.throws(() => parseWildsWorldSnapshotResponse({ ok: true, projection, mode: "unknown" }), /wilds_world_snapshot_invalid/);
  });

  it("accepts a recovery mode only from a flat command response", () => {
    const projection = initialWildsWorldProjection();
    assert.deepEqual(parseWildsWorldCommandResponse({ ok: true, projection, mode: "receiz_recovery_pending" }), {
      projection,
      mode: "receiz_recovery_pending"
    });
    assert.throws(() => parseWildsWorldCommandResponse({ ok: true, projection, publication: { mode: "receiz_live" } }), /wilds_world_command_response_invalid/);
  });

  it("spreads the server snapshot into the route response", () => {
    const route = readFileSync("app/api/wilds/world/snapshot/route.ts", "utf8");
    assert.match(route, /ok:\s*true,\s*\.\.\.await worldSnapshot/);
    assert.doesNotMatch(route, /projection:\s*await worldSnapshot/);
  });

  it("never exposes a Receiz navigation target from world APIs", () => {
    for (const path of ["bootstrap", "snapshot", "command"]) {
      const route = readFileSync(`app/api/wilds/world/${path}/route.ts`, "utf8");
      assert.doesNotMatch(route, /connectUrl|wildsWorldConnectUrl|\/api\/auth\/receiz\/start/);
    }
  });

  it("publishes proof-native command transitions with the active Identity Seal", () => {
    const source = readFileSync("src/features/play/use-wilds-world.ts", "utf8");
    const request = source.indexOf('request("/api/wilds/world/command"');
    const publish = source.indexOf("publishActiveWildsWorldWithIdentityProof", request);
    const parse = source.indexOf("parseWildsWorldCommandResponse", publish);
    assert.ok(request >= 0 && publish > request && parse > publish);
    assert.doesNotMatch(source.slice(request, parse), /connectUrl|window\.location|receiz\.com/);
  });

  it("keeps online request failures reconnecting even when the request carries a guest id", () => {
    const source = readFileSync("src/features/play/use-wilds-world.ts", "utf8");

    assert.equal(wildsWorldModeAfterRequestFailure(false, "connecting"), "reconnecting");
    assert.equal(wildsWorldModeAfterRequestFailure(false, "receiz_live"), "receiz_live");
    assert.equal(wildsWorldModeAfterRequestFailure(false, "kai_live"), "kai_live");
    assert.equal(wildsWorldModeAfterRequestFailure(true, "receiz_live"), "receiz_recovery_pending");
    assert.doesNotMatch(source, /offline\s*\|\|\s*input\.guestId/);
    assert.doesNotMatch(source, /window\.location\.assign|\/api\/auth\/receiz\/start|connectUrl/);
  });

  it("enters the Kai-connected mode immediately after proof-native identity admission", () => {
    assert.equal(wildsWorldModeAfterConfirmedBootstrap("connecting"), "kai_live");
    assert.equal(wildsWorldModeAfterConfirmedBootstrap("reconnecting"), "reconnecting");
    assert.equal(wildsWorldModeAfterConfirmedBootstrap("local_practice"), "local_practice");
  });

});

describe("construction refresh status", () => {
  async function fixture(settled = true) {
    const actorId = "refresh-builder.receiz.id";
    const storage = createReceizInMemoryOfflineProofQueueStorage();
    const queue = createWildsWorldEdgeAdmissionQueue({ initialProjection: initialWildsWorldProjection(), persist: (entry) => enqueueWildsWorldCommand(entry, storage) });
    const command = { type: "construction.project.create" as const, name: "Local Home", region: { x: 0, z: 0 }, commandId: "command:refresh:home" };
    await queue.admit({ schema: "receiz.wilds_world_outbox_entry.v1", actorId, guestId: "guest-12345678", command, queuedAt: "2026-08-26T00:00:00.000Z" });
    if (settled) await acknowledgeWildsWorldCommand(actorId, command.commandId, storage);
    const calls: string[] = [];
    const input: Parameters<typeof refreshWildsWorldClient>[0] = {
      current: queue.current,
      currentMode: () => "connecting",
      networkAvailable: () => true,
      readPending: () => readWildsWorldOutbox(actorId, storage),
      requestSnapshot: async () => { calls.push("snapshot"); return { projection: initialWildsWorldProjection(), mode: "receiz_live" }; },
      adopt: queue.adopt,
      flush: async (projection, mode) => { calls.push("flush"); return { projection, mode }; }
    };
    return { input, queue, calls, actorId, storage, command };
  }

  it("reports offline status after all construction has settled without discarding local history", async () => {
    const { input, queue, calls } = await fixture();
    const admitted = queue.current();
    const result = await refreshWildsWorldClient({ ...input, networkAvailable: () => false });
    assert.equal(result?.mode, "receiz_recovery_pending");
    assert.equal(result?.error, WILDS_WORLD_OFFLINE_MESSAGE);
    assert.equal(queue.current(), admitted);
    assert.deepEqual(calls, []);
  });

  it("settled receipts do not preflush or freeze a recovered connection mode", async () => {
    const { input, queue, calls } = await fixture();
    const admitted = queue.current();
    const result = await refreshWildsWorldClient(input);
    assert.equal(result?.mode, "receiz_live");
    assert.equal(result?.error, "");
    assert.equal(result?.projection, admitted);
    assert.deepEqual(calls, ["snapshot", "flush"]);
    assert.equal(Object.keys(queue.current().constructionCommandReceipts).length, 1);
  });

  it("surfaces opaque outages with backoff and explicit proof failures despite retained receipts", async () => {
    const { input, queue } = await fixture();
    const admitted = queue.current();
    const before = Date.now();
    const outage = await refreshWildsWorldClient({ ...input, requestSnapshot: async () => { throw new TypeError("Failed to fetch"); } });
    assert.equal(outage?.mode, "receiz_recovery_pending");
    assert.equal(outage?.error, WILDS_WORLD_OFFLINE_MESSAGE);
    assert.ok(outage?.retryAfter && outage.retryAfter >= before + WILDS_NETWORK_RETRY_BACKOFF_MS);
    const invalid = await refreshWildsWorldClient({ ...input, requestSnapshot: async () => { throw new Error("wilds_world_snapshot_invalid"); } });
    assert.equal(invalid?.mode, "reconnecting");
    assert.equal(invalid?.error, "wilds_world_snapshot_invalid");
    assert.equal(queue.current(), admitted);
  });

  it("reports remaining unpublished work until its exact entry settles, then resumes live mode", async () => {
    const { input, calls, actorId, storage, command } = await fixture(false);
    const pending = await refreshWildsWorldClient(input);
    assert.equal(pending?.mode, "receiz_recovery_pending");
    assert.ok(pending?.error);
    assert.deepEqual(calls, ["flush", "snapshot", "flush"]);
    await acknowledgeWildsWorldCommand(actorId, command.commandId, storage);
    calls.length = 0;
    const settled = await refreshWildsWorldClient(input);
    assert.equal(settled?.mode, "receiz_live");
    assert.equal(settled?.error, "");
    assert.deepEqual(calls, ["snapshot", "flush"]);
  });
});
