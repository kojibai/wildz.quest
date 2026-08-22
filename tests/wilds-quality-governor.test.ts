import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  createWildsQualityGovernor,
  readWildsLearnedQualityTier,
  updateWildsQualityGovernor,
  writeWildsLearnedQualityTier,
  writeWildsQualityGovernor
} from "../src/features/play/wilds-quality-governor";

describe("Wilds runtime quality governor", () => {
  it("lowers one tier after 120 sustained slow visible frames without oscillating", () => {
    let state = createWildsQualityGovernor("high");
    for (let index = 0; index < 120; index += 1) state = updateWildsQualityGovernor(state, { frameMs: 25, visible: true });
    assert.equal(state.tier, "medium");
    assert.equal(state.slowFrames, 0);
    state = updateWildsQualityGovernor(state, { frameMs: 8, visible: true });
    assert.equal(state.tier, "medium");
  });

  it("requires 600 healthy frames and the cooldown before restoring the base tier", () => {
    let state = createWildsQualityGovernor("high");
    for (let index = 0; index < 120; index += 1) state = updateWildsQualityGovernor(state, { frameMs: 26, visible: true });
    assert.equal(state.tier, "medium");
    for (let index = 0; index < 599; index += 1) state = updateWildsQualityGovernor(state, { frameMs: 12, visible: true, atMs: 34_000 + index * 12 });
    assert.equal(state.tier, "medium");
    state = updateWildsQualityGovernor(state, { frameMs: 12, visible: true, atMs: 34_000 + 599 * 12 });
    assert.equal(state.tier, "high");
  });

  it("never samples hidden frames or raises above the selected device base tier", () => {
    let state = createWildsQualityGovernor("medium");
    const hidden = updateWildsQualityGovernor(state, { frameMs: 90, visible: false });
    assert.deepEqual(hidden, state);
    for (let index = 0; index < 900; index += 1) state = updateWildsQualityGovernor(state, { frameMs: 8, visible: true });
    assert.equal(state.tier, "medium");
  });

  it("uses a bounded rolling frame window and clamps invalid samples", () => {
    let state = createWildsQualityGovernor("high");
    const frameWindow = state.frameWindow;
    for (let index = 0; index < 240; index += 1) state = updateWildsQualityGovernor(state, { frameMs: index % 2 ? Number.NaN : 1_000, visible: true });
    assert.equal(state.frameWindow, frameWindow, "frame sampling must reuse its bounded buffer instead of allocating every rendered frame");
    assert.ok(state.frameWindow.length <= 120);
    assert.ok(state.frameWindow.every((frameMs) => frameMs >= 4 && frameMs <= 100));
    assert.ok(Number.isFinite(state.averageFrameMs));
  });

  it("reuses one governor object across the rendered frame hot path", () => {
    const state = createWildsQualityGovernor("high");
    for (let index = 0; index < 10_000; index += 1) {
      assert.equal(writeWildsQualityGovernor(state, index % 2 ? 16 : 17, true, index * 17), state);
    }
    assert.equal(state.frameWindow.length, 120);
  });

  it("restores the learned tier after refresh without exceeding the current device tier", () => {
    const values = new Map<string, string>();
    let writes = 0;
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        writes += 1;
        values.set(key, value);
      }
    };

    writeWildsLearnedQualityTier(storage, "medium");
    assert.equal(writes, 1);
    assert.equal(readWildsLearnedQualityTier(storage, "high"), "medium");
    assert.equal(readWildsLearnedQualityTier(storage, "low"), "low", "a stored tier must never exceed a weaker current device base");

    values.set("wildz:quality:v1", "broken");
    assert.equal(readWildsLearnedQualityTier(storage, "high"), "high");
  });
});

describe("Wilds adaptive quality integration", () => {
  it("samples both world and arena render clocks through one responsive hook", () => {
    const hook = readFileSync("src/features/play/use-wilds-quality-profile.ts", "utf8");
    const world = readFileSync("src/features/play/WildsWorldCanvas.tsx", "utf8");
    const arena = readFileSync("src/features/games/mortal-arena/MortalArenaScene.tsx", "utf8");
    for (const token of ["resize", "orientationchange", "visibilityState", "reportFrameSample"]) assert.match(hook, new RegExp(token));
    assert.match(world, /WildsFrameReporter/);
    assert.match(world, /delta \* 1_000/);
    assert.match(arena, /MortalArenaFrameReporter/);
    assert.match(arena, /delta \* 1_000/);
  });

  it("loads noncritical world and encounter surfaces as independent chunks", () => {
    const campaign = readFileSync("src/features/play/PlayCampaign.tsx", "utf8");
    assert.match(campaign, /import \{ WildsWorldCanvas \} from "@\/features\/play\/WildsWorldCanvas"/);
    assert.doesNotMatch(campaign, /const WildsWorldCanvas = dynamic/);
    for (const surface of [
      "WildsWorldMap",
      "WildsLandmarkExperience",
      "WildsSettlementExperience",
      "WildsEcologyExperience",
      "WildsRaidExperience",
      "WildsTrainerEncounter",
      "MortalArenaExperience"
    ]) assert.match(campaign, new RegExp(`const ${surface} = dynamic`));
    assert.match(campaign, /void import\("@\/features\/games\/mortal-arena\/MortalArenaExperience"\)/);
  });
});
