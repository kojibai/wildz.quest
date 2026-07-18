import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { WildsWorldService } from "../src/features/play/wilds-world-service.js";
import { findWildsWorldRecord, selectWildsWorldSnapshot } from "../src/features/play/wilds-world-record.js";
import { initialWildsWorldProjection } from "../src/features/play/wilds-world-state.js";
import { sealCollectedCard } from "../src/features/play/portable-card.js";

const authority = {
  actorId: "player:captain",
  canonical: true,
  pulse: "2026-07-15T12:00:00.000Z",
  occurredAt: "2026-07-15T12:00:00.000Z"
};
const card = sealCollectedCard({ capturedAt: authority.occurredAt, encounterId: "world-service-card", formId: "mintcub-1", ownerReceizId: authority.actorId });

describe("Wilds living world service", () => {
  it("spawns one site, boss, and raid in deterministic causal order", () => {
    const service = new WildsWorldService();
    const first = service.tick({ pulse: authority.pulse, occurredAt: authority.occurredAt, systemActorId: "receiz:pulse" });
    const replay = service.tick({ pulse: authority.pulse, occurredAt: authority.occurredAt, systemActorId: "receiz:pulse" });

    const bossEvents = first.events.filter((event) => !event.kind.startsWith("story."));
    assert.deepEqual(bossEvents.map((event) => event.kind), ["site.spawned", "site.phase_changed", "site.phase_changed", "boss.emerged"]);
    assert.deepEqual(bossEvents.map((event) => event.kaiKlok), [5, 6, 7, 8]);
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
    assert.throws(() => service.execute({ type: "raid.contribute", bossId, damage: 10, support: 0, cardProofDigest: "bad", commandId: "command:hit:1" }, { ...authority, card, pulse: "2026-07-15T12:02:00.000Z", occurredAt: "2026-07-15T12:02:00.000Z" }), /wilds_world_card_proof_invalid/);
  });

  it("rejects stale scheduler pulses without mutating the world", () => {
    const service = new WildsWorldService();
    service.tick({ pulse: authority.pulse, occurredAt: authority.occurredAt, systemActorId: "receiz:pulse" });
    service.tick({ pulse: "2026-07-15T12:01:00.000Z", occurredAt: "2026-07-15T12:01:00.000Z", systemActorId: "receiz:pulse" });
    const before = service.checkpoint();
    assert.throws(() => service.tick({ pulse: authority.pulse, occurredAt: authority.occurredAt, systemActorId: "receiz:pulse" }), /wilds_world_pulse_order_invalid/);
    assert.throws(() => service.tickEcology({ pulse: "2026-07-15T11:59:00.000Z", occurredAt: "2026-07-15T11:59:00.000Z", systemActorId: "receiz:pulse" }), /wilds_world_pulse_order_invalid/);
    assert.deepEqual(service.checkpoint(), before);
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

  it("uses an explicit isolated practice projection until Receiz has a canonical revision", () => {
    const canonical = initialWildsWorldProjection();
    const practiceService = new WildsWorldService();
    const practice = practiceService.tick({ pulse: authority.pulse, occurredAt: authority.occurredAt, systemActorId: "receiz:pulse" }).projection;

    assert.deepEqual(selectWildsWorldSnapshot(canonical, practice), { projection: practice, mode: "local_practice" });
    assert.deepEqual(selectWildsWorldSnapshot({ ...canonical, revision: 1 }, practice), {
      projection: { ...canonical, revision: 1 },
      mode: "receiz_live"
    });
  });

  it("recovers a checkpoint without replaying history already included in it", () => {
    const service = new WildsWorldService();
    for (let index = 0; index < 520; index += 1) {
      service.execute({
        type: "social.report",
        subjectId: `subject:${index}`,
        reason: `recovery-${index}`,
        commandId: `command:recovery:${index}`
      }, authority);
    }
    const recovered = new WildsWorldService({ checkpoint: service.checkpoint(), events: service.events() });
    assert.deepEqual(recovered.snapshot(), service.snapshot());
  });
});
