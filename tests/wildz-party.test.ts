import assert from "node:assert/strict";
import { test } from "node:test";
import { createDefaultWildzParty } from "../src/features/play/wildz-party";

test("default party keeps the human explorer and activates its proof-backed born creature", () => {
  const party = createDefaultWildzParty("receiz:key:one", "2026-07-18T12:00:00.000Z");
  assert.equal(party.explorerIdentityRef, "receiz:key:one");
  assert.match(party.activeCompanion.assetId, /^wilds:/);
  assert.match(party.activeCompanion.proofDigest, /^sha256:/);
  assert.notEqual(party.activeCompanion.name, "SealCub");
  assert.ok(party.activeCompanion.speciesId);
  assert.ok(party.activeCompanion.familyId);
});
