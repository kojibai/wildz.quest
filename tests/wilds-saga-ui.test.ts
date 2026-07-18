import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("living saga interface", () => {
  it("presents the shared chapter, causal history, objectives, trainers, and tournament accessibly", () => {
    const panel = source("src/features/play/WildsSagaPanel.tsx");
    const hud = source("src/features/play/WildsLivingWorldHud.tsx");
    const campaign = source("src/features/play/PlayCampaign.tsx");

    for (const phrase of [
      "Today's living chapter",
      "Next objective",
      "Why the world changed",
      "Trainer level",
      "Daily tournament",
      "Story so far",
      'aria-live="polite"',
      "worldMutable"
    ]) assert.match(panel, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

    assert.match(hud, /activeChapter/);
    assert.match(campaign, /WildsSagaPanel/);
    assert.match(campaign, /nearestSagaTrainer/);
    assert.match(campaign, /activeTrainer/);
    assert.match(campaign, /MortalArenaExperience/);
    assert.doesNotMatch(`${panel}\n${campaign}`, /Brandable reward|brandable merchant|portable merchant rewards/i);
  });

  it("projects trainer NPCs into the world and atlas with distance guidance", () => {
    const campaign = source("src/features/play/PlayCampaign.tsx");
    const world = source("src/features/play/WildsWorldCanvas.tsx");
    const map = source("src/features/play/WildsWorldMap.tsx");
    const atlas = source("src/features/play/wilds-world-atlas.ts");

    assert.match(world, /TrainerExplorer/);
    assert.match(world, /trainers\.map/);
    assert.match(map, /trainers/);
    assert.match(atlas, /trainers:/);
    assert.match(campaign, /m away/);
  });

  it("keeps living-world pills contextual and lets a solo player enter the selected boss raid", () => {
    const hud = source("src/features/play/WildsLivingWorldHud.tsx");
    const campaign = source("src/features/play/PlayCampaign.tsx");

    assert.match(hud, /type LivingWorldDetail/);
    assert.match(hud, /setDetail\(\{ kind: "boss"/);
    assert.match(hud, /setDetail\(\{ kind: "ecology"/);
    assert.match(hud, /Health remaining/);
    assert.match(hud, /Fight solo/);
    assert.match(hud, /onEnterRaid\(selectedBoss\.id\)/);
    assert.doesNotMatch(hud, /world\.joinRaid\(/);
    assert.match(campaign, /onEnterRaid=\{enterLivingRaid\}/);
  });
});
