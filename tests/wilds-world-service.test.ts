import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { WildsWorldService } from "../src/features/play/wilds-world-service.js";
import { findWildsWorldRecord } from "../src/features/play/wilds-world-record.js";

const authority = {
  actorId: "player:captain",
  canonical: true,
  pulse: "2026-07-15T12:00:00.000Z",
  occurredAt: "2026-07-15T12:00:00.000Z"
};

describe("Wilds living world service", () => {
  it("spawns one site, boss, and raid in deterministic causal order", () => {
    const service = new WildsWorldService();
    const first = service.tick({ pulse: authority.pulse, occurredAt: authority.occurredAt, systemActorId: "receiz:pulse" });
    const replay = service.tick({ pulse: authority.pulse, occurredAt: authority.occurredAt, systemActorId: "receiz:pulse" });

    assert.deepEqual(first.events.map((event) => event.kind), ["site.spawned", "site.phase_changed", "site.phase_changed", "boss.emerged"]);
    assert.deepEqual(first.events.map((event) => event.kaiKlok), [1, 2, 3, 4]);
    assert.equal(Object.keys(first.projection.sites).length, 1);
    assert.equal(Object.keys(first.projection.bosses).length, 1);
    assert.equal(Object.keys(first.projection.raids).length, 1);
    assert.equal(replay.events.length, 0);
    assert.deepEqual(replay.projection, first.projection);
  });

  it("executes idempotent authorized raid and team commands", () => {
    const service = new WildsWorldService();
    const world = service.tick({ pulse: authority.pulse, occurredAt: authority.occurredAt, systemActorId: "receiz:pulse" }).projection;
    const bossId = Object.keys(world.bosses)[0]!;
    const joined = service.execute({ type: "raid.join", bossId, commandId: "command:join:1" }, { ...authority, pulse: "2026-07-15T12:01:00.000Z", occurredAt: "2026-07-15T12:01:00.000Z" });
    const replay = service.execute({ type: "raid.join", bossId, commandId: "command:join:1" }, { ...authority, pulse: "2026-07-15T12:01:00.000Z", occurredAt: "2026-07-15T12:01:00.000Z" });
    const team = service.execute({ type: "team.create", name: "Prism Keepers", commandId: "command:team:1" }, { ...authority, pulse: "2026-07-15T12:02:00.000Z", occurredAt: "2026-07-15T12:02:00.000Z" });

    assert.equal(joined.events[0]?.kind, "raid.joined");
    assert.equal(replay.events.length, 0);
    assert.equal(Object.values(team.projection.teams)[0]?.captainId, authority.actorId);
  });

  it("blocks noncanonical authority and invalid card proofs", () => {
    const service = new WildsWorldService();
    const world = service.tick({ pulse: authority.pulse, occurredAt: authority.occurredAt, systemActorId: "receiz:pulse" }).projection;
    const bossId = Object.keys(world.bosses)[0]!;

    assert.throws(() => service.execute({ type: "raid.join", bossId, commandId: "command:guest:1" }, { ...authority, canonical: false }), /wilds_world_canonical_authority_required/);
    service.execute({ type: "raid.join", bossId, commandId: "command:join:1" }, { ...authority, pulse: "2026-07-15T12:01:00.000Z", occurredAt: "2026-07-15T12:01:00.000Z" });
    assert.throws(() => service.execute({ type: "raid.contribute", bossId, damage: 10, support: 0, cardProofDigest: "bad", commandId: "command:hit:1" }, { ...authority, pulse: "2026-07-15T12:02:00.000Z", occurredAt: "2026-07-15T12:02:00.000Z" }), /wilds_world_card_proof_invalid/);
  });
});

describe("Receiz Wilds world recovery", () => {
  it("finds only a complete V3 checkpoint and event tail through Receiz envelopes", () => {
    const service = new WildsWorldService();
    service.tick({ pulse: authority.pulse, occurredAt: authority.occurredAt, systemActorId: "receiz:pulse" });
    const record = { checkpoint: service.checkpoint(), eventTail: service.events() };

    assert.deepEqual(findWildsWorldRecord({ result: { appState: record } }), record);
    assert.equal(findWildsWorldRecord({ state: { schema: "receiz.wilds_world_checkpoint.v2" } }), null);
  });
});
