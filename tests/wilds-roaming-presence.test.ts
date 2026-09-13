import assert from "node:assert/strict";
import { test } from "node:test";
import { sealCollectedCard } from "../src/features/play/portable-card";
import { authorizeWildsMultiplayerHeartbeatCard, authorizeWildsRoamingPresence, type WildsMultiplayerActor } from "../src/lib/receiz/wilds-multiplayer-server";
import { sanitizeWildsRoamingPresence, WILDS_ROAMING_PRESENCE_LIMIT, projectWildsRemoteRoamingMarkers } from "../src/features/play/wilds-roaming-presence";
import { buildWildsMultiplayerHeartbeatBody, sameWildsMultiplayerPresence } from "../src/features/play/use-wilds-multiplayer";
import { getWildsAtlasPresence, heartbeatWildsPresence } from "../src/features/play/multiplayer-ledger";
import { pvpCardFromAsset } from "../src/features/play/multiplayer-card";
import type { WildsPresence } from "../src/features/play/multiplayer-core";
const at = "2026-09-13T12:00:00.000Z";
const card = sealCollectedCard({ formId: "voltray-1", ownerReceizId: "roaming_owner", encounterId: "public-roamer", capturedAt: at });
const actor: WildsMultiplayerActor = { playerId: "presence:roaming-owner", handle: "roaming_owner.receiz.id", receizActorId: "owner", practice: false };
const pose = { x: 17, z: -8, phase: "returning" as const, returning: true };

test("strict owner admission publishes only bounded identity, proof, physical pose and phase", () => {
  const projected = authorizeWildsRoamingPresence(actor, [{ card, ...pose, name: "invented", ownerId: "forged", artifactBytes: "secret", privateVault: "secret", stats: { health: 9000 } }]);
  assert.deepEqual(projected, [{ assetId: card.id, proofDigest: card.proof.digest, name: card.manifest.name, ownerId: actor.playerId, ownerHandle: actor.handle, ...pose }]);
  assert.doesNotMatch(JSON.stringify(projected), /secret|invented|health|manifest|genome/);
  const compact = authorizeWildsRoamingPresence(actor, [{ cardRef: { assetId: card.id, proofDigest: card.proof.digest }, ...pose }]);
  assert.deepEqual(compact, projected);
  assert.deepEqual(authorizeWildsRoamingPresence({ ...actor, practice: true }, [{ card, ...pose }]), []);
});
test("borrowed bearer avatar admission cannot authorize another owner's roaming creature", () => {
  const other: WildsMultiplayerActor = { ...actor, playerId: "presence:other", handle: "other.receiz.id" };
  authorizeWildsMultiplayerHeartbeatCard(other, card);
  assert.throws(() => authorizeWildsRoamingPresence(other, [{ card, ...pose }]), /owner_invalid/);
  assert.throws(() => authorizeWildsRoamingPresence(other, [{ cardRef: { assetId: card.id, proofDigest: card.proof.digest }, ...pose }]), /roaming_card_required/);
  const tampered = structuredClone(card); tampered.manifest.stats.power += 1;
  assert.throws(() => authorizeWildsRoamingPresence(actor, [{ card: tampered, ...pose }]), /verification_failed/);
});
test("invalid/duplicate/unbounded poses reject and compact admissions expire", () => {
  assert.throws(() => authorizeWildsRoamingPresence(actor, Array.from({ length: WILDS_ROAMING_PRESENCE_LIMIT + 1 }, () => ({ card, ...pose }))), /presence_invalid/);
  assert.throws(() => authorizeWildsRoamingPresence(actor, [{ card, ...pose }, { card, ...pose }]), /duplicate/);
  assert.throws(() => authorizeWildsRoamingPresence(actor, [{ card, ...pose, x: Infinity }]), /presence_invalid/);
  assert.throws(() => authorizeWildsRoamingPresence(actor, [{ card, ...pose, phase: "captured" }]), /presence_invalid/);
  const scoped = { ...actor, playerId: "presence:ttl-test" };
  authorizeWildsRoamingPresence(scoped, [{ card, ...pose }], 1000);
  assert.throws(() => authorizeWildsRoamingPresence(scoped, [{ cardRef: { assetId: card.id, proofDigest: card.proof.digest }, ...pose }], 62000), /roaming_card_required/);
});
test("existing atlas transport exposes a live remote roamer and expires it with owner presence", () => {
  const creatures = authorizeWildsRoamingPresence(actor, [{ card, ...pose }]);
  heartbeatWildsPresence({ roomKey: "wilds:roaming-test:0:0", playerId: actor.playerId, handle: actor.handle, style: "female", x: 0, z: 0, heading: 0, practice: false, activeCard: pvpCardFromAsset(card), roamingCreatures: creatures, now: at });
  const now = Date.parse(at);
  const atlas = getWildsAtlasPresence({ actorId: "observer", center: { x: 0, z: 0 }, now });
  const markers = projectWildsRemoteRoamingMarkers(atlas.players, "observer", now);
  const marker = markers.find(item => item.assetId === card.id)!;
  assert.equal(marker.ownerId, actor.playerId);
  assert.equal(marker.remote, true);
  assert.equal(marker.status, "Returning");
  assert.deepEqual(marker.position, { x: 17, z: -8 });
  assert.deepEqual(projectWildsRemoteRoamingMarkers(atlas.players, actor.playerId, now), []);
  assert.deepEqual(projectWildsRemoteRoamingMarkers(atlas.players, "observer", now + 15001), []);
  const privatePlayers = (atlas.players).map(player => ({ ...player, status: "private" as const }));
  assert.deepEqual(projectWildsRemoteRoamingMarkers(privatePlayers, "observer", now), []);
});
test("heartbeat retries carry exact card once then only compact public references", () => {
  const input = { roomKey: "wilds:test:0:0", guestId: "guest-test", style: "female" as const, x: 0, z: 0, heading: 0, card, cardAdmission: null, roamingCreatures: [{ card, ...pose }] };
  const full = buildWildsMultiplayerHeartbeatBody(input, false);
  const compact = buildWildsMultiplayerHeartbeatBody(input, true);
  assert.equal((full.roamingCreatures![0] as { card: unknown }).card, card);
  assert.equal("card" in compact.roamingCreatures![0], false);
  assert.deepEqual((compact.roamingCreatures![0] as { cardRef: unknown }).cardRef, { assetId: card.id, proofDigest: card.proof.digest });
});


