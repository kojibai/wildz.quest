import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("the gameplay HUD exposes live Satchel totals and a dedicated construction center", () => {
  const campaign = readFileSync("src/features/play/PlayCampaign.tsx", "utf8");
  const controls = readFileSync("src/features/play/WildzWorldControls.tsx", "utf8");
  const dock = readFileSync("src/features/play/WildsCommandDock.tsx", "utf8");
  assert.match(controls, /materialCounts/);
  assert.match(controls, /Open Living Construction/);
  assert.match(controls, /onRequestWork/);
  assert.match(controls, /Mountain grip/);
  assert.match(controls, /Icons\.climb/);
  assert.match(controls, /Satchel/);
  assert.match(campaign, /key: "construction"/);
  assert.match(campaign, /Living Construction/);
  assert.match(dock, /"construction"/);
});
