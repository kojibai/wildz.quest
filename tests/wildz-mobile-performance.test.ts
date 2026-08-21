import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";

const source = (path: string) => readFileSync(path, "utf8");

function functionCalls(input: string, name: string) {
  const calls: string[] = [];
  const marker = `${name}(`;
  let cursor = 0;
  while ((cursor = input.indexOf(marker, cursor)) >= 0) {
    let depth = 0;
    let end = cursor + marker.length;
    for (; end < input.length; end += 1) {
      const character = input[end]!;
      if (character === "(") depth += 1;
      if (character !== ")") continue;
      if (depth === 0) break;
      depth -= 1;
    }
    calls.push(input.slice(cursor, end + 1));
    cursor = end + 1;
  }
  return calls;
}

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
  assert.match(world, /<SmoothWorldFrame\b[^>]*player=\{state\.player\}/);
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

test("authoritative terrain and route art are cell-bound instead of movement-bound", () => {
  const worldArt = source("src/features/play/WildsWorldArt.tsx");
  const environment = source("src/features/play/WildsEnvironment.tsx");

  assert.doesNotMatch(worldArt, /horizonCell|Horizon|world-ridge/);
  assert.match(environment, /buildWildsTerrainPatchProjection\(centerX, centerZ, terrainRadius, segments\)/);
  assert.match(environment, /buildWildsTerrainWaterProjection\(/);
  assert.doesNotMatch(environment, /buildWildsTerrain(?:Patch|Water)Projection\(player/);
  assert.match(worldArt, /const routeCellX = Math\.floor\(player\.x \/ 6\)/);
  assert.match(worldArt, /const routeCellZ = Math\.floor\(player\.z \/ 6\)/);
  assert.match(worldArt, /\[radius, routeCellX, routeCellZ\]/);
  assert.doesNotMatch(worldArt, /projectWildsRouteGuides\(player/);
});

test("trainer frames and environment consumers reuse the admitted player terrain anchor", () => {
  const world = source("src/features/play/WildsWorldCanvas.tsx");
  const environment = source("src/features/play/WildsEnvironment.tsx");
  const trainer = world.slice(world.indexOf("function TrainerExplorer"), world.indexOf("function RemoteExplorer"));

  assert.match(trainer, /projectWildsTerrainActorPosition\(world, localPlayer, 0, \{ anchorElevation: terrainElevation \}\)/);
  assert.doesNotMatch(trainer, /wildsTerrainElevation|sampleWildsTerrain/);
  assert.doesNotMatch(environment, /wildsTerrainRelativeElevation\([^)]*, player\)/);
});

test("every production terrain-relative presentation call declares its anchor authority", () => {
  const production = readdirSync("src/features/play")
    .filter((name) => name.endsWith(".tsx"))
    .map((name) => ({ name, contents: source(`src/features/play/${name}`) }));
  const actorCalls = production.flatMap(({ name, contents }) => functionCalls(contents, "projectWildsTerrainActorPosition").map((call) => ({ call, name })));
  const relativeCalls = production.flatMap(({ name, contents }) => functionCalls(contents, "wildsTerrainRelativeElevation").map((call) => ({ call, name })));

  assert.ok(actorCalls.length >= 10);
  assert.ok(relativeCalls.length >= 4);
  for (const { call, name } of [...actorCalls, ...relativeCalls]) {
    assert.match(call, /anchorElevation\s*:/, `${name}: ${call}`);
  }
  for (const { contents, name } of production) {
    assert.doesNotMatch(contents, /wildsTerrainElevation\(player\.x, player\.z\)/, name);
  }
});
