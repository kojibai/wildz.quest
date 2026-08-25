import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "node:test";

import { WildsRegenerativeGroveExperience } from "../src/features/play/WildsRegenerativeGroveExperience";
import type { WildsRegenerativeGroveV1 } from "../src/features/play/wilds-regenerative-grove";

const grove = {
  groveId: "grove:test", regionId: "region:0:0", position: { x: 2, z: 3 },
  ecology: { soil: 62, moisture: 24, maturity: 38, flowers: 9, pollinators: 3, nourishment: 12 },
  materials: { pollen: 2, seeds: 1, fallenFiber: 3, nectar: 0, honey: 0 },
  structures: { hive: 0, nursery: 0 }, observed: true,
  weather: { season: "spring", temperatureBand: "mild", precipitation: { kind: "rain", intensity: .3 } },
  availableActions: ["water", "pollinate", "build-hive"], discoveries: [], restorationDebt: 0,
  revision: 1, head: "a".repeat(64)
} as unknown as WildsRegenerativeGroveV1;

describe("Regenerative Grove mobile experience", () => {
  it("leads with natural conditions, willing partnership, consequence, and bounded value", () => {
    const markup = renderToStaticMarkup(createElement(WildsRegenerativeGroveExperience, {
      open: true,
      grove,
      companion: { name: "Mellifera", willing: true, energy: 82, fatigue: 9 },
      actions: [
        { action: "water", valid: true, reason: null, consequence: "Moisture rises and young roots recover.", amountPhiMicro: "10000" },
        { action: "pollinate", valid: true, reason: null, consequence: "New flowers spread beyond this grove.", amountPhiMicro: "70000" },
        { action: "build-hive", valid: false, reason: "Another pair of willing hands would steady the frame.", consequence: "A hive would shelter future pollinators.", amountPhiMicro: "0" }
      ],
      busyAction: null,
      reconnecting: false,
      error: null,
      onAction() {},
      onExit() {}
    }));

    assert.match(markup, /The roots are thirsty/);
    assert.match(markup, /Mellifera is ready/);
    assert.match(markup, /New flowers spread beyond this grove/);
    assert.match(markup, /Φ0\.07/);
    assert.match(markup, /Another pair of willing hands/);
    assert.doesNotMatch(markup, /SDK|permission denied|tutorial|settlement rail/i);
  });

  it("preserves a staged action while its exact result reconnects", () => {
    const markup = renderToStaticMarkup(createElement(WildsRegenerativeGroveExperience, {
      open: true,
      grove,
      companion: { name: "Mellifera", willing: true, energy: 82, fatigue: 9 },
      actions: [{ action: "pollinate", valid: true, reason: null, consequence: "The bloom will widen.", amountPhiMicro: "70000" }],
      busyAction: "pollinate",
      reconnecting: true,
      error: null,
      onAction() {},
      onExit() {}
    }));
    assert.match(markup, /Holding this work safely/);
    assert.match(markup, /aria-busy="true"/);
    assert.match(markup, /disabled=""/);
  });

  it("uses fluid mobile geometry and keeps authority work out of the frame loop", () => {
    const css = readFileSync("app/globals.css", "utf8");
    const environment = readFileSync("src/features/play/WildsRegenerativeGroveEnvironment.tsx", "utf8");
    assert.match(css, /\.wilds-grove-experience[\s\S]*max-width:\s*min\(/);
    assert.match(css, /\.wilds-grove-action[\s\S]*min-height:\s*48px/);
    assert.doesNotMatch(css, /\.wilds-grove-experience[^}]*width:\s*\d+px/);
    const frameBodies = [...environment.matchAll(/useFrame\s*\(\s*\([^)]*\)\s*=>\s*\{([\s\S]*?)\}\s*\)/g)].map((match) => match[1]).join("\n");
    assert.doesNotMatch(frameBodies, /fetch\s*\(|verify|publish|Receiz|localStorage|new\s+Worker/);
  });
});
