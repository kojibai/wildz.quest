import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

test("world HUD is one active-creature capsule, one objective, and orientation", () => {
  const hud = read("src/features/play/WildzReferenceHud.tsx");
  assert.match(hud, /WildsCreatureThumbnail/);
  assert.match(hud, /activeCard/);
  assert.match(hud, /wildz-companion-vitality/);
  assert.match(hud, /wildz-mission-chip/);
  assert.match(hud, /<WildzMinimap/);
  assert.doesNotMatch(hud, /wildz-status-rail|wildz-energy-meter|wildz-xp-meter/);
});

test("campaign removes duplicate world chrome and persistent distant trainer navigation", () => {
  const campaign = read("src/features/play/PlayCampaign.tsx");
  for (const legacy of ["wilds-hud-top", "wilds-resource-strip", "runner-card", "wilds-mission-meter", "wilds-trainer-navigator"]) {
    assert.doesNotMatch(campaign, new RegExp(legacy));
  }
  assert.match(campaign, /activeCard=\{activeAsset\}/);
  assert.match(campaign, /condition=\{activeAsset \? state\.adventureConditions\[activeAsset\.id\] : undefined\}/);
});

test("visible trainers remain directly tappable and show challenge copy only within twelve meters", () => {
  const world = read("src/features/play/WildsWorldCanvas.tsx");
  assert.match(world, /onClick=\{\(event\) => \{ event\.stopPropagation\(\); onSelect\(trainer\); \}\}/);
  assert.match(world, /distance <= 12/);
  assert.match(world, /wilds-trainer-challenge-prompt/);
  assert.match(world, /Battle trainer/);
});

test("mobile HUD reserves corners and leaves target prompts unobstructed", () => {
  const css = read("app/globals.css");
  assert.match(css, /\.wildz-companion-capsule\s*\{/);
  assert.match(css, /\.wilds-trainer-challenge-prompt\s*\{/);
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*\.wildz-companion-capsule/s);
});
