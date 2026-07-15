import assert from "node:assert/strict";
import { test } from "node:test";
import { createDefaultWildzParty } from "../src/features/play/wildz-party";

test("default party keeps the human explorer and activates Sealcub", () => {
  const party = createDefaultWildzParty("receiz:key:one");
  assert.equal(party.explorerIdentityRef, "receiz:key:one");
  assert.equal(party.activeCompanion.speciesId, "sealcub");
  assert.equal(party.activeCompanion.familyId, "mintcub");
  assert.equal(party.activeCompanion.name, "SealCub");
});
