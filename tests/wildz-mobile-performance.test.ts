import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = (path: string) => readFileSync(path, "utf8");

test("camera orbit stays outside React state and diagnostics do not restart on every movement", () => {
  const campaign = source("src/features/play/PlayCampaign.tsx");
  const world = source("src/features/play/WildsWorldCanvas.tsx");

  assert.match(campaign, /const cameraHeadingRef = useRef\(0\)/);
  assert.doesNotMatch(campaign, /\[cameraHeading, setCameraHeading\]/);
  assert.match(campaign, /onCameraHeadingChange=\{updateCameraHeading\}/);
  assert.match(world, /enableDamping/);
  assert.match(world, /const stateRef = useRef\(state\)/);
  assert.match(world, /stateRef\.current = state/);
  assert.doesNotMatch(world, /\[camera, gl, qualityProfile, scene, size, state\]/);
});

test("drawer drag uses direct frame-local height without remounting card layouts", () => {
  const drawer = source("src/features/play/WildzCreatureDrawer.tsx");
  const css = source("app/globals.css");

  assert.doesNotMatch(drawer, /setDragHeight/);
  assert.match(drawer, /drawerRef\.current\?\.style\.setProperty\("--wildz-drawer-height"/);
  assert.match(drawer, /classList\.add\("is-dragging"\)/);
  assert.match(drawer, /useState\(\{ start: 0, end: 8 \}\)/);
  assert.match(css, /\.wildz-creature-drawer\.is-dragging\s*\{[^}]*transition:\s*none/s);
  assert.match(css, /\.wildz-creature-drawer\.is-closed\.is-dragging \.wildz-creature-drawer-content\s*\{[^}]*opacity:\s*1/s);
  assert.doesNotMatch(css, /\.wildz-creature-drawer\.is-closed \.wildz-creature-drawer-content\s*\{[^}]*visibility:\s*hidden/s);
});

test("cards arrive prepainted and movement emits on initial touch", () => {
  const card = source("src/features/play/WildsCard.tsx");
  const dpad = source("src/features/play/WildzDpad.tsx");
  const css = source("app/globals.css");

  assert.match(card, /export const WildsCard = memo/);
  assert.match(card, /useMemo\(\(\) => renderHeartboundSvg/);
  assert.match(dpad, /const next = update\(event\);\s*emitMovement\(next\);/s);
  assert.match(css, /\.wilds-card-face-front\s*\{[^}]*transform:\s*translateZ\(0\.1px\)/s);
  const cardRule = css.match(/\.wilds-collectible-card\s*\{([^}]*)\}/s)?.[1] ?? "";
  assert.doesNotMatch(cardRule, /contain:\s*paint/);
  assert.doesNotMatch(cardRule, /clip-path/);
});

test("held movement stays on the render clock instead of a competing interval", () => {
  const dpad = source("src/features/play/WildzDpad.tsx");

  assert.match(dpad, /requestAnimationFrame/);
  assert.match(dpad, /cancelAnimationFrame/);
  assert.doesNotMatch(dpad, /setInterval/);
});
