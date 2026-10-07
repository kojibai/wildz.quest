import assert from "node:assert/strict";
import { test } from "node:test";
import { sealCollectedCard, sha256PortableBasis } from "../src/features/play/portable-card";
import { projectWildsResourceRegion } from "../src/features/play/wilds-resource-authority";
import { projectWildsResourceAffordance } from "../src/features/play/wilds-resource-affordance";
import { createWildsSourceAuthorityProjection, planWildsMaterialHarvest, replanQueuedWildsMaterialHarvest } from "../src/features/play/wilds-source-work-authority";
import { prepareWildsWorldOutboxEntry, prepareWildsWorldOutboxPublication, type WildsWorldOutboxEntry } from "../src/features/play/wilds-world-outbox";
import { createWildsMaterialHarvest, createWildsStewardHarvestOperation, initialWildsHarvestedSourceState } from "../src/features/play/wilds-steward-construction";
import { createWildsWorldEvent } from "../src/features/play/wilds-world-event";
import { WildsWorldService } from "../src/features/play/wilds-world-service";
import { createKaiTemporalRoot } from "../src/features/play/kai-temporal-root";
import { deriveKaiKlokMomentFromUPulse } from "../src/features/play/kai-klok-moment";

const actorId = "explorer:work-regression";
const timestamp = "2026-07-15T00:00:00.000Z";
const projection = createWildsSourceAuthorityProjection();
function sourceOf(kind: "timber" | "stone" | "hay") {
  for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) {
    const source = projectWildsResourceRegion(x, z).find(value => value.kind === kind);
    if (source) return source;
  }
  throw Error(`missing_${kind}`);
}
const card = (formId: string) => sealCollectedCard({ formId, capturedAt: timestamp, encounterId: `work-${formId}`, ownerReceizId: actorId });

test("a timber companion cannot silently fall back to player-only rock mining", () => {
  const source = sourceOf("stone");
  assert.throws(() => planWildsMaterialHarvest({ projection, source, actorId, actorPosition: source.position,
    kaiUPulse: 1_000_000, commandId: "command:work:timber-rock", card: card("mintcub-1") }), /wilds_steward_creature_unqualified/);
});

test("new timber and stone harvesting require the matching companion", () => {
  for (const kind of ["timber", "stone"] as const) {
    const source = sourceOf(kind);
    assert.throws(() => planWildsMaterialHarvest({ projection, source, actorId, actorPosition: source.position,
      kaiUPulse: 1_000_000, commandId: `command:work:solo-${kind}` }), /wilds_world_verified_card_required/);
    const matching = card(kind === "timber" ? "mintcub-1" : "titanseal-1");
    const command = planWildsMaterialHarvest({ projection, source, actorId, actorPosition: source.position,
      kaiUPulse: 1_000_000, commandId: `command:work:qualified-${kind}`, card: matching });
    assert.equal(command.cardProofDigest, matching.proof.digest);
    assert.equal(command.operation?.participants.some(value => value.kind === "creature"), true);
  }
});

test("earlier player-only material proof history still restores unchanged", () => {
  const source = sourceOf("stone"), current = initialWildsHarvestedSourceState(source);
  // These old proof bytes remain legal historical evidence, even though the
  // same action can no longer be planned through new gameplay without it.
  const harvest = createWildsMaterialHarvest({ source, current, ownerReceizId: actorId,
    actorPosition: source.position, kaiUPulse: 1_000_000 });
  const operation = createWildsStewardHarvestOperation({ source, currentSource: current, harvestedSource: harvest.source,
    lot: harvest.lot, ownerReceizId: actorId, playerHead: sha256PortableBasis(actorId), kaiUPulse: 1_000_000 });
  const event = createWildsWorldEvent({ kind: "resource.material_harvested", actorId, causeId: "command:work:historical",
    pulse: timestamp, occurredAt: timestamp, uPulse: 1_000_000, kaiKlok: 1, previousEventId: null,
    payload: { source, sourceState: harvest.source, lot: harvest.lot, tool: null, operation } });
  const restored = new WildsWorldService({ events: [event] });
  assert.deepEqual(restored.snapshot().materialLots[harvest.lot.lotId], harvest.lot);
  assert.deepEqual(new WildsWorldService({ checkpoint: restored.checkpoint() }).snapshot().materialLots, restored.snapshot().materialLots);
});

test("already durable solo work retains its lot and can publish without blocking the outbox", () => {
  const source = sourceOf("stone");
  const input = { projection, source, actorId, actorPosition: source.position, kaiUPulse: 1_000_000,
    kai: createKaiTemporalRoot(deriveKaiKlokMomentFromUPulse({ uPulse: 1_000_000, authority: "local" })), commandId: "command:work:old-queued" };
  const entry: WildsWorldOutboxEntry = { schema: "receiz.wilds_world_outbox_entry.v1", actorId,
    guestId: "guest-work-regression", queuedAt: timestamp, command: replanQueuedWildsMaterialHarvest(input) };
  const first = prepareWildsWorldOutboxEntry(projection, entry);
  assert.equal(Object.values(first.projection.materialLots)[0]?.contributors.creatureSubjectId, undefined);
  const publication = prepareWildsWorldOutboxPublication(entry, command => replanQueuedWildsMaterialHarvest({ ...input, source: command.source }));
  assert.deepEqual(publication.command, entry.command);
  assert.deepEqual(prepareWildsWorldOutboxEntry(projection, publication).projection.materialLots, first.projection.materialLots);
  assert.throws(() => planWildsMaterialHarvest(input), /wilds_world_verified_card_required/);
});

test("hay keeps its existing player gathering path", () => {
  const source = sourceOf("hay");
  const command = planWildsMaterialHarvest({ projection, source, actorId, actorPosition: source.position,
    kaiUPulse: 1_000_000, commandId: "command:work:hay" });
  const result = new WildsWorldService().execute(command,
    { actorId, canonical: true, pulse: timestamp, occurredAt: timestamp, uPulse: 1_000_000 });
  assert.equal(Object.values(result.projection.materialLots)[0]?.kind, "hay");
});

test("stone affordance explains the required work instead of promising an unsupported harvest", () => {
  assert.equal(projectWildsResourceAffordance({ kind: "stone", distance: 4, availableCapacity: 8,
    pending: false, companionQualified: false, companionReady: true }).state, "companion");
  assert.equal(projectWildsResourceAffordance({ kind: "stone", distance: 4, availableCapacity: 8,
    pending: false, companionQualified: true, companionReady: false }).state, "rest");
});
