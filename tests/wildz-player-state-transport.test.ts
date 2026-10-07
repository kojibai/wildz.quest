import assert from "node:assert/strict";
import test from "node:test";
import { projectWildzPlayerStateResponse } from "../src/lib/performance/wildz-player-state-transport";
import { createOwnerBoundInitialPlayState } from "../src/features/play/game-state";
import { createWildsPlayerVault } from "../src/features/play/wilds-player-vault";
import { convergeWildzPlayerState } from "../src/lib/receiz/wildz-player-state-sync";

function record() {
  const player = createWildsPlayerVault({ playerId: "transport", exportedAt: "2026-10-06T00:00:00.000Z",
    playState: createOwnerBoundInitialPlayState("transport", "2026-10-06T00:00:00.000Z"),
    character: null, settings: { avatarStyle: null, movementMode: "walk", audio: {} },
    personalEvents: [], receipts: [], canonicalCursor: { worldId: "wilds:global:v3", revision: 0, eventId: null } });
  return convergeWildzPlayerState({ actorId: "transport", current: null, incoming: player, now: player.exportedAt });
}

test("an exact accepted save returns a compact receipt without reading the vault", () => {
  const saved = record();
  Object.defineProperty(saved, "player", { get() { throw Error("vault should not be copied into a receipt"); } });
  const response = projectWildzPlayerStateResponse(saved, { compact: true, incomingDigest: saved.sourceDigest });
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { ok: true, receipt: { playerId: "transport", sourceDigest: saved.sourceDigest, revision: 1 } });
  assert.ok(JSON.stringify(response.body).length < 300);
});

test("concurrent changes and legacy clients receive the full converged state", () => {
  const saved = record();
  for (const options of [{ compact: true, incomingDigest: "different" }, { incomingDigest: saved.sourceDigest }, {}]) {
    assert.deepEqual(projectWildzPlayerStateResponse(saved, options).body, { ok: true, record: saved });
  }
});

test("a subsequent gameplay save converges to the submitted digest and receives a receipt", () => {
  const saved = record();
  const incoming = createWildsPlayerVault({ playerId: saved.playerId, character: saved.player.character, settings: saved.player.settings,
    personalEvents: saved.player.personalEvents, receipts: saved.player.receipts, canonicalCursor: saved.player.canonicalCursor,
    exportedAt: "2026-10-06T00:00:01.000Z", playState: {
    ...saved.player.playState,
    player: { x: 11, z: 12 },
    actionHistory: [{ id: "travel", kind: "activity", title: "Travel", detail: "Moving", authority: "local", uPulse: 100 }]
  } });
  const converged = convergeWildzPlayerState({ actorId: "transport", current: saved, incoming, now: incoming.exportedAt });
  assert.equal(converged.sourceDigest, incoming.payloadDigest);
  const response = projectWildzPlayerStateResponse(converged, { compact: true, incomingDigest: incoming.payloadDigest });
  assert.deepEqual(response.body, { ok: true, receipt: { playerId: "transport", sourceDigest: converged.sourceDigest, revision: 2 } });
});

test("an unchanged authenticated poll returns no vault body and changed heads still download", () => {
  const saved = record();
  const first = projectWildzPlayerStateResponse(saved);
  assert.equal(first.etag, `"${saved.sourceDigest}"`);
  assert.deepEqual(projectWildzPlayerStateResponse(saved, { ifNoneMatch: first.etag }), { status: 304, etag: first.etag, body: null });
  assert.equal(projectWildzPlayerStateResponse(saved, { ifNoneMatch: '"old"' }).status, 200);
  assert.deepEqual(projectWildzPlayerStateResponse(null, { ifNoneMatch: first.etag }).body, { ok: true, record: null });
});
