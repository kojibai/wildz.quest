import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { authorizeRiftTravelV11, isLocallyAdmittedRiftDestinationV11, validateRiftGrantV11 } from "../src/features/play/wilds-rift-travel";
import { roomKeyForAddressV11, validatePresenceMoveV11 } from "../src/features/play/multiplayer-core";
import { parseWildsRoomKey } from "../src/lib/receiz/wilds-multiplayer-server";
import { applyWildsInput, createOwnerBoundInitialPlayState, initialPlayState, restorePlayState, serializePlayState, upgradeV10PlayStateToV11 } from "../src/features/play/game-state";
import { sampleWildsTerrainV11 } from "../src/features/play/wilds-terrain-authority";

const origin = { worldVersion: 11, regionX: "0", regionZ: "0", localX: 0, localZ: 0 } as const;
const far = { worldVersion: 11, regionX: "9007199254740993", regionZ: "-9007199254740993", localX: 7_000_000, localZ: 19_000_000 } as const;
const authority = { playerId: "traveler", coordinationPulse: "42", locked: false } as const;

describe("v11 exact-address travel", () => {
  it("authorizes and replays a distant Rift without Number coordinate conversion", () => {
    const result = authorizeRiftTravelV11({ idempotencyKey: "travel-v11-1", source: origin, destination: far }, authority);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.grant.destination, far);
    assert.equal(isLocallyAdmittedRiftDestinationV11(origin, far), false);
    assert.equal(isLocallyAdmittedRiftDestinationV11(far, { ...far, localX: 8_000_000 }), true);
    assert.deepEqual(validateRiftGrantV11(result.grant, { playerId: "traveler" }), { ok: true });
    assert.deepEqual(authorizeRiftTravelV11({ idempotencyKey: "travel-v11-1", source: origin, destination: far }, authority), result);
  });

  it("lands the player at a bounded local coordinate while retaining the distant address", () => {
    const result = authorizeRiftTravelV11({ idempotencyKey: "travel-v11-3", source: origin, destination: far }, authority);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const landed = applyWildsInput(upgradeV10PlayStateToV11(initialPlayState), {
      type: "apply-rift-grant-v11", grant: result.grant, playerId: authority.playerId
    });
    assert.deepEqual(landed.worldAddress, far);
    assert.deepEqual(landed.player, { x: 7, z: 19 });
    const walked = applyWildsInput(landed, { type: "move", direction: "east" });
    assert.equal(applyWildsInput(walked, { type: "apply-rift-grant-v11", grant: result.grant,
      playerId: authority.playerId }), walked);
    assert.ok(landed.explorationAtlasV11?.regions.includes(`${far.regionX}:${far.regionZ}`));
  });

  it("lets an upgraded player enter at origin without rewriting the existing companion", () => {
    const prior = upgradeV10PlayStateToV11(createOwnerBoundInitialPlayState(authority.playerId));
    const cardBytes = JSON.stringify(prior.inventory[0]);
    const result = authorizeRiftTravelV11({ idempotencyKey: "travel-world-entry",
      source: prior.worldAddress!, destination: origin }, authority);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const entered = applyWildsInput(prior, { type: "apply-rift-grant-v11",
      grant: result.grant, playerId: authority.playerId });
    assert.equal(entered.worldCoordinateMode, "region-local");
    assert.deepEqual(entered.worldAddress, origin);
    assert.deepEqual(entered.player, { x: 0, z: 0 });
    assert.equal(JSON.stringify(entered.inventory[0]), cardBytes);
    const restored = restorePlayState(serializePlayState(entered), authority.playerId);
    assert.equal(restored.worldCoordinateMode, "region-local");
    assert.deepEqual(restored.worldAddress, origin);
    assert.equal(restored.inventory[0]?.proof.digest, prior.inventory[0]?.proof.digest);
  });

  it("crosses an enormous region boundary by walking and restores the exact neighbor", () => {
    const destination = { ...far, regionZ: "-17", localX: 23_900_000, localZ: 12_000_000 };
    const result = authorizeRiftTravelV11({ idempotencyKey: "travel-v11-edge", source: origin, destination }, authority);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const landed = applyWildsInput(upgradeV10PlayStateToV11(initialPlayState), {
      type: "apply-rift-grant-v11", grant: result.grant, playerId: authority.playerId
    });
    const walked = applyWildsInput(landed, { type: "move", direction: "east" });
    assert.equal(walked.worldAddress?.regionX, "9007199254740994");
    assert.equal(walked.player.x, 0.95);
    assert.equal(walked.siteSpace?.position.y, sampleWildsTerrainV11(walked.worldAddress!).elevation);
    assert.deepEqual(restorePlayState(serializePlayState(walked)).worldAddress, walked.worldAddress);
  });

  it("keeps an upgraded v10 player synchronized through an ordinary move", () => {
    const upgraded = upgradeV10PlayStateToV11(initialPlayState);
    const moved = applyWildsInput(upgraded, { type: "move-vector", x: 1, z: 0 });
    assert.equal(moved.worldCoordinateMode, "legacy");
    assert.doesNotThrow(() => serializePlayState(moved));
    assert.deepEqual(moved.worldAddress, upgradeV10PlayStateToV11({ ...moved, worldAddress: undefined }).worldAddress);
  });

  it("derives the same bounded room key after restoring an exact address", () => {
    const roomKey = roomKeyForAddressV11("platform", far);
    assert.equal(parseWildsRoomKey(roomKey), roomKey);
    assert.equal(roomKeyForAddressV11("platform", { ...far }), roomKey);
    assert.notEqual(roomKeyForAddressV11("platform", { ...far, regionX: "9007199254740994" }), roomKey);
    assert.ok(roomKey.length < 160);
  });

  it("enforces ordinary movement speed across region boundaries", () => {
    const at = "2026-09-26T12:00:00.000Z";
    const nextAt = "2026-09-26T12:00:01.000Z";
    assert.deepEqual(validatePresenceMoveV11({ address: { ...origin, localX: 23_000_000 }, at },
      { address: { ...origin, regionX: "1", localX: 1_000_000 }, at: nextAt }), { ok: true });
    assert.deepEqual(validatePresenceMoveV11({ address: origin, at }, { address: far, at: nextAt }),
      { ok: false, error: "wilds_presence_teleport_rejected" });
  });

  it("rejects malformed addresses instead of issuing a Rift grant", () => {
    const result = authorizeRiftTravelV11({ idempotencyKey: "travel-v11-2", source: origin, destination: { ...far, regionX: "01" } }, authority);
    assert.deepEqual(result, { ok: false, error: "wilds_rift_position_invalid" });
    assert.throws(() => roomKeyForAddressV11("platform", { ...far, regionX: "01" }), /address|region/i);
  });
});
