import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const campaign = readFileSync("src/features/play/PlayCampaign.tsx", "utf8");
const companion = readFileSync("src/features/play/WildsCompanionCommand.tsx", "utf8");
const trainer = readFileSync("src/features/play/WildsTrainerEncounter.tsx", "utf8");
const arena = readFileSync("src/features/games/mortal-arena/MortalArenaExperience.tsx", "utf8");
const css = readFileSync("app/globals.css", "utf8");

describe("flagship mobile release contracts", () => {
  it("keeps primary gameplay interactions semantic and keyboard reachable", () => {
    assert.match(companion, /onKeyDown/);
    for (const key of ["Enter", "ArrowLeft", "ArrowRight", "ArrowUp", "Escape"]) assert.match(companion, new RegExp(key));
    assert.match(companion, /aria-activedescendant/);
    assert.match(trainer, /aria-modal="true"/);
    assert.match(trainer, /role="dialog"/);
    assert.match(trainer, /aria-live="assertive"/);
    assert.match(arena, /aria-label="Mortal Arena actions"/);
    assert.doesNotMatch(`${companion}\n${trainer}\n${arena}`, /<div[^>]*onClick=/);
  });

  it("preserves safe areas, thumb-sized controls, and reduced-motion alternatives", () => {
    assert.match(css, /env\(safe-area-inset-top\)/);
    assert.match(css, /env\(safe-area-inset-right\)/);
    assert.match(css, /env\(safe-area-inset-bottom\)/);
    assert.match(css, /env\(safe-area-inset-left\)/);
    assert.match(css, /\.wilds-companion-command\s*\{[^}]*width:\s*clamp\(72px, 22vw, 94px\);[^}]*aspect-ratio:\s*1/);
    assert.match(css, /\.mortal-arena-primary-strike\s*\{[^}]*min-height:\s*68px/);
    assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
    assert.match(css, /\.wilds-trainer-transition-energy\s*\{\s*animation:\s*none/);
    assert.match(css, /@media \(orientation: landscape\) and \(max-height: 500px\)/);
    assert.match(css, /\.wildz-social-stack\s*\{[^}]*position:\s*absolute;[^}]*pointer-events:\s*none;/);
  });

  it("keeps world, challenge, and combat as one uninterrupted state-owned journey", () => {
    assert.match(campaign, /trainerEncounter\?\.phase === "combat"/);
    assert.match(campaign, /settlementId: settlement\.id/);
    assert.match(campaign, /onSelectTrainer=\{openTrainerEncounter\}/);
    assert.match(campaign, /resultPresentation="director"/);
    assert.match(campaign, /useWildsQualityProfile/);
    assert.doesNotMatch(campaign, /wilds-trainer-navigator/);
  });
});
