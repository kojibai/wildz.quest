import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("gameplay composes the reference HUD and unified controls inside the preserved world stage", () => {
  const source = readFileSync("src/features/play/PlayCampaign.tsx", "utf8");
  assert.match(source, /<WildsWorldCanvas[\s\S]*<WildzReferenceHud[\s\S]*<WildzWorldControls/);
  assert.doesNotMatch(source, /<div className="wildz-social-stack">/);
  assert.doesNotMatch(source, /<WildzSocialDeck/);
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

test("gameplay controls float in collision-safe homes without a bottom chassis", () => {
  const css = readFileSync("app/globals.css", "utf8");
  assert.match(css, /\.wildz-app \.wilds-world\s*\{[^}]*grid-template-rows:\s*minmax\(0, 1fr\);/);
  assert.match(css, /\.wildz-world-controls\s*\{[^}]*position:\s*absolute;[^}]*inset:\s*0;[^}]*pointer-events:\s*none;/);
  assert.match(css, /\.wildz-movement-home\s*\{[^}]*position:\s*absolute;[^}]*bottom:/);
  assert.match(css, /\.wildz-tools-home\s*\{[^}]*right:\s*0;[^}]*left:\s*0;[^}]*width:\s*max-content;[^}]*margin-inline:\s*auto;[^}]*transform:\s*none;/);
  const toolsHomeRule = css.match(/\.wildz-tools-home\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.doesNotMatch(toolsHomeRule, /transform:\s*translate/);
  assert.match(css, /\.wildz-companion-home\s*\{[^}]*right:/);
  assert.match(css, /\.wilds-companion-real-name/);
  assert.doesNotMatch(css, /\.wildz-world-controls[^}]*background:/);
});

test("movement and quick utilities resolve from an explicit safe inline bound", () => {
  const css = readFileSync("app/globals.css", "utf8");
  assert.match(css, /\.wildz-movement-home\s*\{[^}]*box-sizing:\s*border-box;[^}]*inset-inline-start:\s*max\(var\(--wildz-bottom-home-gap\), env\(safe-area-inset-left\)\);[^}]*transform:\s*none;/s);
  assert.match(css, /\.wildz-movement-home \.wildz-dpad\s*\{[^}]*box-sizing:\s*border-box;[^}]*inset-inline-start:\s*0;[^}]*transform:\s*none;/s);
  assert.match(css, /\.wildz-quick-utilities\s*\{[^}]*box-sizing:\s*border-box;[^}]*inset-inline-start:\s*0;/s);
});

