import assert from "node:assert/strict";
import { test } from "node:test";
import { initialPlayState } from "../src/features/play/game-state";
import { projectWildzHud } from "../src/features/play/wildz-gameplay-hud";

test("HUD projection exposes existing energy XP mission and companion state", () => {
  const model = projectWildzHud(initialPlayState, { username: "minttrail", displayName: "Mint Trail" });
  assert.equal(model.player.username, "minttrail");
  assert.equal(model.player.displayName, "Mint Trail");
  assert.equal(model.energy.current, initialPlayState.energy);
  assert.equal(model.xp.current, initialPlayState.cardXp);
  assert.equal(model.mission.progress, initialPlayState.missionProgress);
  assert.equal(model.companion.name, "SealCub");
});

test("HUD projection preserves bounded percentages", () => {
  const model = projectWildzHud({ ...initialPlayState, energy: 101, cardXp: 200, challenge: -1, missionProgress: 999 }, { username: "trail", displayName: "Trail" });
  assert.equal(model.energy.current, 100);
  assert.equal(model.xp.progress, 0);
  assert.equal(model.mission.progress, 100);
});