test("a stationary owner's moving or returning creature refreshes the live projection", () => {
  const roamingCreatures = authorizeWildsRoamingPresence(actor, [{ card, ...pose }]);
  const player: WildsPresence = { playerId: actor.playerId, handle: actor.handle, style: "female", x: 0, z: 0, heading: 0, status: "available", lastSeenAt: at, practice: false, activeCard: pvpCardFromAsset(card), roamingCreatures };
  assert.equal(sameWildsMultiplayerPresence([player], [{ ...player }]), true);
  assert.equal(sameWildsMultiplayerPresence([player], [{ ...player, lastSeenAt: "2026-09-13T12:00:02.500Z" }]), false);
  assert.equal(sameWildsMultiplayerPresence([player], [{ ...player, roamingCreatures: [{ ...roamingCreatures[0], x: 18 }] }]), false);
  assert.equal(sameWildsMultiplayerPresence([player], [{ ...player, roamingCreatures: [{ ...roamingCreatures[0], phase: "roaming", returning: false }] }]), false);
  assert.equal(sameWildsMultiplayerPresence([player], [{ ...player, roamingCreatures: [] }]), false);
});

test("malformed remote rows cannot crash the map or leak extra payloads", () => {
  const owner = { playerId: actor.playerId, handle: actor.handle, practice: false, status: "available" as const };
  const valid = authorizeWildsRoamingPresence(actor, [{ card, ...pose }])[0];
  for (const value of [null, {}, "oops", [null, {}, { ...valid, x: Infinity }, { ...valid, ownerId: "foreign" }]]) {
    assert.deepEqual(sanitizeWildsRoamingPresence(owner, value), []);
  }
  assert.deepEqual(sanitizeWildsRoamingPresence(owner, [{ ...valid, secret: "private" }, valid]), [valid]);
});
