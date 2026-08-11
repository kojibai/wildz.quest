import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { deriveKaiKlokMoment } from "../src/features/play/kai-klok-moment";
import { projectKaiWorldExpression } from "../src/features/play/kai-moment-expression";
import { wildsLanternYaw } from "../src/features/play/WildsLantern";
import {
  DEFAULT_WILDS_VISUAL_SETTINGS,
  normalizeWildsVisualSettings,
  projectWildsNightRig
} from "../src/features/play/wilds-night-visibility";

function deepNight() {
  const genesis = deriveKaiKlokMoment({ occurredAt: "2024-05-10T06:45:41.888Z", authority: "world" });
  return projectKaiWorldExpression({
    ...genesis,
    ark: "Dream",
    arkIndex: 5,
    arkProgress: 0,
    dayProgress: 5 / 6
  });
}

test("night visibility settings fail safely to a readable lantern-equipped default", () => {
  assert.deepEqual(normalizeWildsVisualSettings(null), DEFAULT_WILDS_VISUAL_SETTINGS);
  assert.deepEqual(normalizeWildsVisualSettings({ lanternEnabled: false, nightVisibility: "high" }), {
    lanternEnabled: false,
    nightVisibility: "high"
  });
  assert.deepEqual(normalizeWildsVisualSettings({ lanternEnabled: "yes", nightVisibility: "unknown" }), DEFAULT_WILDS_VISUAL_SETTINGS);
});

test("visibility presets improve actors without changing canonical sky darkness", () => {
  const expression = deepNight();
  const cinematic = projectWildsNightRig(expression, { lanternEnabled: true, nightVisibility: "cinematic" });
  const balanced = projectWildsNightRig(expression, { lanternEnabled: true, nightVisibility: "balanced" });
  const high = projectWildsNightRig(expression, { lanternEnabled: true, nightVisibility: "high" });
  assert.ok(cinematic.characterFill < balanced.characterFill);
  assert.ok(balanced.characterFill < high.characterFill);
  assert.ok(cinematic.rim < balanced.rim);
  assert.ok(balanced.rim < high.rim);
  assert.ok(cinematic.lanternIntensity < balanced.lanternIntensity);
  assert.ok(balanced.lanternIntensity < high.lanternIntensity);
  assert.equal(expression.sky.luminance, deepNight().sky.luminance);

  const off = projectWildsNightRig(expression, { lanternEnabled: false, nightVisibility: "high" });
  assert.equal(off.lanternIntensity, 0);
  assert.equal(off.lanternVisible, false);
});

test("authored darkness enables the lantern while Ranked normalizes visibility", () => {
  const expression = projectKaiWorldExpression(deriveKaiKlokMoment({
    occurredAt: "2024-05-10T06:45:41.888Z",
    authority: "world"
  }));
  const cave = projectWildsNightRig(expression, { lanternEnabled: true, nightVisibility: "high" }, {
    authoredDarkness: 0.8,
    mode: "adventure"
  });
  assert.ok(cave.lanternIntensity > 0);

  const rankedHigh = projectWildsNightRig(expression, { lanternEnabled: true, nightVisibility: "high" }, {
    authoredDarkness: 0.8,
    mode: "ranked"
  });
  const rankedCinematic = projectWildsNightRig(expression, { lanternEnabled: true, nightVisibility: "cinematic" }, {
    authoredDarkness: 0.8,
    mode: "ranked"
  });
  assert.deepEqual(rankedHigh, rankedCinematic);
});

test("the Wilds lantern is a bounded non-shadow light rather than a second sun", () => {
  const source = readFileSync("src/features/play/WildsLantern.tsx", "utf8");
  assert.match(source, /<spotLight/);
  assert.match(source, /qualityTier !== "low"/);
  assert.match(source, /castShadow=\{false\}/);
  assert.match(source, /distance=\{8\}/);
  assert.doesNotMatch(source, /performance\.now|Date\.now/);
});

test("the flashlight cone follows the viewing heading", () => {
  assert.equal(wildsLanternYaw({ x: 0, z: -1 }), 0);
  assert.equal(wildsLanternYaw({ x: 1, z: 0 }), -Math.PI / 2);
  assert.equal(wildsLanternYaw({ x: -1, z: 0 }), Math.PI / 2);
});

test("the world renders Kai darkness instead of clamping a daylight sun above the horizon", () => {
  const world = readFileSync("src/features/play/WildsWorldCanvas.tsx", "utf8");
  const atmosphere = readFileSync("src/features/play/WildsAtmosphere.tsx", "utf8");
  assert.match(world, /<WildsCelestialSky expression=\{kaiExpression\}/);
  assert.match(world, /kaiExpression\.night\.amount \* 0\.7/);
  assert.match(world, /new THREE\.Color\(kaiExpression\.sky\.zenith\)/);
  assert.match(world, /<color attach="background" args=\{\[kaiSky\]\}/);
  assert.doesNotMatch(atmosphere, /Math\.max\(0\.6, expression\.sun\.elevation/);
  assert.match(atmosphere, /expression\.celestial\.moon/);
  assert.match(atmosphere, /nightRig\.characterFill/);
  assert.match(atmosphere, /nightRig\.rim/);
  assert.match(atmosphere, /<WildsLantern/);
});
