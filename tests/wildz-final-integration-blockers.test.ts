import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { initialWorldOverlayState, reduceWorldOverlay, type WorldOverlayOwner } from "../src/features/play/world-overlay-state";
import { applyWildsInput, initialPlayState } from "../src/features/play/game-state";
import { canRestoreFocus } from "../src/features/play/focus-recovery";
import { canAcceptPlayShellInput, isCaptureRewardModalOwner, isWildBattleModalOwner, projectPlayShellOwner } from "../src/features/play/play-shell-owner";
import { generateIdentityBoundWildzCharacter } from "../src/features/identity/wildz-genesis";
import { projectWildzContinuityExplorer } from "../src/features/play/wildz-explorer-proof";
import { nextCompanionAbilityIndex } from "../src/features/play/companion-ability-composite";
import { shouldRefreshWildzMarket } from "../src/features/market/market-refresh-policy";
import { worldInputForKeyboardEvent } from "../src/features/play/world-keyboard-routing";
import {
  beginModalAdmission,
  canCommitModalAdmission,
  claimModalAdmissionOwner,
  createModalAdmissionState,
  isPlayHomeAvailable,
  isProjectedModalMounted,
  releaseModalAdmissionOwner
} from "../src/features/play/modal-admission";
import {
  openCompanionKeyboardInteraction,
  resetCompanionCommandInteraction
} from "../src/features/play/companion-command-interaction";
import {
  commitWildzArtifactContinuity,
  commitWildzBootstrapContinuity,
  resetWildzIdentityContinuity,
  type WildzContinuitySnapshot
} from "../src/lib/receiz/wildz-identity-adapter";

const read = (path: string) => readFileSync(path, "utf8");

