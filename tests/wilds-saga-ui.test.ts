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
    assert.doesNotMatch(`${panel}\n${campaign}`, /Brandable reward|brandable merchant|portable merchant rewards/i);
  });
});
