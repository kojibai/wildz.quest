import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { describe, it } from "node:test";

describe("signature trainer identity", () => {
  it("ships optimized Lanternforge portrait and emblem assets", () => {
    const portrait = "public/game/trainers/lanternforge-keeper-portrait.webp";
    const emblem = "public/game/trainers/lanternforge-emblem.webp";
    assert.ok(statSync(portrait).size > 50_000);
    assert.ok(statSync(portrait).size < 120_000);
    assert.ok(statSync(emblem).size > 20_000);
    assert.ok(statSync(emblem).size < 80_000);
    assert.equal(readFileSync(portrait).subarray(8, 12).toString(), "WEBP");
    assert.equal(readFileSync(emblem).subarray(8, 12).toString(), "WEBP");
  });

  it("uses the real portrait and emblem in challenge and transition surfaces", () => {
    const encounter = readFileSync("src/features/play/WildsTrainerEncounter.tsx", "utf8");
    assert.match(encounter, /trainer\.name === "Lanternforge Keeper"/);
    assert.match(encounter, /\/game\/trainers\/lanternforge-keeper-portrait\.webp/);
    assert.match(encounter, /\/game\/trainers\/lanternforge-emblem\.webp/);
    assert.match(encounter, /priority/);
  });

  it("maps trainer entry and companion detents to gesture-unlocked synthesized cues", () => {
    const audio = readFileSync("src/features/play/wilds-audio.ts", "utf8");
    const campaign = readFileSync("src/features/play/PlayCampaign.tsx", "utf8");
    const command = readFileSync("src/features/play/WildsCompanionCommand.tsx", "utf8");
    assert.match(audio, /"trainer-challenge": \{ frequency: 196, endFrequency: 880/);
    assert.match(audio, /"companion-detent": \{ frequency: 720, endFrequency: 880/);
    assert.match(campaign, /presentation\.playCue\("trainer-challenge"\)/);
    assert.match(command, /onAudioCue\?\.\("companion-detent"\)/);
  });
});
