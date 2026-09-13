import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { applyWildsInput, initialPlayState } from "../src/features/play/game-state";
import { readWildsCrewCondition } from "../src/features/play/wilds-crew-policy";
import { canWildsCrewTravel } from "../src/features/play/wilds-crew-physical-navigation";
import { createWildsCrewPathStepState, writeWildsCrewFollowingStep, type WildsCrewNavigationAuthority } from "../src/features/play/wilds-crew-navigation";

function catchCard() {
  return applyWildsInput({ ...initialPlayState, player: { x: 1.6, z: -2.1 } }, {
    type: "capture", encounterId: "new-companion-follow", capturedAt: "2026-07-13T15:00:00.000Z", ownerReceizId: "player.receiz.id"
  });
}
test("a newly caught selected card follows without needing a separate adventure condition record", () => {
  const state = catchCard(), captured = state.inventory.at(-1)!;
  assert.equal(state.inventory.length, initialPlayState.inventory.length + 1);
  assert.equal(state.selectedAssetId, captured.id);
  assert.equal(state.adventureConditions[captured.id], undefined);
  const condition = readWildsCrewCondition(captured, state.adventureConditions);
  assert.equal(canWildsCrewTravel(condition), true);
  const position = { x: 0, y: 0, z: 0 }, target = { x: 3, y: 0, z: 0 };
  const routeState = createWildsCrewPathStepState(), directState = createWildsCrewPathStepState();
  const authority: WildsCrewNavigationAuthority = { mode: "walk", permittedModes: ["walk"],
    sampleSegment(_from, to, _mode, out) { out.allowed = true; out.y = to.y; } };
  for (let frame = 0; frame < 60; frame++) if (canWildsCrewTravel(condition)) {
    writeWildsCrewFollowingStep(position, target, [], routeState, directState, [target], { ...authority, speed: 5.5, deltaSeconds: 1 / 60 });
  }
  assert.ok(position.x > 2, "the caught companion physically walks toward its formation position");
});
test("real fatigue and malformed card proofs still prevent new-companion movement", () => {
  const state = catchCard(), captured = state.inventory.at(-1)!;
  const condition = readWildsCrewCondition(captured, state.adventureConditions)!;
  assert.equal(canWildsCrewTravel(readWildsCrewCondition(captured, { [captured.id]: { ...condition, fatigue: 90 } })), false);
  const invalid = structuredClone(captured); invalid.manifest.name = "tampered";
  assert.equal(canWildsCrewTravel(readWildsCrewCondition(invalid, {})), false);
});
test("active and support followers use the same verified new-card condition fallback", () => {
  const source = readFileSync("src/features/play/WildsWorldCanvas.tsx", "utf8");
  const active = source.slice(source.indexOf("function ActiveCompanion("), source.indexOf("function SupportCompanions("));
  const support = source.slice(source.indexOf("function SupportCompanion("), source.indexOf("function SupportCompanion(") + 2400);
  assert.match(active, /readWildsCrewCondition\(asset, state\.adventureConditions\)/);
  assert.match(support, /readWildsCrewCondition\(card,/);
});
