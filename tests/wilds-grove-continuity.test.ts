import assert from "node:assert/strict";
import test from "node:test";
import { canonicalPortableCardJson } from "../src/features/play/portable-card";
import { WildsWorldService } from "../src/features/play/wilds-world-service";

const PULSE = "2026-07-15T00:00:00.000Z";

function livingGenesis() {
  const service = new WildsWorldService();
  service.tick({ pulse: PULSE, occurredAt: PULSE, systemActorId: "receiz:pulse" });
  service.tickEcology({ pulse: PULSE, occurredAt: PULSE, systemActorId: "receiz:pulse" });
  service.tickGroves({ pulse: PULSE, occurredAt: PULSE, systemActorId: "receiz:pulse" });
  return service;
}

test("refresh, checkpoint replay, export/import, and device restore preserve exact living heads", () => {
  const source = livingGenesis();
  const serialized = JSON.stringify({ checkpoint: source.checkpoint(), events: source.events() });
  const restoredRecord = JSON.parse(serialized);
  const refreshed = new WildsWorldService(restoredRecord).snapshot();
  const secondDevice = new WildsWorldService({ checkpoint: restoredRecord.checkpoint }).snapshot();

  assert.equal(Object.keys(refreshed.groves).length, 25);
  assert.ok(refreshed.worldEmission);
  assert.equal(canonicalPortableCardJson(refreshed), canonicalPortableCardJson(source.snapshot()));
  assert.equal(canonicalPortableCardJson(secondDevice), canonicalPortableCardJson(source.snapshot()));
  assert.equal(refreshed.cursor?.eventId, source.snapshot().cursor?.eventId);
  assert.equal(refreshed.worldEmission?.head, source.snapshot().worldEmission?.head);
});
