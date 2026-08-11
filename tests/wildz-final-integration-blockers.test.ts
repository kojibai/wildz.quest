import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { initialWorldOverlayState, reduceWorldOverlay, type WorldOverlayOwner } from "../src/features/play/world-overlay-state";
import { applyWildsInput, initialPlayState } from "../src/features/play/game-state";
import { canRestoreFocus } from "../src/features/play/focus-recovery";

const read = (path: string) => readFileSync(path, "utf8");

test("proof identity and Card Vault preserve reachable profile and market destinations", () => {
  const hud = read("src/features/play/WildzReferenceHud.tsx");
  const campaign = read("src/features/play/PlayCampaign.tsx");

  assert.match(hud, /onOpenProfile: \(\) => void/);
  assert.match(hud, /<button[\s\S]*className="wildz-explorer-capsule"[\s\S]*onClick=\{onOpenProfile\}/);
  assert.match(hud, /disabled=\{!interactionEnabled\}/);
  assert.match(campaign, /onOpenProfile=\{openProfile\}/);
  assert.match(campaign, /className="wilds-open-market"[\s\S]*onClick=\{openMarketFromVault\}/);
  assert.match(campaign, /openExternalDestination\("market", onOpenMarket\)/);
});

test("ability selection is controlled, causal, and keyboard-equivalent", () => {
  const controls = read("src/features/play/WildzWorldControls.tsx");
  const command = read("src/features/play/WildsCompanionCommand.tsx");
  const campaign = read("src/features/play/PlayCampaign.tsx");
  const gameState = read("src/features/play/game-state.ts");

  assert.doesNotMatch(controls, /onSelectAbility=\{ignore\}/);
  assert.match(controls, /selectedAbilityIndex: number/);
  assert.match(controls, /onSelectAbility: \(abilityIndex: number\) => void/);
  assert.match(controls, /onUsePower=\{handleUsePower\}/);
  assert.match(command, /selectedAbilityIndex: number/);
  assert.doesNotMatch(command, /useState\(0\)/);
  assert.match(command, /event\.key\.toLowerCase\(\) === "a"/);
  assert.match(command, /openKeyboardWheel/);
  assert.match(command, /commitKeyboardAbility/);
  assert.match(campaign, /const activateWorldPulse = \(abilityIndex: number\)/);
  assert.match(campaign, /type: "use-field-ability"/);
  assert.match(gameState, /input\.type === "use-field-ability"/);
});

test("different named field abilities produce different authoritative play effects", () => {
  const asset = initialPlayState.inventory[0]!;
  const first = applyWildsInput(initialPlayState, {
    type: "use-field-ability",
    assetId: asset.id,
    abilityIndex: 0,
    usedAt: "2026-08-10T12:00:00.000Z"
  });
  const second = applyWildsInput(initialPlayState, {
    type: "use-field-ability",
    assetId: asset.id,
    abilityIndex: 1,
    usedAt: "2026-08-10T12:00:00.000Z"
  });

  assert.notEqual(first.lastEvent, second.lastEvent);
  assert.notEqual(first.energy, second.energy);
  assert.notDeepEqual(first.companionProgress, second.companionProgress);
});

test("every play-shell modal has an explicit exclusive owner", () => {
  const owners: WorldOverlayOwner[] = [
    "map", "trainer", "combat", "landmark", "settlement", "ecology", "raid",
    "reward", "ceremony", "memorial", "profile", "market", "command", "multiplayer"
  ];
  for (const owner of owners) {
    const state = reduceWorldOverlay(
      { ...initialWorldOverlayState, drawerSnap: "expanded", toolsOpen: true },
      { type: "exclusive", owner }
    );
    assert.equal(state.exclusiveOwner, owner);
    assert.equal(state.drawerSnap, "closed");
    assert.equal(state.toolsOpen, false);
    assert.equal(state.panelKey, null);
  }

  const campaign = read("src/features/play/PlayCampaign.tsx");
  const drawer = read("src/features/play/WildzCreatureDrawer.tsx");
  assert.match(campaign, /projectPlayShellOwner/);
  assert.match(campaign, /claimExclusiveOwner/);
  assert.match(campaign, /memorialAssetId/);
  assert.match(drawer, /memorialAssetId: string \| null/);
  assert.match(drawer, /onMemorialAssetChange: \(assetId: string \| null\) => void/);
  assert.match(drawer, /event\.key === "Escape"/);
  assert.match(drawer, /containFocus/);
});

