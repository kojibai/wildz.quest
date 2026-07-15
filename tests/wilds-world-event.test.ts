import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  compareWildsWorldEvents,
  createWildsWorldEvent,
  verifyWildsWorldEvent,
  WILDS_WORLD_ID
} from "../src/features/play/wilds-world-event.js";
import {
  checkpointWildsWorld,
  initialWildsWorldProjection,
  replayWildsWorld
} from "../src/features/play/wilds-world-state.js";

const firstInput = {
  kind: "site.spawned" as const,
  actorId: "receiz:pulse",
  causeId: "pulse:2026-07-15T12:00:00.000Z",
  pulse: "2026-07-15T12:00:00.000Z",
  kaiKlok: 1,
  occurredAt: "2026-07-15T12:00:00.000Z",
  previousEventId: null,
  payload: { siteId: "site:crystal-burrow:genesis", position: { x: 144, z: 96 } }
};

describe("Wilds world event", () => {
  it("creates one stable hash-addressed event from canonical facts", () => {
    const first = createWildsWorldEvent(firstInput);
    const replay = createWildsWorldEvent({ ...firstInput, payload: { position: { z: 96, x: 144 }, siteId: "site:crystal-burrow:genesis" } });

    assert.equal(first.worldId, WILDS_WORLD_ID);
    assert.equal(first.schema, "receiz.wilds_world_event.v3");
    assert.match(first.eventId, /^wve:[a-f0-9]{64}$/);
    assert.match(first.digest, /^sha256:[a-f0-9]{64}$/);
    assert.equal(replay.eventId, first.eventId);
    assert.deepEqual(verifyWildsWorldEvent(first), { ok: true, errors: [] });
  });

  it("orders Kai-Klok deterministically within one Pulse", () => {
    const first = createWildsWorldEvent(firstInput);
    const second = createWildsWorldEvent({
      ...firstInput,
      kind: "site.phase_changed",
      kaiKlok: 2,
      previousEventId: first.eventId,
      payload: { siteId: first.payload.siteId, phase: "tracked" }
    });

    assert.equal(compareWildsWorldEvents(first, second), -1);
    assert.deepEqual(verifyWildsWorldEvent(second, first), { ok: true, errors: [] });
  });

  it("rejects corrupted payloads and broken causal continuity", () => {
    const first = createWildsWorldEvent(firstInput);
    const second = createWildsWorldEvent({
      ...firstInput,
      kind: "site.phase_changed",
      kaiKlok: 2,
      previousEventId: first.eventId,
      payload: { siteId: first.payload.siteId, phase: "tracked" }
    });
    const corrupt = { ...second, payload: { ...second.payload, phase: "defeated" } };

    assert.equal(verifyWildsWorldEvent(corrupt, first).ok, false);
    assert.equal(verifyWildsWorldEvent(second, null).errors.includes("wilds_world_previous_event_invalid"), true);
  });

  it("refuses malformed identities, timestamps, clocks, and non-finite payloads", () => {
    assert.throws(() => createWildsWorldEvent({ ...firstInput, actorId: "" }), /wilds_world_actor_invalid/);
    assert.throws(() => createWildsWorldEvent({ ...firstInput, occurredAt: "not-a-time" }), /wilds_world_time_invalid/);
    assert.throws(() => createWildsWorldEvent({ ...firstInput, kaiKlok: 0 }), /wilds_world_kai_klok_invalid/);
    assert.throws(() => createWildsWorldEvent({ ...firstInput, payload: { health: Number.POSITIVE_INFINITY } }), /wilds_world_payload_invalid/);
  });
});

describe("Wilds world replay", () => {
  const spawned = () => createWildsWorldEvent({
    ...firstInput,
    payload: {
      site: {
        id: "site:crystal-burrow:genesis",
        familyId: "crystal-burrow",
        name: "Crystal Burrow",
        position: { x: 144, z: 96 },
        radius: 9,
        phase: "rumored",
        spawnedAt: "2026-07-15T12:00:00.000Z",
        expiresAt: "2026-07-18T12:00:00.000Z",
        bossId: null,
        seedDigest: `sha256:${"a".repeat(64)}`
      }
    }
  });

  it("replays ordered events and ignores exact duplicates", () => {
    const first = spawned();
    const state = replayWildsWorld([first, first]);

    assert.equal(state.revision, 1);
    assert.equal(state.sites["site:crystal-burrow:genesis"]?.phase, "rumored");
    assert.equal(state.cursor?.eventId, first.eventId);
  });

  it("continues from a verified checkpoint", () => {
    const first = spawned();
    const checkpoint = checkpointWildsWorld(replayWildsWorld([first]));
    const second = createWildsWorldEvent({
      ...firstInput,
      kind: "site.phase_changed",
      kaiKlok: 2,
      previousEventId: first.eventId,
      payload: { siteId: "site:crystal-burrow:genesis", phase: "tracked" }
    });
    const state = replayWildsWorld([second], checkpoint);

    assert.equal(state.revision, 2);
    assert.equal(state.sites["site:crystal-burrow:genesis"]?.phase, "tracked");
  });

  it("rejects out-of-order events and checkpoint mutation", () => {
    const first = spawned();
    const checkpoint = checkpointWildsWorld(replayWildsWorld([first]));
    const corrupt = { ...checkpoint, projection: { ...checkpoint.projection, revision: 99 } };

    assert.throws(() => replayWildsWorld([first, createWildsWorldEvent({ ...firstInput, kaiKlok: 1, payload: { site: { id: "other" } } })]), /wilds_world_event_order_invalid/);
    assert.throws(() => replayWildsWorld([], corrupt), /wilds_world_checkpoint_invalid/);
  });

  it("starts with one stable empty projection", () => {
    assert.deepEqual(replayWildsWorld([]), initialWildsWorldProjection());
  });
});