test("proof identity and Card Vault preserve reachable profile and market destinations", () => {
  const hud = read("src/features/play/WildzReferenceHud.tsx");
  const campaign = read("src/features/play/PlayCampaign.tsx");

  assert.match(hud, /onOpenProfile: \(\) => void/);
  assert.match(hud, /<button[\s\S]*className="wildz-explorer-capsule"[\s\S]*onClick=\{onOpenProfile\}/);
  assert.match(hud, /disabled=\{!interactionEnabled\}/);
  assert.match(campaign, /onOpenProfile=\{openProfile\}/);
  assert.match(campaign, /className="wilds-open-market"[\s\S]*onClick=\{openMarketFromVault\}/);
  assert.match(campaign, /shellOverlayOwner\?: "none" \| "profile" \| "market"/);
  assert.match(campaign, /onOpenMarket\(origin\)/);
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
  assert.match(command, /closeKeyboardWheel\(true\)/);
  assert.match(command, /ref=\{abilityListboxRef\}[\s\S]*role="listbox"[\s\S]*tabIndex=\{0\}/);
  assert.match(command, /restoreCommandFocus/);
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

test("modal focus boundaries exclude hidden and unavailable selector matches", () => {
  const candidate = ({
    connected = true,
    matchesUnavailable = false,
    tabIndex = 0,
    hidden = false,
    display = "block",
    visibility = "visible",
    clientRects = 1
  }: {
    connected?: boolean;
    matchesUnavailable?: boolean;
    tabIndex?: number;
    hidden?: boolean;
    display?: string;
    visibility?: string;
    clientRects?: number;
  } = {}) => ({
    isConnected: connected,
    matches: () => matchesUnavailable,
    tabIndex,
    hidden,
    ownerDocument: {
      defaultView: { getComputedStyle: () => ({ display, visibility }) }
    },
    getClientRects: () => ({ length: clientRects })
  }) as unknown as HTMLElement;

  const first = candidate();
  const lastVisible = candidate();
  const hiddenFileInput = candidate({ display: "none", clientRects: 0 });
  assert.equal(canRestoreFocus(first), true);
  assert.equal(canRestoreFocus(candidate({ connected: false })), false);
  assert.equal(canRestoreFocus(candidate({ matchesUnavailable: true })), false);
  assert.equal(canRestoreFocus(candidate({ tabIndex: -1 })), false);
  assert.equal(canRestoreFocus(candidate({ hidden: true })), false);
  assert.equal(canRestoreFocus(candidate({ visibility: "hidden" })), false);
  assert.equal(canRestoreFocus(candidate({ clientRects: 0 })), false);
  assert.equal(canRestoreFocus(lastVisible), true);
  assert.equal(canRestoreFocus(hiddenFileInput), false);
});

test("the dead duplicate WildzSocialDeck owner is removed", () => {
  assert.equal(existsSync("src/features/play/WildzSocialDeck.tsx"), false);
  assert.doesNotMatch(read("src/features/play/PlayCampaign.tsx"), /WildzSocialDeck/);
  assert.doesNotMatch(read("src/features/play/WildzWorldControls.tsx"), /WildzSocialDeck/);
});

test("a controlled shell overlay owns the world for its entire open lifetime", () => {
  let worldActions = 0;
  const attemptWorldAction = (owner: WorldOverlayOwner) => {
    if (canAcceptPlayShellInput(true, owner, false)) worldActions += 1;
  };

  for (const shellOwner of ["profile", "market"] as const) {
    const owner = projectPlayShellOwner({
      combat: false, trainer: false, memorial: false, reward: false, ceremony: false,
      raid: false, ecology: false, settlement: false, landmark: false, map: false,
      profile: shellOwner === "profile", market: shellOwner === "market",
      multiplayer: false, command: false
    });
    attemptWorldAction(owner);
    attemptWorldAction(owner);
    assert.equal(owner, shellOwner);
    assert.equal(worldActions, 0);
  }

  attemptWorldAction("none");
  assert.equal(worldActions, 1);
});

test("ability composite navigation wraps independently before commit", () => {
  assert.equal(nextCompanionAbilityIndex(0, "ArrowRight", 4), 1);
  assert.equal(nextCompanionAbilityIndex(3, "ArrowRight", 4), 0);
  assert.equal(nextCompanionAbilityIndex(0, "ArrowLeft", 4), 3);
  assert.equal(nextCompanionAbilityIndex(2, "ArrowDown", 4), 3);
  assert.equal(nextCompanionAbilityIndex(2, "ArrowUp", 4), 1);
});

test("focused ability arrows change selection without producing world movement", () => {
  const initial = structuredClone(initialPlayState);
  const movementIntents: ReturnType<typeof worldInputForKeyboardEvent>[] = [];
  const listboxTarget = {
    closest: (selector: string) => selector.includes("listbox") ? listboxTarget : null
  } as unknown as EventTarget;
  const expectedByKey = {
    ArrowLeft: 0,
    ArrowRight: 2,
    ArrowUp: 0,
    ArrowDown: 2
  } as const;

  for (const [key, expectedSelection] of Object.entries(expectedByKey)) {
    const selection = nextCompanionAbilityIndex(1, key as keyof typeof expectedByKey, 4);
    assert.equal(selection, expectedSelection);
    assert.notEqual(selection, 1);
    movementIntents.push(worldInputForKeyboardEvent({ key, defaultPrevented: true, target: listboxTarget }));
    assert.equal(worldInputForKeyboardEvent({ key, defaultPrevented: false, target: listboxTarget }), null);
  }

  const after = movementIntents.reduce((state, input) => input ? applyWildsInput(state, input) : state, initial);
  assert.deepEqual(movementIntents, [null, null, null, null]);
  assert.deepEqual(after.player, initial.player);
});

test("exclusive cancellation closes a keyboard wheel without stealing focus into the world", () => {
  const opened = openCompanionKeyboardInteraction(1, 4);
  assert.deepEqual(opened, {
    mode: "ability-wheel",
    activeAbilityIndex: 1,
    keyboardWheelOpen: true,
    restoreFocus: false
  });

  const cancelled = resetCompanionCommandInteraction("owner-cancel");
  assert.deepEqual(cancelled, {
    mode: "pending",
    activeAbilityIndex: null,
    keyboardWheelOpen: false,
    restoreFocus: false
  });
  assert.equal(resetCompanionCommandInteraction("escape").restoreFocus, true);
  assert.equal(resetCompanionCommandInteraction("commit").restoreFocus, true);
});

test("production bootstrap, artifact commit, and identity reset helpers preserve proof-derived rendering", () => {
  const session = {
    keyId: "proof-explorer-key",
    actorId: "proof-explorer",
    username: "proof-explorer",
    displayName: "Proof Explorer",
    createdAt: "2026-08-10T12:00:00.000Z",
    localAuthority: "verified"
  } as WildzContinuitySnapshot["session"];
  const genesis = generateIdentityBoundWildzCharacter(session);
  const conflictingStyle: "male" | "female" = genesis.gender === "female" ? "male" : "female";
  const playerContinuity = {
    settings: { avatarStyle: conflictingStyle, movementMode: "walk" as const, audio: {}, cardOrder: "rarity" as const },
    personalEvents: [],
    canonicalCursor: { worldId: "wilds:global:v3" as const, revision: 0, eventId: null },
    receipts: []
  };
  const bootstrap = commitWildzBootstrapContinuity({
    session,
    playState: initialPlayState,
    character: genesis,
    playerContinuity,
    restoreEpoch: 1
  });
  const restored = commitWildzArtifactContinuity({
    session,
    playState: initialPlayState,
    character: structuredClone(genesis),
    playerContinuity,
    restoreEpoch: 2
  });
  const reset = resetWildzIdentityContinuity(session, 3);
  const projections = [bootstrap, restored, reset].map(projectWildzContinuityExplorer);

  assert.deepEqual(projections[1], projections[0]);
  assert.deepEqual(projections[2], projections[0]);
  for (const projection of projections) {
    assert.ok(projection);
    assert.equal(projection.style, genesis.gender);
  }
});

test("passive market presentation stays locally unavailable without probing an absent proof session", () => {
  assert.equal(shouldRefreshWildzMarket(false), false);
  assert.equal(shouldRefreshWildzMarket(true), true);
  const app = read("src/features/shell/WildzApp.tsx");
  const market = read("src/features/market/WildzMarketSheet.tsx");
  assert.match(app, /connected=\{proofSessionConnected\}/);
  assert.match(market, /if \(!connected\) return/);
});

test("modal admission tokens reject delayed work after another owner wins or closes", () => {
  for (const winner of ["map", "trainer", "combat", "profile", "command"] as const) {
    const idle = createModalAdmissionState();
    const delayedAdmission = beginModalAdmission(idle);
    assert.ok(delayedAdmission);
    assert.equal(canCommitModalAdmission(idle, delayedAdmission), true);

    const claimed = claimModalAdmissionOwner(idle, winner);
    assert.equal(canCommitModalAdmission(claimed, delayedAdmission), false);
    assert.equal(isProjectedModalMounted(claimed.owner, winner), true);
    assert.equal(isProjectedModalMounted(claimed.owner, "raid"), false);

    const closed = releaseModalAdmissionOwner(claimed, winner);
    assert.equal(closed.owner, "none");
    assert.equal(canCommitModalAdmission(closed, delayedAdmission), false);
    assert.equal(isProjectedModalMounted(closed.owner, "raid"), false);
  }
});

test("a completed capture yields combat ownership so its reward can be admitted", () => {
  for (const phase of ["battle_intro", "player_turn", "capture_ready", "emerging", "capsule", "sealed", "fled", "defeated"]) {
    assert.equal(isWildBattleModalOwner(phase, true), true, `${phase} must retain combat ownership`);
  }
  assert.equal(isWildBattleModalOwner("revealed", true), false);
  assert.equal(isWildBattleModalOwner("idle", true), false);
  assert.equal(isWildBattleModalOwner("player_turn", false), false);

  const combatReleased = createModalAdmissionState("none");
  const rewardAdmission = beginModalAdmission(combatReleased);
  assert.ok(rewardAdmission);
  assert.equal(canCommitModalAdmission(combatReleased, rewardAdmission), true);
});

test("a revealed inventory-backed capture owns the reward surface synchronously", () => {
  assert.equal(isCaptureRewardModalOwner("revealed", true), true);
  assert.equal(isCaptureRewardModalOwner("revealed", false), false);
  assert.equal(isCaptureRewardModalOwner("sealed", true), false);

  const campaign = read("src/features/play/PlayCampaign.tsx");
  assert.match(campaign, /const captureRewardAssetId = state\.encounter\.phase === "revealed"/);
  assert.match(campaign, /const captureRewardAsset = captureRewardAssetId/);
  assert.match(campaign, /reward: isCaptureRewardModalOwner\(state\.encounter\.phase, Boolean\(captureRewardAsset\)\)/);
  assert.doesNotMatch(campaign, /state\.encounter\.phase !== "revealed"[\s\S]{0,500}window\.setTimeout/);
});

test("every exclusive combat phase mounts one accessible combat dialog", () => {
  const campaign = read("src/features/play/PlayCampaign.tsx");
  const wildBattle = read("src/features/play/WildsBattle.tsx");
  const multiplayer = read("src/features/play/WildsMultiplayer.tsx");

  assert.match(campaign, /const wildBattleActive = isWildBattleModalOwner\(state\.encounter\.phase, Boolean\(state\.battle\)\)/);
  assert.match(campaign, /<WildsBattle[\s\S]*encounterPhase=\{state\.encounter\.phase\}/);
  assert.match(wildBattle, /role="dialog"/);
  assert.match(wildBattle, /aria-modal="true"/);
  assert.match(wildBattle, /const battleInputEnabled = encounterPhase === "player_turn" \|\| encounterPhase === "capture_ready"/);
  assert.match(wildBattle, /captureTransitioning/);
  assert.match(wildBattle, /event\.key !== "Tab"/);
  assert.match(wildBattle, /event\.key === "Escape"/);
  assert.match(multiplayer, /className=\{`wilds-pvp-battle/);
  assert.match(multiplayer, /role="dialog"/);
  assert.match(multiplayer, /aria-modal="true"/);
  assert.match(multiplayer, /battleDialogRef/);
  assert.match(multiplayer, /typeof document !== "undefined" \? createPortal\(\([\s\S]*document\.body\)/);
});

test("every exclusive owner hides and gates every non-owner world home", () => {
  const homes = ["reference", "multiplayer", "status", "movement", "tools", "companion"] as const;
  const owners: WorldOverlayOwner[] = [
    "map", "trainer", "combat", "landmark", "settlement", "ecology", "raid", "reward",
    "ceremony", "memorial", "profile", "market", "multiplayer", "command"
  ];
  for (const owner of owners) {
    const available = homes.filter((home) => isPlayHomeAvailable(owner, home));
    assert.deepEqual(available, owner === "command" ? ["tools"] : owner === "multiplayer" ? ["multiplayer"] : []);
  }
  assert.deepEqual(homes.filter((home) => isPlayHomeAvailable("none", home)), homes);
});

test("the projected owner admits exactly one modal candidate and release admits no stale loser", () => {
  const candidates: WorldOverlayOwner[] = [
    "map", "trainer", "combat", "landmark", "settlement", "ecology", "raid",
    "reward", "ceremony", "memorial", "profile", "market", "multiplayer", "command"
  ];
  for (const owner of candidates) {
    const claimed = claimModalAdmissionOwner(createModalAdmissionState(), owner);
    assert.deepEqual(candidates.filter((candidate) => isProjectedModalMounted(claimed.owner, candidate)), [owner]);
    const released = releaseModalAdmissionOwner(claimed, owner);
    assert.deepEqual(candidates.filter((candidate) => isProjectedModalMounted(released.owner, candidate)), []);
  }
});

test("PlayCampaign mounts only the projected winner and guards delayed admissions", () => {
  const campaign = read("src/features/play/PlayCampaign.tsx");
  assert.match(campaign, /const claimPlayModalOwner/);
  assert.match(campaign, /clearIncompatibleModalState\(exclusiveOwner\)/);
  assert.match(campaign, /beginModalAdmission/);
  assert.match(campaign, /canCommitModalAdmission/);
  assert.match(campaign, /exclusiveOwner === "map"/);
  assert.match(campaign, /exclusiveOwner === "landmark"/);
  assert.match(campaign, /exclusiveOwner === "settlement"/);
  assert.match(campaign, /exclusiveOwner === "ecology"/);
  assert.match(campaign, /exclusiveOwner === "raid"/);
  assert.match(campaign, /exclusiveOwner === "reward"/);
  assert.match(campaign, /exclusiveOwner === "ceremony"/);
  assert.match(campaign, /exclusiveOwner === "combat"/);
  assert.match(campaign, /memorialAssetId=\{exclusiveOwner === "memorial" \? memorialAssetId : null\}/);
  assert.match(campaign, /backgroundHomesBlocked/);
  assert.match(campaign, /aria-hidden=\{referenceHomeBlocked\}/);
  assert.match(campaign, /inert=\{referenceHomeBlocked \? true : undefined\}/);
  const controls = read("src/features/play/WildzWorldControls.tsx");
  assert.match(controls, /aria-hidden=\{movementHomeBlocked\}[\s\S]*inert=\{movementHomeBlocked \? true : undefined\}/);
  assert.match(controls, /aria-hidden=\{toolsHomeBlocked\}[\s\S]*inert=\{toolsHomeBlocked \? true : undefined\}/);
  assert.match(controls, /aria-hidden=\{companionHomeBlocked\}[\s\S]*inert=\{companionHomeBlocked \? true : undefined\}/);
});
