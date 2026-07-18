import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("gameplay composes the reference HUD and social deck over the preserved world", () => {
  const source = readFileSync("src/features/play/PlayCampaign.tsx", "utf8");
  for (const token of ["WildsWorldCanvas", "WildzReferenceHud", "WildzSocialDeck"]) assert.match(source, new RegExp(token));
  assert.doesNotMatch(source, /WildsWorldControls/);
  const world = readFileSync("src/features/play/WildsWorldCanvas.tsx", "utf8");
  assert.match(world, /ActiveCompanion/);
});

test("world camera matches the current Commerce gesture framing", () => {
  const world = readFileSync("src/features/play/WildsWorldCanvas.tsx", "utf8");
  assert.match(world, /camera=\{\{ fov: 42, near: 0\.1, far: 80, position: \[4\.6, 5\.8, 7\.2\] \}\}/);
  assert.match(world, /enableDamping/);
  assert.match(world, /enablePan=\{false\}/);
  assert.match(world, /minDistance=\{4\.8\}/);
  assert.match(world, /maxDistance=\{13\.5\}/);
  assert.match(world, /minPolarAngle=\{\.38\}/);
  assert.match(world, /maxPolarAngle=\{Math\.PI \/ 2\.15\}/);
  assert.match(world, /rotateSpeed=\{\.62\}/);
  assert.match(world, /target=\{\[0, \.55, 0\]\}/);
  assert.match(world, /touches=\{\{ ONE: THREE\.TOUCH\.ROTATE, TWO: THREE\.TOUCH\.DOLLY_ROTATE \}\}/);
  assert.match(world, /zoomSpeed=\{\.82\}/);
});

test("D-pad occupies the centered column inside the safe-area deck", () => {
  const css = readFileSync("app/globals.css", "utf8");
  assert.match(css, /\.wildz-bottom-play-controls\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) 72px minmax\(0, 1fr\)/);
  assert.match(css, /\.wildz-bottom-play-controls \.wildz-dpad/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
});

test("trainer navigation follows the boss pills in one lower-left stack above the bottom deck", () => {
  const css = readFileSync("app/globals.css", "utf8");
  const source = readFileSync("src/features/play/PlayCampaign.tsx", "utf8");
  assert.match(
    css,
    /\.wilds-world-navigator-stack\s*\{[^}]*bottom:\s*86px;[^}]*left:\s*8px;[^}]*flex-direction:\s*column;[^}]*align-items:\s*flex-start;[^}]*gap:\s*5px;/
  );
  const stackStart = source.indexOf('<div className="wilds-world-navigator-stack">');
  const worldHud = source.indexOf("<WildsLivingWorldHud", stackStart);
  const trainer = source.indexOf('className="wilds-trainer-navigator"', stackStart);
  assert.ok(stackStart >= 0 && worldHud > stackStart && trainer > worldHud);
  assert.match(css, /\.wilds-living-world-hud\s*\{[^}]*position:\s*relative;[^}]*z-index:\s*2;/);
  assert.match(css, /\.wilds-trainer-navigator\s*\{[^}]*z-index:\s*1;/);
  assert.doesNotMatch(css, /\.mobile-play-wrap \.wilds-living-world-hud\s*\{[^}]*flex-wrap:\s*wrap;/);
  assert.doesNotMatch(css, /\.wilds-living-world-hud\.has-event \.wilds-live-pill\[class\*="mode-"\]\s*\{[^}]*display:\s*none/);
});

test("trainer-facing UI uses world language instead of implementation jargon", () => {
  for (const path of [
    "src/features/play/PlayCampaign.tsx",
    "src/features/play/WildsAtlasCanvas.tsx",
    "src/features/play/WildsSagaPanel.tsx",
    "src/features/play/WildsWorldCanvas.tsx"
  ]) {
    assert.doesNotMatch(readFileSync(path, "utf8"), />[^<]*NPC[^<]*</i, path);
  }
});

test("installed PWA surface controls share the stage safe-area offset", () => {
  const css = readFileSync("app/globals.css", "utf8");
  assert.match(css, /\.wilds-stage\s*\{[^}]*--wildz-stage-safe-top:\s*env\(safe-area-inset-top\)/);
  assert.match(css, /\.wildz-player-capsule\s*\{[^}]*top:\s*calc\(14px \+ var\(--wildz-stage-safe-top\)\)/);
  assert.match(css, /\.wildz-status-rail\s*\{[^}]*top:\s*calc\(12px \+ var\(--wildz-stage-safe-top\)\)/);
  assert.match(css, /\.wildz-app \.wilds-search-reticle\s*\{[^}]*top:\s*calc\(108px \+ var\(--wildz-stage-safe-top\)\)/);
  assert.match(css, /\.wilds-live-cluster\s*\{[^}]*top:\s*calc\(122px \+ var\(--wildz-stage-safe-top\)\)/);
  assert.match(css, /\.wilds-utility-cluster\s*\{[^}]*top:\s*calc\(122px \+ var\(--wildz-stage-safe-top\)\)/);
  assert.match(css, /\.wilds-live-cluster\s*\{[^}]*top:\s*calc\(86px \+ var\(--wildz-stage-safe-top\)\)/);
  assert.match(css, /\.wilds-utility-cluster\s*\{[^}]*top:\s*calc\(92px \+ var\(--wildz-stage-safe-top\)\)/);
  assert.match(css, /\.wildz-minimap\s*\{[^}]*top:\s*calc\(116px \+ var\(--wildz-stage-safe-top\)\)/);
});

test("the caught-creature dialog starts below the installed PWA status area", () => {
  const css = readFileSync("app/globals.css", "utf8");
  assert.match(css, /\.wilds-capture-backdrop\s*\{[^}]*align-items:\s*start;[^}]*padding:\s*calc\(10px \+ env\(safe-area-inset-top\)\) 10px 10px;/);
});
