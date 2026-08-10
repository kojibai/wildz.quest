import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

test("the stage director owns command panels and gates every non-modal home", () => {
  const campaign = read("src/features/play/PlayCampaign.tsx");
  const controls = read("src/features/play/WildzWorldControls.tsx");
  const hud = read("src/features/play/WildzReferenceHud.tsx");
  const minimap = read("src/features/play/WildzMinimap.tsx");

  assert.match(campaign, /useWorldOverlayDirector\(\{ dismissSignal: commandDismissSignal, exclusiveOwner \}\)/);
  assert.match(campaign, /const commandPanelOpen = exclusiveOwner === "none" && worldOverlayState\.panelKey !== null/);
  assert.match(campaign, /const canUseWorldStage = useCallback[\s\S]*!panelOwnershipRef\.current/);
  assert.match(campaign, /event\.type === "panel" && event\.key !== null[\s\S]*setWorldStatusOpen\(false\)[\s\S]*setMultiplayerRosterOpen\(false\)/);
  assert.match(campaign, /is-command-panel-open/);
  assert.match(campaign, /aria-hidden=\{commandPanelOpen\} className="wilds-multiplayer-home" inert=\{commandPanelOpen \? true : undefined\}/);
  assert.match(campaign, /aria-hidden=\{commandPanelOpen\}[\s\S]*wilds-world-status-home[\s\S]*inert=\{commandPanelOpen \? true : undefined\}/);
  assert.match(campaign, /worldStatusOpen && !commandPanelOpen \? <div className="wilds-world-status-fan"/);
  assert.match(campaign, /overlayDispatch=\{dispatchStageOverlay\}/);
  assert.match(campaign, /overlayState=\{worldOverlayState\}/);
  assert.doesNotMatch(controls, /useWorldOverlayDirector/);
  assert.match(controls, /overlayState: WorldOverlayState/);
  assert.match(hud, /aria-hidden=\{modalOwned\}[\s\S]*inert=\{modalOwned \? true : undefined\}/);
  assert.match(hud, /disabled=\{!interactionEnabled\}/);
  assert.match(minimap, /disabled=\{disabled\}/);
});

test("panel ownership ref closes the same-frame action window before React commits", () => {
  const hook = read("src/features/play/use-world-overlay-director.ts");
  const campaign = read("src/features/play/PlayCampaign.tsx");
  assert.match(hook, /if \(event\.type === "panel"\) panelOwnershipRef\.current = event\.key !== null/);
  assert.match(hook, /return \{ state, dispatch, gestureCancelSignal, panelOwnershipRef \}/);
  assert.match(campaign, /if \(!canUseWorldStage\(\)\) return;[\s\S]*dispatch\(input\)/);
  assert.match(campaign, /const openWorldMap = \(\) => \{[\s\S]*if \(!canUseWorldStage\(\)\) return/);
  assert.match(campaign, /if \(canUseWorldStage\(\)\) setRequestedCommand\("mission"\)/);
  assert.match(campaign, /if \(!canUseWorldStage\(\)\) return;[\s\S]*const nextOpen = !worldStatusOpen/);
});
