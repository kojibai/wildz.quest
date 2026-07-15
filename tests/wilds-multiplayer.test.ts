import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canInteractWithPresence,
  createInviteRoom,
  expirePresence,
  regionForPosition,
  sanitizeWildsMessage,
  validatePresenceMove,
  visiblePresence
} from "../src/features/play/multiplayer-core.js";
import {
  acceptChallenge,
  createFriendlyChallenge,
  declineChallenge,
  type WildsChallenge
} from "../src/features/play/multiplayer-challenge.js";
import {
  createPvpBattle,
  submitPvpIntent,
  type PvpCard
} from "../src/features/play/pvp-battle-engine.js";
import { applyAuthorizedRiftPresence, getWildsAtlasPresence, heartbeatWildsPresence } from "../src/features/play/multiplayer-ledger.js";

const card = (id: string, speed = 44): PvpCard => ({
  assetId: id,
  proofDigest: `sha256:${id.padEnd(64, "0")}`,
  name: id,
  stats: { health: 48, power: 42, guard: 39, speed, bond: 50 },
  abilities: [
    { name: "Pulse", power: 32 },
    { name: "Bond", power: 39 }
  ]
});

describe("Wilds live multiplayer core", () => {
  it("partitions the infinite world into stable 48-unit regions", () => {
    assert.deepEqual(regionForPosition({ x: 0, z: 0 }), { x: 0, z: 0 });
    assert.deepEqual(regionForPosition({ x: 47.99, z: -0.01 }), { x: 0, z: -1 });
    assert.deepEqual(regionForPosition({ x: 48, z: -48 }), { x: 1, z: -1 });
  });

  it("creates bounded share rooms and keeps only nearby live players", () => {
    assert.match(createInviteRoom("pilot.receiz.id", { x: 4, z: 9 }, "kai-pulse"), /^invite:[a-f0-9]{16}$/);
    const now = Date.parse("2026-07-13T16:00:00.000Z");
    const players = [
      { playerId: "self", handle: "self", style: "female" as const, x: 0, z: 0, heading: 0, status: "available" as const, lastSeenAt: new Date(now).toISOString(), practice: false, activeCard: card("self") },
      { playerId: "near", handle: "near", style: "male" as const, x: 7, z: 2, heading: 0, status: "available" as const, lastSeenAt: new Date(now - 2_000).toISOString(), practice: false, activeCard: card("near") },
      { playerId: "far", handle: "far", style: "male" as const, x: 160, z: 160, heading: 0, status: "available" as const, lastSeenAt: new Date(now).toISOString(), practice: false, activeCard: card("far") },
      { playerId: "stale", handle: "stale", style: "male" as const, x: 2, z: 2, heading: 0, status: "available" as const, lastSeenAt: new Date(now - 16_000).toISOString(), practice: false, activeCard: card("stale") }
    ];
    assert.deepEqual(expirePresence(players, now).map((player) => player.playerId), ["self", "near", "far"]);
    assert.deepEqual(visiblePresence(players, { x: 0, z: 0 }, "self", now).map((player) => player.playerId), ["near"]);
    assert.equal(canInteractWithPresence(players[1], { x: 0, z: 0 }, now), true);
    assert.equal(canInteractWithPresence(players[2], { x: 0, z: 0 }, now), false);
  });

  it("rejects teleports and sanitizes unsafe room messages", () => {
    const previous = { x: 1, z: 1, at: "2026-07-13T16:00:00.000Z" };
    assert.equal(validatePresenceMove(previous, { x: 6, z: 1, at: "2026-07-13T16:00:01.000Z" }).ok, true);
    assert.equal(validatePresenceMove(previous, { x: 30, z: 1, at: "2026-07-13T16:00:01.000Z" }).ok, false);
    assert.equal(sanitizeWildsMessage("  Great battle!  "), "Great battle!");
    assert.throws(() => sanitizeWildsMessage("meet me at https://example.com"), /wilds_message_contact_blocked/);
    assert.throws(() => sanitizeWildsMessage("email me hero@example.com"), /wilds_message_contact_blocked/);
    assert.throws(() => sanitizeWildsMessage("x".repeat(281)), /wilds_message_too_long/);
  });

  it("projects every public player at their exact live atlas coordinate", () => {
    const now = "2026-07-15T12:00:00.000Z";
    const base = { handle: "Atlas", style: "female" as const, heading: 0, practice: false, activeCard: card("atlas") };
    heartbeatWildsPresence({ ...base, roomKey: "wilds:platform:1000:1000", playerId: "atlas-self", x: 48_000, z: 48_000, now });
    heartbeatWildsPresence({ ...base, roomKey: "wilds:platform:1000:1000", playerId: "atlas-near", handle: "Nearby", x: 48_003, z: 48_004, now });
    heartbeatWildsPresence({ ...base, roomKey: "wilds:platform:1002:1000", playerId: "atlas-far", handle: "Hidden", x: 48_100, z: 48_010, now });

    const atlas = getWildsAtlasPresence({
      actorId: "atlas-self",
      center: { x: 48_000, z: 48_000 },
      now: Date.parse(now),
      maxClusters: 64
    });
    assert.deepEqual(atlas.players, [
      { playerId: "atlas-near", handle: "Nearby", style: "female", x: 48_003, z: 48_004, status: "available" },
      { playerId: "atlas-far", handle: "Hidden", style: "female", x: 48_100, z: 48_010, status: "available" }
    ]);
    assert.equal(atlas.clusters.length, 0);
  });

  it("applies an authorized Kai pulse before the next presence heartbeat", () => {
    const roomKey = "wilds:platform:77:77";
    const now = "2026-07-15T12:00:00.000Z";
    const base = { handle: "Rifter", style: "female" as const, heading: 0, practice: false, activeCard: card("rift-presence") };
    heartbeatWildsPresence({ ...base, roomKey, playerId: "rift-player", x: 0, z: 0, now });
    const moved = applyAuthorizedRiftPresence({ roomKey, playerId: "rift-player", destination: { x: -33, z: -39 }, kaiPulse: "4242", now: "2026-07-15T12:00:01.000Z" });
    assert.deepEqual(moved.players.find((player) => player.playerId === "rift-player") && { x: moved.players.find((player) => player.playerId === "rift-player")!.x, z: moved.players.find((player) => player.playerId === "rift-player")!.z }, { x: -33, z: -39 });
    assert.doesNotThrow(() => heartbeatWildsPresence({ ...base, roomKey, playerId: "rift-player", x: -33, z: -39, now: "2026-07-15T12:00:01.250Z" }));
  });
});

