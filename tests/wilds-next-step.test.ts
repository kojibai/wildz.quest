import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { projectWildsNextStep, type WildsNextStepInput } from "../src/features/play/wilds-next-step.js";

const start: WildsNextStepInput = { hasCompanion: false, timber: 0, stone: 0, hasShelter: false, hasWorkbench: false, hasCache: false };

describe("next adventure guidance", () => {
  it("guides the complete companion, shelter, workbench, cache and exploration loop", () => {
    assert.equal(projectWildsNextStep(start).action, "scan");
    const companion = { ...start, hasCompanion: true };
    assert.equal(projectWildsNextStep(companion).action, "gather-timber");
    assert.equal(projectWildsNextStep({ ...companion, timber: 2 }).action, "gather-stone");
    assert.equal(projectWildsNextStep({ ...companion, timber: 2, stone: 1 }).action, "shelter");
    const home = { ...companion, hasShelter: true };
    assert.equal(projectWildsNextStep(home).action, "gather-timber");
    assert.equal(projectWildsNextStep({ ...home, timber: 3, stone: 2 }).action, "workbench");
    const workshop = { ...home, hasWorkbench: true };
    assert.equal(projectWildsNextStep({ ...workshop, timber: 2, stone: 1 }).action, "gather-stone");
    assert.equal(projectWildsNextStep({ ...workshop, timber: 2, stone: 2 }).action, "cache");
    assert.equal(projectWildsNextStep({ ...workshop, hasCache: true }).action, "explore");
  });
  it("uses only remaining resources and never prescribes a workbench before shelter", () => {
    const step = projectWildsNextStep({ ...start, hasCompanion: true, timber: 1, stone: 1 });
    assert.match(step.reason, /Gather 1 timber for your trail shelter/);
    assert.equal(step.action, "gather-timber");
    assert.doesNotMatch(step.reason, /workbench/);
  });
  it("does not interpret invalid or fractional inventory as sufficient materials", () => {
    const companion = { ...start, hasCompanion: true };
    for (const timber of [NaN, Infinity, -2, 1.9]) assert.equal(projectWildsNextStep({ ...companion, timber, stone: 1 }).action, "gather-timber");
  });
  it("does not make existing homes repeat completed building steps", () => {
    const established = { ...start, hasCompanion: true, hasShelter: true, hasWorkbench: true, hasCache: true };
    assert.equal(projectWildsNextStep(established).action, "explore");
    assert.equal(projectWildsNextStep({ ...established, hasCompanion: false }).action, "scan");
  });
});
