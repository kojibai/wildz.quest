import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  headingRadiansToDegrees,
  projectWorldHeadingCompass,
  shortestHeadingDelta
} from "../src/features/play/world-heading-compass";

test("world heading degrees follow the movement and minimap convention", () => {
  assert.equal(headingRadiansToDegrees(0), 0);
  assert.equal(headingRadiansToDegrees(Math.PI / 2), 90);
  assert.equal(headingRadiansToDegrees(Math.PI), 180);
  assert.equal(headingRadiansToDegrees(-Math.PI / 2), 270);
  assert.equal(shortestHeadingDelta(1, 359), 2);
  assert.equal(shortestHeadingDelta(359, 1), -2);
});

test("compass centers the live facing and wraps cardinal ticks", () => {
  const compass = projectWorldHeadingCompass({ heading: -Math.PI / 180, x: 0, z: 0, landmarks: [] });
  assert.equal(compass.degrees, 359);
  assert.equal(compass.cardinal, "N");
  assert.equal(compass.ticks.find((tick) => tick.label === "N")?.offsetDegrees, 1);
  assert.equal(compass.ticks.find((tick) => tick.label === "NW")?.offsetDegrees, -44);
  assert.ok(compass.ticks.every((tick) => Math.abs(tick.offsetDegrees) <= 60));
});

test("compass projects only nearby bearings in its visible sixty degree arc", () => {
  const compass = projectWorldHeadingCompass({
    heading: 0,
    x: 0,
    z: 0,
    landmarks: [
      { id: "north", name: "North", position: { x: 0, z: -20 } },
      { id: "east", name: "East", position: { x: 20, z: 0 } },
      { id: "near-east", name: "Near east", position: { x: 10, z: -20 } }
    ]
  });
  assert.deepEqual(compass.landmarks.map((marker) => marker.id), ["north", "near-east"]);
  assert.equal(compass.landmarks[0]?.offsetDegrees, 0);
  assert.ok((compass.landmarks[1]?.offsetDegrees ?? 0) > 0);
});

test("reference HUD mounts the real heading compass and reserves a collision-safe top lane", () => {
  const hud = readFileSync("src/features/play/WildzReferenceHud.tsx", "utf8");
  const css = readFileSync("app/globals.css", "utf8");
  assert.match(hud, /<WildzDirectionCompass[^>]*heading=\{heading\}[^>]*x=\{model\.location\.x\}[^>]*z=\{model\.location\.z\}/s);
  assert.match(css, /\.wildz-direction-compass\s*\{[^}]*height:\s*26px;[^}]*pointer-events:\s*none;/s);
  assert.match(css, /\.wildz-reference-hud\s*\{[^}]*padding:\s*calc\(38px \+ env\(safe-area-inset-top\)\)/s);
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*\.wilds-map-status-home\s*\{[^}]*top:\s*calc\(110px \+ env\(safe-area-inset-top\)\)/s);
  assert.match(css, /\.wildz-app \.wilds-search-reticle\s*\{[^}]*top:\s*calc\(210px \+ var\(--wildz-stage-safe-top\)\)/s);
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*\.wildz-app \.wilds-search-reticle\s*\{[^}]*top:\s*calc\(164px \+ var\(--wildz-stage-safe-top\)\)/s);
  assert.match(css, /@media \(orientation: landscape\) and \(max-height: 500px\)[\s\S]*\.wildz-app \.wilds-search-reticle\s*\{[^}]*top:\s*calc\(148px \+ var\(--wildz-stage-safe-top\)\)/s);
});
