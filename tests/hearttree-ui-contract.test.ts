import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

describe("Hearttree full-runtime UI contract", () => {
  it("drives every deterministic runtime intent from the existing landmark surface", async () => {
    const experience = await readFile("src/features/play/hearttree/HearttreeRuntimeExperience.tsx", "utf8");
    const hook = await readFile("src/features/play/hearttree/use-hearttree-expedition.ts", "utf8");
    const controls = await readFile("src/features/play/hearttree/HearttreeControls.tsx", "utf8");
    assert.match(experience, /wilds-landmark-experience/);
    assert.match(experience, /wilds-landmark-header/);
    assert.match(experience, /wilds-landmark-actions/);
    assert.match(experience, /\/api\/wilds\/hearttree/);
    assert.match(experience, /permanent-death/);
    assert.match(experience, /aria-live="polite"/);
    assert.match(hook, /createHearttreeRuntime/);
    assert.match(hook, /stepHearttreeRuntime/);
    assert.match(hook, /generateHearttreeExpedition/);
    assert.match(hook, /hearttreeTranscript/);
    for (const intent of ["move", "dodge", "guard", "ability", "switch", "interact", "extract"]) assert.match(controls, new RegExp(`kind: ["']${intent}["']`));
    assert.match(controls, /health/);
    assert.match(controls, /stamina/);
    assert.match(controls, /cooldowns/);
    assert.match(controls, /onPointerDown/);
    assert.match(controls, /onPointer(?:Up|Cancel)/);
    assert.match(controls, /clearInterval/);
  });

  it("renders a lightweight real Three.js chamber without adding an audio system", async () => {
    const scene = await readFile("src/features/play/hearttree/HearttreeScene.tsx", "utf8");
    const experience = await readFile("src/features/play/hearttree/HearttreeRuntimeExperience.tsx", "utf8");
    assert.match(scene, /<Canvas/);
    assert.match(scene, /dpr=\{\[1, 1\.5\]\}/);
    assert.match(scene, /hearttree-hazards/);
    assert.match(scene, /hearttree-objective/);
    assert.match(scene, /hearttree-root-master/);
    assert.match(scene, /__HEARTTREE_DIAGNOSTICS__/);
    assert.doesNotMatch(`${scene}\n${experience}`, /hearttree\/(music|ambience)|HearttreeAudioSignal|audio\/wilds\/hearttree/);
  });

  it("fits the existing mobile landmark surface without a blank or overlapping footer", async () => {
    const css = await readFile("app/globals.css", "utf8");
    assert.match(css, /\.hearttree-expedition[\s\S]*grid-template-rows:\s*auto minmax\(0, 1fr\) auto/);
    assert.match(css, /\.hearttree-runtime-world[\s\S]*min-height:\s*0[\s\S]*overflow:\s*hidden/);
    assert.match(css, /\.hearttree-runtime-actions \.hearttree-controls[\s\S]*position:\s*relative/);
    assert.match(css, /\.hearttree-touch-control[\s\S]*min-height:\s*44px/);
    assert.match(css, /@media \(max-width:\s*430px\)[\s\S]*\.hearttree-action-wheel/);
    assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*\.hearttree-touch-control/);
  });

  it("replaces only the unlocked Hearttree body and persists squad and verified receipts", async () => {
    const landmark = await readFile("src/features/play/WildsLandmarkExperience.tsx", "utf8");
    const campaign = await readFile("src/features/play/PlayCampaign.tsx", "utf8");
    assert.match(landmark, /<HearttreeRuntimeExperience/);
    assert.doesNotMatch(landmark, /createHearttreeTrial|applyHearttreeIntent/);
    assert.match(campaign, /hearttreeConditions=\{state\.hearttreeConditions\}/);
    assert.match(campaign, /hearttreeSquadAssetIds=\{state\.hearttreeSquadAssetIds\}/);
    assert.match(campaign, /type:\s*["']hearttree-admit["']/);
    assert.match(campaign, /type:\s*["']hearttree-select-squad["']/);
  });
});
