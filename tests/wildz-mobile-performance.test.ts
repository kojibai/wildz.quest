import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = (path: string) => readFileSync(path, "utf8");

test("camera orbit publishes heading through a ref without React state or diagnostic restarts", () => {
  const campaign = source("src/features/play/PlayCampaign.tsx");
  const world = source("src/features/play/WildsWorldCanvas.tsx");

  assert.match(campaign, /cameraHeadingRef/);
  assert.doesNotMatch(campaign, /\[cameraHeading, setCameraHeading\]/);
  assert.match(campaign, /onCameraHeadingChange/);
  assert.match(world, /enableDamping/);
  assert.match(world, /const stateRef = useRef\(state\)/);
  assert.match(world, /stateRef\.current = state/);
  assert.doesNotMatch(world, /\[camera, gl, qualityProfile, scene, size, state\]/);
  assert.match(world, /function SmoothWorldFrame/);
  assert.match(world, /THREE\.MathUtils\.damp/);
  assert.match(world, /<SmoothWorldFrame player=\{state\.player\}>/);
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

test("Vault merges refresh the admitted card set without coupling it to movement", () => {
  const campaign = source("src/features/play/PlayCampaign.tsx");
  const shell = source("src/features/shell/WildzApp.tsx");
  assert.match(campaign, /const \[initialVaultAdmission\] = useState/);
  assert.match(campaign, /cards:\s*initialState\.inventory/);
  assert.match(campaign, /currentVaultAdmission = vaultAdmission \?\? initialVaultAdmission/);
  assert.match(campaign, /createWildzVaultCardMembershipProof\(currentVaultAdmission, activeAsset\)/);
  assert.match(shell, /vaultAdmission=\{vaultAdmission\}/);
  assert.doesNotMatch(campaign, /deriveWildzVaultCardAdmission\(\{\s*cards:\s*deckCards,[\s\S]*?createWildzVaultCardMembershipProof\(admission, activeAsset\)/);
});

test("large Vault collection indexes are not rebuilt for every movement render", () => {
  const campaign = source("src/features/play/PlayCampaign.tsx");
  const shell = source("src/features/shell/WildzApp.tsx");
  assert.match(campaign, /const \{ discoveredByFamily, discoveredKaiLineages, guideFamilies \} = useMemo\(\(\) =>/);
  assert.match(campaign, /\}, \[deckCards\]\);/);
  assert.match(
    shell,
    /const cardTruthChanged = current\.playState\?\.inventory === playState\.inventory\s*\?\s*false/
  );
});

test("nearby creature projections are reused while movement remains inside one region", () => {
  const gameState = source("src/features/play/game-state.ts");
  assert.match(gameState, /const nearbyCreatureRegionCache/);
  assert.match(gameState, /nearbyCreatureRegionCache\.get\(regionKey\)/);
});

test("production rendering does not run the diagnostics sampler", () => {
  const world = source("src/features/play/WildsWorldCanvas.tsx");
  assert.match(world, /const WILDS_DIAGNOSTICS_ENABLED = process\.env\.NODE_ENV !== "production"/);
  assert.match(world, /WILDS_DIAGNOSTICS_ENABLED \? <WildsDiagnostics/);
});

test("proof admission does not activate recurring work on the gameplay hot path", () => {
  const campaign = source("src/features/play/PlayCampaign.tsx");
  const multiplayer = source("src/features/play/use-wilds-multiplayer.ts");
  const world = source("src/features/play/use-wilds-world.ts");
  const shell = source("src/features/shell/WildzApp.tsx");

  assert.doesNotMatch(campaign, /usePublicCardPublisher/);
  assert.match(campaign, /live:\s*multiplayerRosterOpen/);
  assert.doesNotMatch(world, /setInterval/);
  assert.doesNotMatch(multiplayer, /setInterval/);

  const ownership = shell.slice(
    shell.lastIndexOf("useEffect(() => {", shell.indexOf("const reconcileActiveVaultOwnership")),
    shell.indexOf("useEffect(() => {", shell.indexOf("const reconcileActiveVaultOwnership") + 1)
  );
  assert.match(ownership, /overlay\?\.kind !== "market"/);
  assert.doesNotMatch(ownership, /setInterval|addEventListener/);
});

test("artifact upload follow-up work stays off visible gameplay", () => {
  const campaign = source("src/features/play/PlayCampaign.tsx");
  const shell = source("src/features/shell/WildzApp.tsx");

  assert.doesNotMatch(campaign, /\}\);\s*settleLivingCreatures\(\);/);
  assert.doesNotMatch(campaign, /setInterval\(settleLivingCreatures/);
  assert.doesNotMatch(campaign, /window\.addEventListener\("focus", settleLivingCreatures\)/);
  assert.doesNotMatch(campaign, /const timer = window\.setInterval\(refresh/);
  assert.match(campaign, /shouldRunWildzOffHotPathWork/);

  assert.doesNotMatch(shell, /retryTimer|retryAttempt|proofSessionRetryDecision/);
  assert.match(shell, /shouldRunWildzOffHotPathWork/);
  assert.match(shell, /overlay\?\.kind === "profile" \? "profile" : "gameplay"/);
});

test("trackpad pointer motion updates the knob outside React's render path", () => {
  const dpad = source("src/features/play/WildzDpad.tsx");
  assert.match(dpad, /const knobRef = useRef<HTMLElement>/);
  assert.doesNotMatch(dpad, /setKnob\(/);
});
