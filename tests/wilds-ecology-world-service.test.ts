import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { WildsWorldService } from "../src/features/play/wilds-world-service.js";
import { replayWildsWorld } from "../src/features/play/wilds-world-state.js";
import { sealCollectedCard } from "../src/features/play/portable-card.js";

const pulse = "2026-07-15T21:00:00.000Z";
const card = sealCollectedCard({ capturedAt: pulse, encounterId: "world-ecology-card", formId: "mintcub-1", ownerReceizId: "player:ecologist" });
const authority = (at: string) => ({ actorId: "player:ecologist", canonical: true, pulse: at, occurredAt: at, card });

describe("canonical Wilds ecology service", () => {
  it("admits one bounded ecology ensemble and replays it exactly", () => {
    const service = new WildsWorldService();
    const first = service.tickEcology({ pulse, occurredAt: pulse, systemActorId: "receiz:pulse" });
    const duplicate = service.tickEcology({ pulse, occurredAt: pulse, systemActorId: "receiz:pulse" });

    assert.equal(first.events.length, 8);
    assert.equal(first.events.every((event) => event.kind === "ecology.spawned"), true);
    assert.equal(Object.keys(first.projection.ecologySites).length, 8);
    assert.deepEqual(replayWildsWorld(service.events()), first.projection);
    assert.equal(duplicate.events.length, 0);
  });

  it("requires physical canonical discovery and deduplicates it", () => {
    const service = new WildsWorldService();
    const world = service.tickEcology({ pulse, occurredAt: pulse, systemActorId: "receiz:pulse" }).projection;
    const site = Object.values(world.ecologySites)[0]!;

    assert.throws(() => service.execute({ type: "ecology.discover", siteId: site.id, position: { x: 0, z: 0 }, commandId: "ecology:discover:far" }, authority("2026-07-15T21:01:00.000Z")), /wilds_ecology_location_invalid/);
    const first = service.execute({ type: "ecology.discover", siteId: site.id, position: site.position, commandId: "ecology:discover:near" }, authority("2026-07-15T21:02:00.000Z"));
    const duplicate = service.execute({ type: "ecology.discover", siteId: site.id, position: site.position, commandId: "ecology:discover:near" }, authority("2026-07-15T21:02:00.000Z"));

    assert.deepEqual(first.events.map((event) => event.kind), ["ecology.discovered"]);
    assert.equal(first.projection.ecologySites[site.id]?.phase, "discovered");
    assert.equal(duplicate.events.length, 0);
  });

  it("validates proof, activates, contributes, resolves, and records aftermath once", () => {
    const service = new WildsWorldService();
    const world = service.tickEcology({ pulse, occurredAt: pulse, systemActorId: "receiz:pulse" }).projection;
    const site = Object.values(world.ecologySites)[0]!;
    service.execute({ type: "ecology.discover", siteId: site.id, position: site.position, commandId: "ecology:discover:contribution" }, authority("2026-07-15T21:01:00.000Z"));

    assert.throws(() => service.execute({ type: "ecology.contribute", siteId: site.id, position: site.position, amount: 10, cardProofDigest: "bad", commandId: "ecology:bad-proof" }, authority("2026-07-15T21:02:00.000Z")), /wilds_world_card_proof_invalid/);
    const command = { type: "ecology.contribute" as const, siteId: site.id, position: site.position, amount: 10, cardProofDigest: card.proof.digest, commandId: "ecology:contribute:complete" };
    const result = service.execute(command, authority("2026-07-15T21:03:00.000Z"));
    const duplicate = service.execute(command, authority("2026-07-15T21:03:00.000Z"));

    assert.deepEqual(result.events.map((event) => event.kind), ["ecology.phase_changed", "ecology.contributed", "ecology.phase_changed", "ecology.resolved"]);
    assert.equal(result.projection.ecologySites[site.id]?.phase, "aftermath");
    assert.equal(result.projection.ecologyHistory.includes(site.id), true);
    assert.equal(duplicate.events.length, 0);
  });

  it("blocks noncanonical ecology commands", () => {
    const service = new WildsWorldService();
    const world = service.tickEcology({ pulse, occurredAt: pulse, systemActorId: "receiz:pulse" }).projection;
    const site = Object.values(world.ecologySites)[0]!;
    assert.throws(() => service.execute({ type: "ecology.discover", siteId: site.id, position: site.position, commandId: "ecology:guest:discover" }, { ...authority("2026-07-15T21:01:00.000Z"), canonical: false }), /wilds_world_canonical_authority_required/);
  });

  it("admits one causally linked child on a later Pulse and never duplicates it", () => {
    const service = new WildsWorldService();
    const world = service.tickEcology({ pulse, occurredAt: pulse, systemActorId: "receiz:pulse" }).projection;
    const parent = Object.values(world.ecologySites).find((site) => site.familyId === "stormfront")!;
    service.execute({ type: "ecology.discover", siteId: parent.id, position: parent.position, commandId: "ecology:discover:storm" }, authority("2026-07-15T21:01:00.000Z"));
    service.execute({ type: "ecology.contribute", siteId: parent.id, position: parent.position, amount: 10, cardProofDigest: card.proof.digest, commandId: "ecology:resolve:storm" }, authority("2026-07-15T21:02:00.000Z"));

    service.tickEcology({ pulse: "2026-07-15T22:00:00.000Z", occurredAt: "2026-07-15T22:00:00.000Z", systemActorId: "receiz:pulse" });
    const children = Object.values(service.snapshot().ecologySites).filter((site) => site.parentSiteId === parent.id);
    service.tickEcology({ pulse: "2026-07-15T23:00:00.000Z", occurredAt: "2026-07-15T23:00:00.000Z", systemActorId: "receiz:pulse" });

    assert.equal(children.length, 1);
    assert.equal(Object.values(service.snapshot().ecologySites).filter((site) => site.parentSiteId === parent.id).length, 1);
  });

  it("advances a discovered site through its canonical timed lifecycle exactly once", () => {
    const service = new WildsWorldService();
    const world = service.tickEcology({ pulse, occurredAt: pulse, systemActorId: "receiz:pulse" }).projection;
    const site = Object.values(world.ecologySites).find((candidate) => candidate.familyId === "stormfront")!;
    service.execute({ type: "ecology.discover", siteId: site.id, position: site.position, commandId: "ecology:discover:lifecycle" }, authority("2026-07-15T21:01:00.000Z"));

    const activated = service.tickEcology({ pulse: site.activatesAt, occurredAt: site.activatesAt, systemActorId: "receiz:pulse" });
    assert.equal(activated.projection.ecologySites[site.id]?.phase, "active");
    assert.deepEqual(activated.events.filter((event) => (event.payload as { siteId?: string }).siteId === site.id).map((event) => event.kind), ["ecology.phase_changed"]);

    const resolved = service.tickEcology({ pulse: site.resolvesAt, occurredAt: site.resolvesAt, systemActorId: "receiz:pulse" });
    assert.equal(resolved.projection.ecologySites[site.id]?.phase, "aftermath");
    assert.equal(resolved.projection.ecologySites[site.id]?.resolvedAt, site.resolvesAt);
    assert.deepEqual(resolved.events.filter((event) => {
      const payload = event.payload as { siteId?: string; site?: { id?: string } };
      return payload.siteId === site.id || payload.site?.id === site.id;
    }).map((event) => event.kind), ["ecology.phase_changed", "ecology.resolved"]);

    const historicized = service.tickEcology({ pulse: site.historicizesAt, occurredAt: site.historicizesAt, systemActorId: "receiz:pulse" });
    assert.equal(historicized.projection.ecologySites[site.id]?.phase, "historical");
    assert.deepEqual(historicized.events.filter((event) => (event.payload as { site?: { id?: string } }).site?.id === site.id).map((event) => event.kind), ["ecology.historicized"]);
    const beforeDuplicate = service.checkpoint();
    const duplicate = service.tickEcology({ pulse: site.historicizesAt, occurredAt: site.historicizesAt, systemActorId: "receiz:pulse" });
    assert.equal(duplicate.events.length, 0);
    assert.deepEqual(service.checkpoint(), beforeDuplicate);
    assert.deepEqual(replayWildsWorld(service.events()), service.snapshot());
  });

  it("expires unresolved sites and releases the global cap for a fresh ensemble", () => {
    const service = new WildsWorldService();
    service.tickEcology({ pulse, occurredAt: pulse, systemActorId: "receiz:pulse" });
    service.tickEcology({ pulse: "2026-07-15T22:00:00.000Z", occurredAt: "2026-07-15T22:00:00.000Z", systemActorId: "receiz:pulse" });
    service.tickEcology({ pulse: "2026-07-15T23:00:00.000Z", occurredAt: "2026-07-15T23:00:00.000Z", systemActorId: "receiz:pulse" });
    const saturated = Object.values(service.snapshot().ecologySites);
    const saturatedIds = new Set(saturated.map((site) => site.id));
    assert.equal(saturated.length, 24);

    const expiryPulse = saturated.map((site) => site.expiresAt).sort().at(-1)!;
    const advanced = service.tickEcology({ pulse: expiryPulse, occurredAt: expiryPulse, systemActorId: "receiz:pulse" });
    const projection = Object.values(advanced.projection.ecologySites);
    const live = projection.filter((site) => site.phase !== "expired" && site.phase !== "historical");

    assert.equal(saturated.every((site) => advanced.projection.ecologySites[site.id]?.phase === "expired"), true);
    assert.equal(live.length > 0 && live.length <= 24, true);
    assert.equal(live.some((site) => !saturatedIds.has(site.id)), true);
  });
});
