import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { initialWorldOverlayState, reduceWorldOverlay } from "../src/features/play/world-overlay-state";

const read = (path: string) => readFileSync(path, "utf8");

test("viewport, visibility, Escape, and exclusive ownership cancel active gestures", () => {
  const hook = read("src/features/play/use-world-overlay-director.ts");
  const controls = read("src/features/play/WildzWorldControls.tsx");
  const companion = read("src/features/play/WildsCompanionCommand.tsx");
  const dpad = read("src/features/play/WildzDpad.tsx");

  assert.match(hook, /orientationchange/);
  assert.match(hook, /visibilitychange/);
  assert.match(hook, /event\.key === "Escape"/);
  assert.match(hook, /gestureCancelSignal/);
  assert.match(controls, /cancelSignal=\{gestureCancelSignal\}/);
  assert.match(companion, /onLostPointerCapture=\{cancelPointer\}/);
  assert.match(dpad, /onLostPointerCapture=\{release\}/);
  assert.match(companion, /\[cancelSignal\]/);
  assert.match(dpad, /\[cancelSignal, reset\]/);
});

test("movement and companion gestures own only their initiating pointer", () => {
  const controls = read("src/features/play/WildzWorldControls.tsx");
  const companion = read("src/features/play/WildsCompanionCommand.tsx");
  const dpad = read("src/features/play/WildzDpad.tsx");

  assert.match(companion, /activePointerIdRef/);
  assert.match(companion, /activePointerIdRef\.current !== event\.pointerId/);
  assert.match(dpad, /activePointerIdRef/);
  assert.match(dpad, /activePointerIdRef\.current !== event\.pointerId/);
  assert.doesNotMatch(controls, /onPointer(?:Down|Move|Up|Cancel|Capture)/);
  assert.doesNotMatch(controls, /preventDefault\(\)/);

  const roster = reduceWorldOverlay(initialWorldOverlayState, { type: "drawer", snap: "preview" });
  assert.equal(roster.drawerSnap, "preview");
  assert.equal(roster.exclusiveOwner, "none");
});

test("controlled callbacks stay stable and the D-pad forwards input directly", () => {
  const controls = read("src/features/play/WildzWorldControls.tsx");
  assert.match(controls, /const forwardInput = useStableEvent\(onInput\)/);
  assert.match(controls, /const handleInput = useCallback/);
  assert.match(controls, /<WildzDpad[\s\S]*?onInput=\{handleInput\}/);
  for (const callback of ["handleToolsOpenChange", "handlePanelKeyChange", "handleDrawerSnapChange", "handleRequestDrawer"]) {
    assert.match(controls, new RegExp(`const ${callback} = useCallback`));
  }
});

test("programmatic drawer callbacks cannot mutate overlay state while the companion home is blocked", () => {
  const controls = read("src/features/play/WildzWorldControls.tsx");
  assert.match(controls, /const handleDrawerSnapChange = useCallback[\s\S]*if \(companionHomeBlocked\) return;[\s\S]*overlayDispatch\(\{ type: "drawer", snap \}\)/);
  assert.match(controls, /const handleRequestDrawer = useCallback[\s\S]*if \(!worldHomesEnabled\) return;[\s\S]*overlayDispatch\(\{ type: "drawer", snap \}\)/);
});

test("the companion command receives the same living Vault roster as the Slate", () => {
  const controls = read("src/features/play/WildzWorldControls.tsx");
  assert.match(controls, /const activeEntry = companionRoster\.find\(\(entry\) => entry\.active\) \?\? null/);
  assert.match(controls, /<WildsCompanionCommand[\s\S]*activeEntry=\{activeEntry\}[\s\S]*entries=\{companionRoster\}/);
  assert.doesNotMatch(controls, /<WildsCompanionCommand[\s\S]*cards=\{/);
});

test("command dismissal restores only a valid origin through a cancellable RAF", () => {
  const dock = read("src/features/play/WildsCommandDock.tsx");
  assert.match(dock, /originTriggerRef/);
  assert.match(dock, /focusFrameRef/);
  assert.match(dock, /window\.cancelAnimationFrame/);
  assert.match(dock, /exclusiveOwner === "none"/);
  assert.match(dock, /canRestoreFocus\(origin\)/);
  assert.match(dock, /if \(!requestedItem\)/);
  assert.match(dock, /restoreOriginFocus\(\)/);
  assert.match(dock, /event\.key === "Escape"/);
});

test("world canvas, HUD, and controls share the same stage ancestor", () => {
  const campaign = read("src/features/play/PlayCampaign.tsx");
  const stageStart = campaign.indexOf("<div\n            className={`wilds-stage");
  assert.ok(stageStart >= 0);
  const tags = /<div\b|<\/div>/g;
  tags.lastIndex = stageStart;
  let depth = 0;
  let stageEnd = -1;
  for (let match = tags.exec(campaign); match; match = tags.exec(campaign)) {
    depth += match[0] === "</div>" ? -1 : 1;
    if (depth === 0) {
      stageEnd = tags.lastIndex;
      break;
    }
  }
  assert.ok(stageEnd > stageStart);
  const stageMarkup = campaign.slice(stageStart, stageEnd);
  assert.match(stageMarkup, /<WildsWorldCanvas/);
  assert.match(stageMarkup, /<WildzReferenceHud/);
  assert.match(stageMarkup, /<WildzWorldControls/);
  assert.ok(campaign.indexOf("<WildsWorldMap", stageStart) > stageEnd);
});