test("the stage owns Escape lifecycle for every non-combat world modal", () => {
  const campaign = read("src/features/play/PlayCampaign.tsx");
  const director = read("src/features/play/use-world-overlay-director.ts");

  assert.match(campaign, /const ESCAPE_OWNED_WORLD_OWNERS = new Set\(\[[\s\S]*"trainer"[\s\S]*"map"[\s\S]*"landmark"[\s\S]*"settlement"[\s\S]*"ecology"[\s\S]*"raid"[\s\S]*"reward"[\s\S]*"ceremony"[\s\S]*"memorial"[\s\S]*"multiplayer"[\s\S]*\]\)/);
  assert.match(campaign, /ESCAPE_OWNED_WORLD_OWNERS\.has\(exclusiveOwner\)/);
  assert.match(campaign, /setMapOpen\(false\)/);
  assert.match(campaign, /setActiveLandmarkId\(null\)/);
  assert.match(campaign, /setActiveEcologySiteId\(null\)/);
  assert.match(campaign, /setActiveRaid\(null\)/);
  assert.match(campaign, /setMemorialAssetId\(null\)/);
  assert.match(campaign, /answerMultiplayerChallenge\([\s\S]*"decline"/);
  assert.match(director, /event\.key === "Escape" && exclusiveOwner === "none"/);
});

test("explorer rendering is invariant to mutable restored avatar continuity", () => {
  const campaign = read("src/features/play/PlayCampaign.tsx");
  const canvas = read("src/features/play/WildsWorldCanvas.tsx");
  const explorer = read("src/features/play/WildsExplorer.tsx");

  assert.doesNotMatch(campaign, /const \[avatarStyle, setAvatarStyle\]/);
  assert.doesNotMatch(campaign, /initialPlayerContinuity\?\.settings\.avatarStyle \?\?/);
  assert.doesNotMatch(campaign, /setAvatarStyle\(outcome\.playerContinuity\.settings\.avatarStyle/);
  assert.doesNotMatch(canvas, /avatarStyle/);
  assert.match(canvas, /<WildsExplorer character=\{character\} style=\{character\.gender\}/);
  assert.match(explorer, /projectWildsExplorerAppearance\(character\)/);
});

test("focus recovery is cancellable, owner-aware, connected, and enabled", () => {
  const dock = read("src/features/play/WildsCommandDock.tsx");
  assert.match(dock, /focusFrameRef/);
  assert.match(dock, /window\.cancelAnimationFrame/);
  assert.match(dock, /canRestoreFocus\(origin\)/);
  assert.match(dock, /exclusiveOwner/);
});

test("focus recovery rejects detached, disabled, aria-disabled, and inert origins", () => {
  const element = (connected: boolean, matched: boolean) => ({
    isConnected: connected,
    matches: () => matched
  }) as unknown as HTMLElement;
  assert.equal(canRestoreFocus(null), false);
  assert.equal(canRestoreFocus(element(false, false)), false);
  assert.equal(canRestoreFocus(element(true, true)), false);
  assert.equal(canRestoreFocus(element(true, false)), true);
});

test("the dead duplicate WildzSocialDeck owner is removed", () => {
  assert.equal(existsSync("src/features/play/WildzSocialDeck.tsx"), false);
  assert.doesNotMatch(read("src/features/play/PlayCampaign.tsx"), /WildzSocialDeck/);
  assert.doesNotMatch(read("src/features/play/WildzWorldControls.tsx"), /WildzSocialDeck/);
});
