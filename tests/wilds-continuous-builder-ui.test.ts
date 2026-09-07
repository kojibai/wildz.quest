import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("the playable construction center connects the component builder and physical world", () => {
  const campaign = readFileSync("src/features/play/PlayCampaign.tsx", "utf8");
  const canvas = readFileSync("src/features/play/WildsWorldCanvas.tsx", "utf8");
  assert.match(campaign, /useWildsContinuousBuilder/);
  assert.match(campaign, /Build with pieces/);
  assert.match(canvas, /WildsContinuousConstruction/);
});
