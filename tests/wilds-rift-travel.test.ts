import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import { applyWildsInput, initialPlayState } from "../src/features/play/game-state";
import { validatePresenceMove } from "../src/features/play/multiplayer-core";
import { landmarkApproachPoint, landmarkAtPosition, WILDS_FLAGSHIP_LANDMARKS } from "../src/features/play/wilds-landmarks";
import {
  authorizeRiftTravel,
  validateRiftGrant,
  type RiftTravelRequest
} from "../src/features/play/wilds-rift-travel";

const requestedAt = "2026-07-15T12:00:00.000Z";
const validRequest: RiftTravelRequest = {
  idempotencyKey: "rift-request-1",
  source: { x: 0, z: 0 },
  destination: { x: 144, z: -96 }
};
const authority = { playerId: "player-1", coordinationPulse: "42", locked: false } as const;

describe("Wilds Rift travel", () => {
  it("lands outside every landmark so the explorer must walk to its entrance", () => {
    for (const landmark of WILDS_FLAGSHIP_LANDMARKS) {
      const approach = landmarkApproachPoint(landmark);
      assert.equal(landmarkAtPosition(approach), null);
      assert.ok(Math.hypot(approach.x - landmark.position.x, approach.z - landmark.position.z) > landmark.radius);
      assert.ok(Math.hypot(approach.x - landmark.position.x, approach.z - landmark.position.z) <= landmark.radius + 6);
      let walked = { ...initialPlayState, player: approach };
      for (let step = 0; step < 4; step += 1) {
        walked = applyWildsInput(walked, { type: "move", direction: "west" });
        walked = applyWildsInput(walked, { type: "move", direction: "north" });
      }
      assert.equal(landmarkAtPosition(walked.player)?.id, landmark.id);
    }
  });

  it("authorizes a bounded safe Rift without weakening ordinary movement", () => {
    const result = authorizeRiftTravel(validRequest, authority);

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.grant.destination, validRequest.destination);
    assert.equal(result.grant.playerId, "player-1");
    assert.match(result.grant.kaiPulse, /^\d+$/);
    assert.equal(result.grant.kaiKlok, `kai:${result.grant.kaiPulse}`);
    assert.equal(result.grant.state, "authorized");
    assert.equal(validateRiftGrant(result.grant, { playerId: "player-1" }).ok, true);
    assert.equal(validatePresenceMove(
      { x: 0, z: 0, at: requestedAt },
      { x: 144, z: -96, at: "2026-07-15T12:00:01.000Z" }
    ).ok, false);
  });

  it("rejects malformed, locked, and uncoordinated travel", () => {
    assert.deepEqual(authorizeRiftTravel({ ...validRequest, destination: { x: Infinity, z: 0 } }, {
      ...authority
    }), { ok: false, error: "wilds_rift_position_invalid" });
    assert.deepEqual(authorizeRiftTravel({ ...validRequest, destination: { x: 1_000_001, z: 0 } }, {
      ...authority
    }), { ok: false, error: "wilds_rift_position_invalid" });
    assert.deepEqual(authorizeRiftTravel({ ...validRequest, idempotencyKey: "" }, {
      ...authority
    }), { ok: false, error: "wilds_rift_idempotency_invalid" });
    assert.deepEqual(authorizeRiftTravel(validRequest, {
      ...authority, locked: true
    }), { ok: false, error: "wilds_rift_activity_locked" });
    assert.deepEqual(authorizeRiftTravel(validRequest, {
      ...authority, coordinationPulse: ""
    }), { ok: false, error: "wilds_rift_grant_invalid" });
  });

  it("rejects foreign or Kai-Klok-incoherent grants", () => {
    const result = authorizeRiftTravel(validRequest, authority);
    assert.equal(result.ok, true);
    if (!result.ok) return;

    assert.deepEqual(validateRiftGrant(result.grant, { playerId: "player-2" }), {
      ok: false,
      error: "wilds_rift_actor_mismatch"
    });
    assert.deepEqual(validateRiftGrant({ ...result.grant, kaiKlok: "kai:wrong" }, { playerId: "player-1" }), {
      ok: false,
      error: "wilds_rift_grant_invalid"
    });
  });

  it("moves game state only from a valid coordinated grant", () => {
    const result = authorizeRiftTravel(validRequest, authority);
    assert.equal(result.ok, true);
    if (!result.ok) return;

    const moved = applyWildsInput(initialPlayState, {
      type: "apply-rift-grant",
      grant: result.grant,
      playerId: "player-1"
    });
    assert.deepEqual(moved.player, { x: 144, z: -96 });
    assert.match(moved.lastEvent, /Rift complete.*Walk.*landmark entrance/);

    const incoherent = applyWildsInput(initialPlayState, {
      type: "apply-rift-grant",
      grant: { ...result.grant, kaiKlok: "kai:wrong" },
      playerId: "player-1"
    });
    assert.strictEqual(incoherent, initialPlayState);
  });

  it("derives Rift authority from the server actor and room instead of client identity", async () => {
    const route = await readFile("app/api/wilds/rift/route.ts", "utf8");
    assert.match(route, /resolveWildsMultiplayerActor\(request, body\?\.guestId\)/);
    assert.match(route, /parseWildsRoomKey\(body\?\.roomKey\)/);
    assert.match(route, /getWildsMultiplayerSnapshot\(roomKey/);
    assert.match(route, /authorizeRiftTravel/);
    assert.match(route, /applyAuthorizedRiftPresence/);
    assert.match(route, /cache-control": "private, no-store"/);
    assert.doesNotMatch(route, /body\?\.playerId/);
  });
});
