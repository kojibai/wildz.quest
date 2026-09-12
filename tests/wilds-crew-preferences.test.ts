import assert from "node:assert/strict";
import { test } from "node:test";
import { createOwnerBoundInitialPlayState, restorePlayState, serializePlayState } from "../src/features/play/game-state";
import { sanitizeWildsCrewPreferences, setWildsCrewPreference } from "../src/features/play/wilds-crew-preferences";

test("per-creature movement preference persists through owner-bound restore", () => {
  const state = createOwnerBoundInitialPlayState("crew_owner", "2026-09-12T12:00:00.000Z");
  state.crewPreferences = setWildsCrewPreference(undefined, state.inventory, "crew_owner", state.selectedAssetId, "roam");
  const restored = restorePlayState(serializePlayState(state), "crew_owner");
  assert.deepEqual(restored.crewPreferences, state.crewPreferences);
  const next = setWildsCrewPreference(restored.crewPreferences, restored.inventory, "crew_owner", state.selectedAssetId, "follow");
  assert.equal(next?.byAssetId[state.selectedAssetId], "follow");
  assert.equal(state.crewPreferences?.byAssetId[state.selectedAssetId], "roam");
});

test("foreign owner, transferred or missing cards and malformed modes do not restore preferences", () => {
  const state = createOwnerBoundInitialPlayState("crew_owner", "2026-09-12T12:00:00.000Z");
  const assetId = state.selectedAssetId;
  const prefs = { ownerReceizId: "crew_owner", byAssetId: { [assetId]: "roam", missing: "follow" } };
  assert.deepEqual(sanitizeWildsCrewPreferences(prefs, state.inventory, "crew_owner"), { ownerReceizId: "crew_owner", byAssetId: { [assetId]: "roam" } });
  assert.equal(sanitizeWildsCrewPreferences(prefs, state.inventory, "other_owner"), undefined);
  assert.equal(sanitizeWildsCrewPreferences(prefs, state.inventory), undefined);
  assert.deepEqual(sanitizeWildsCrewPreferences(prefs, [], "crew_owner")?.byAssetId, {});
  assert.deepEqual(sanitizeWildsCrewPreferences({ ...prefs, byAssetId: { [assetId]: "build" } }, state.inventory, "crew_owner")?.byAssetId, {});
  assert.equal(setWildsCrewPreference(undefined, state.inventory, "other_owner", assetId, "follow"), undefined);
  assert.equal(setWildsCrewPreference(undefined, state.inventory, "crew_owner", "missing", "follow"), undefined);
});