test("expanded controls grow from their semantic homes and remain motion-safe", () => {
  const css = readFileSync("app/globals.css", "utf8");
  const finalCss = css.slice(css.lastIndexOf("/* Unified living-world overlay"));
  assert.match(css, /\.wildz-quick-utilities\s*\{[^}]*animation:\s*wildz-quick-utilities-in/);
  assert.doesNotMatch(css, /\.wildz-quick-utilities\s*\{[^}]*animation:\s*wildz-home-fan-in/);
  assert.match(css, /\.wildz-companion-home\s*>\s*\.wildz-creature-drawer\s*\{[^}]*position:\s*absolute;[^}]*bottom:/);
  assert.match(css, /\.wildz-tools-home \.wilds-world-tools-fan\s*\{[^}]*position:\s*absolute;[^}]*bottom:/);
  assert.match(css, /\.wildz-tools-home \.wilds-world-tools-fan \.wilds-command-dock\s*\{[^}]*grid-template-columns:\s*repeat\(2,/);
  assert.match(css, /\.wildz-tools-home \.wilds-command-button\[aria-controls="wilds-command-sheet-mission"\]\s*\{[^}]*display:\s*none;/);
  assert.match(css, /\.wildz-companion-home \.wilds-companion-ability-wheel\s*\{[^}]*right:/);
  assert.match(css, /\.wildz-app \.wilds-event-toast\s*\{[^}]*bottom:\s*max\(180px,/);
  assert.match(css, /@media \(orientation: landscape\) and \(max-height: 500px\)\s*\{[\s\S]*\.wildz-tools-home \.wilds-world-tools-fan \.wilds-command-dock\s*\{[^}]*grid-template-columns:\s*repeat\(4,/);
  assert.match(css, /@media \(orientation: landscape\) and \(max-height: 500px\)\s*\{[\s\S]*\.wildz-companion-home \.wilds-companion-command\s*\{[^}]*width:\s*78px;/);
  assert.match(css, /@media \(orientation: landscape\) and \(max-height: 500px\)\s*\{[\s\S]*\.wilds-map-status-home\s*\{[^}]*top:\s*calc\(74px \+ env\(safe-area-inset-top\)\);/);
  assert.match(css, /@media \(orientation: landscape\) and \(max-height: 500px\)\s*\{[\s\S]*\.wildz-app \.wilds-event-toast\s*\{[^}]*width:\s*min\(24vw, 200px\);/);
  const reducedMotionStart = finalCss.lastIndexOf("@media (prefers-reduced-motion: reduce)");
  const reducedMotionRuleStart = finalCss.indexOf(".wilds-world-tools-fan,", reducedMotionStart);
  const reducedMotionRule = finalCss.slice(reducedMotionRuleStart, finalCss.indexOf("}", reducedMotionRuleStart));
  for (const selector of ["wilds-world-tools-fan", "wildz-creature-drawer", "wilds-companion-ability-wheel", "wilds-living-world-sheet", "wilds-audio-sheet"]) {
    assert.match(reducedMotionRule, new RegExp(selector));
  }
  assert.match(reducedMotionRule, /animation:\s*none !important;[\s\S]*transition:\s*none !important;/);
});

test("balanced persistent homes keep live status by the map and Kai audio on the left", () => {
  const css = readFileSync("app/globals.css", "utf8");
  const finalCss = css.slice(css.lastIndexOf("/* Unified living-world overlay"));
  const source = readFileSync("src/features/play/PlayCampaign.tsx", "utf8");
  const hud = readFileSync("src/features/play/WildsBalancedStatusHud.tsx", "utf8");
  const multiplayer = readFileSync("src/features/play/WildsMultiplayer.tsx", "utf8");
  assert.doesNotMatch(source, /worldStatusOpen|wilds-world-status-trigger|wilds-world-status-fan/);
  assert.match(source, /<WildsBalancedStatusHud/);
  assert.match(hud, /wilds-map-status-home[\s\S]*<WildsLivingWorldHud[\s\S]*<WildsMultiplayer/);
  assert.match(hud, /wilds-left-instrument-home[\s\S]*wilds-kai-command-pill[\s\S]*<WildsAudioSettings/);
  assert.match(multiplayer, /id="wilds-live-controls"[^>]*className="wilds-live-cluster"/);

  const targetFloor = finalCss.slice(finalCss.indexOf(".wilds-map-status-home :is("));
  for (const selector of ["wilds-live-badge", "wilds-live-share", "wilds-audio-settings > summary", "wilds-kai-command-pill", "wilds-live-pill"]) {
    assert.match(targetFloor, new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(targetFloor, /\{[^}]*min-width:\s*44px;[^}]*min-height:\s*44px;/);
});

test("world event pills stay compact while trainer challenges come from directly selected world actors", () => {
  const css = readFileSync("app/globals.css", "utf8");
  const finalCss = css.slice(css.lastIndexOf("/* Unified living-world overlay"));
  const source = readFileSync("src/features/play/PlayCampaign.tsx", "utf8");
  assert.match(finalCss, /\.wilds-map-status-home \.wilds-living-world-hud\s*\{[^}]*align-items:\s*flex-end;/);
  const hud = readFileSync("src/features/play/WildsBalancedStatusHud.tsx", "utf8");
  assert.match(hud, /wilds-map-status-home[\s\S]*<WildsLivingWorldHud/);
  assert.doesNotMatch(source, /wilds-trainer-navigator/);
  assert.match(source, /onSelectTrainer=\{\(trainer\) => openTrainerEncounter\(trainer, "world"\)\}/);
  assert.match(css, /\.wilds-living-world-hud\s*\{[^}]*position:\s*relative;[^}]*z-index:\s*2;/);
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
  assert.match(css, /\.wilds-map-status-home\s*\{[^}]*top:\s*calc\([^}]*safe-area-inset-top[^}]*right:\s*max\([^}]*safe-area-inset-right/);
  assert.match(css, /\.wilds-left-instrument-home\s*\{[^}]*top:\s*calc\([^}]*safe-area-inset-top[^}]*left:\s*max\([^}]*safe-area-inset-left/);
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

test("trainer challenge remains inside short landscape viewports", () => {
  const css = readFileSync("app/globals.css", "utf8");
  assert.match(css, /@media \(orientation: landscape\) and \(max-height: 500px\)[\s\S]*?\.wilds-trainer-challenge,\s*\.wilds-trainer-result\s*\{[\s\S]*?max-height:\s*calc\(100dvh - 16px\);[\s\S]*?overflow-y:\s*auto;/);
});