describe("Wilds challenge lifecycle", () => {
  it("offers, accepts, and declines append-only friendly challenges", () => {
    const offered = createFriendlyChallenge({
      id: "challenge-1",
      roomKey: "wilds:platform:0:0",
      challengerId: "a",
      opponentId: "b",
      challengerCard: card("a"),
      offeredAt: "2026-07-13T16:00:00.000Z"
    });
    assert.equal(offered.state, "offered");
    const accepted = acceptChallenge(offered, "b", card("b"), "2026-07-13T16:00:10.000Z");
    assert.equal(accepted.state, "accepted");
    assert.equal(accepted.revision, 2);
    assert.throws(() => declineChallenge(accepted, "b", "2026-07-13T16:00:11.000Z"), /wilds_challenge_transition_invalid/);
    const declined: WildsChallenge = declineChallenge(offered, "b", "2026-07-13T16:00:11.000Z");
    assert.equal(declined.state, "declined");
  });
});

describe("server-authoritative Wilds PvP", () => {
  it("replays simultaneous deterministic turns from pinned card proofs", () => {
    const start = createPvpBattle({
      challengeId: "challenge-1",
      playerA: { playerId: "a", card: card("a", 55) },
      playerB: { playerId: "b", card: card("b", 30) },
      acceptedAt: "2026-07-13T16:00:10.000Z"
    });
    const waiting = submitPvpIntent(start, "a", { type: "ability", slot: 0 }, "intent-a-1");
    assert.equal(waiting.turn, 1);
    const resolved = submitPvpIntent(waiting, "b", { type: "guard" }, "intent-b-1");
    assert.equal(resolved.turn, 2);
    assert.equal(resolved.transcript.length, 1);
    assert.equal(resolved.players.b.hp < resolved.players.b.maxHp, true);
    const replay = submitPvpIntent(
      submitPvpIntent(start, "a", { type: "ability", slot: 0 }, "intent-a-1"),
      "b",
      { type: "guard" },
      "intent-b-1"
    );
    assert.deepEqual(replay, resolved);
    assert.throws(() => submitPvpIntent(resolved, "a", { type: "guard" }, "intent-a-1"), /wilds_pvp_intent_replayed/);
  });

  it("forfeits after three consecutive missed turns", () => {
    let battle = createPvpBattle({
      challengeId: "challenge-miss",
      playerA: { playerId: "a", card: card("a") },
      playerB: { playerId: "b", card: card("b") },
      acceptedAt: "2026-07-13T16:00:10.000Z"
    });
    for (let turn = 1; turn <= 3; turn += 1) {
      battle = submitPvpIntent(battle, "a", { type: "ability", slot: 0 }, `a-${turn}`);
      battle = submitPvpIntent(battle, "b", { type: "timeout" }, `b-${turn}`);
    }
    assert.equal(battle.phase, "settled");
    assert.equal(battle.winnerId, "a");
    assert.equal(battle.resultReason, "forfeit");
  });
});
