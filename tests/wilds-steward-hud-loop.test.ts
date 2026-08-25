import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("the gameplay HUD exposes live Satchel totals and a dedicated construction center", () => {
  const campaign = readFileSync("src/features/play/PlayCampaign.tsx", "utf8");
  const controls = readFileSync("src/features/play/WildzWorldControls.tsx", "utf8");
  const capabilityControls = readFileSync("src/features/play/WildsCapabilityControls.tsx", "utf8");
  const registry = readFileSync("src/features/play/wilds-world-capability-registry.ts", "utf8");
  const dock = readFileSync("src/features/play/WildsCommandDock.tsx", "utf8");
  assert.match(controls, /materialCounts/);
  assert.match(controls, /Open Living Construction/);
  assert.match(controls, /onRequestCapability/);
  assert.match(controls, /WildsCapabilityControls/);
  assert.match(capabilityControls, /CAPABILITY_ICONS/);
  assert.match(registry, /climb: define\("climb"/);
  assert.match(controls, /Satchel/);
  assert.match(campaign, /key: "construction"/);
  assert.match(campaign, /Living Construction/);
  assert.match(dock, /"construction"/);
});
