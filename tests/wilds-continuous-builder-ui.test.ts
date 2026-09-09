import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("the playable construction center connects the component builder and physical world", () => {
  const campaign = readFileSync("src/features/play/PlayCampaign.tsx", "utf8");
  const canvas = readFileSync("src/features/play/WildsWorldCanvas.tsx", "utf8");
  assert.match(campaign, /useWildsContinuousBuilder/);
  assert.match(campaign, /onSelectPiece=\{selectLivingBuildPiece\}/);
  assert.match(campaign, /onUse=\{kind => openLivingConstruction/);
  assert.match(canvas, /WildsContinuousConstruction/);
});

test("placed pieces require explicit unlocking before world gestures can move them", () => {
  const hook = readFileSync("src/features/play/use-wilds-continuous-builder.ts", "utf8");
  const panel = readFileSync("src/features/play/WildsContinuousBuilderPanel.tsx", "utf8");
  const campaign = readFileSync("src/features/play/PlayCampaign.tsx", "utf8");
  assert.match(hook, /!adjusting\s*\|\|\s*selectedId\s*!==\s*id/);
  assert.match(panel, /onClick=\{builder.beginAdjustment\}/);
  assert.match(panel, /Unlock to adjust/);
  assert.match(campaign, /onDragConstruction=\{continuousBuilder.adjusting\s*\?\s*continuousBuilder.dragPiece\s*:\s*undefined\}/);
});
