import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const drawerPath = "src/features/play/WildzCreatureDrawer.tsx";

test("unified controls mount the projected Vault roster drawer beside the companion command", () => {
  const controls = readFileSync("src/features/play/WildzWorldControls.tsx", "utf8");
  const drawer = existsSync(drawerPath) ? readFileSync(drawerPath, "utf8") : "";

  assert.match(controls, /<WildzCreatureDrawer/);
  assert.ok(controls.indexOf("<WildzCreatureDrawer") < controls.indexOf("<WildsCompanionCommand"));
  assert.match(controls, /projectVaultCompanionRoster/);
  assert.match(controls, /entries=\{companionRoster\}/);
  assert.match(drawer, /\{mode !== "closed" \? <button[\s\S]*?aria-expanded=\{true\}/);
  assert.match(drawer, /settleCreatureDrawer/);
  assert.match(drawer, /selectCard\(assetId\);[\s\S]*?onSnapChange\("closed"\)/);
  assert.doesNotMatch(drawer, /Previous card rail page|Next card rail page|Page \{/);
});

test("drawer renders exact Vault names and complete selectable stats without retired controls", () => {
  const drawer = readFileSync(drawerPath, "utf8");

  assert.match(drawer, /entry\.name/);
  assert.match(drawer, /entry\.level/);
  assert.match(drawer, /entry\.xp/);
  assert.match(drawer, /entry\.bond/);
  assert.match(drawer, /entry\.conditionLabel/);
  assert.match(drawer, /entry\.element/);
  assert.match(drawer, /entry\.species/);
  assert.match(drawer, /entry\.newlyCaptured/);
  assert.doesNotMatch(drawer, /retired \? onInspect|is-retired/);
  assert.doesNotMatch(drawer, /nearbyCards|companionProgress|cardConditions|memorialAsset/);
});

test("selecting a roster entry uses its exact asset id, closes, and restores the companion command focus", () => {
  const drawer = readFileSync(drawerPath, "utf8");
  const controls = readFileSync("src/features/play/WildzWorldControls.tsx", "utf8");

  assert.match(drawer, /onClick=\{\(\) => selectAndClose\(entry\.asset\.id\)\}/);
  assert.match(drawer, /selectCard\(assetId\);[\s\S]*?onSnapChange\("closed"\)/);
  assert.match(controls, /drawerOriginRef\.current = document\.activeElement instanceof HTMLElement \? document\.activeElement : null/);
  assert.match(controls, /canRestoreFocus\(drawerOriginRef\.current\)/);
  assert.match(controls, /window\.requestAnimationFrame/);
});

test("drawer exposes three wordless states with automatic roster windowing", () => {
  const drawer = existsSync(drawerPath) ? readFileSync(drawerPath, "utf8") : "";
  const css = readFileSync("app/globals.css", "utf8");

  assert.match(drawer, /creatureBookWindow/);
  assert.match(drawer, /mode === "preview"/);
  assert.match(drawer, /mode === "expanded"/);
  assert.match(drawer, /wildz-creature-drawer-dots/);
  assert.match(drawer, /wildz:drawer-affordance-seen:v1/);
  assert.match(drawer, /drawerHapticPattern/);
  assert.match(drawer, /playHapticPattern\(pattern\)/);
  assert.doesNotMatch(drawer, /navigator\.vibrate|"vibrate" in navigator/);
  assert.doesNotMatch(drawer, /beginRailScrollGuard|guardRailHorizontalScroll/);
  assert.match(css, /\.wildz-creature-drawer\.is-closed\s*\{[^}]*height:\s*var\(--wildz-drawer-height\)/s);
  assert.doesNotMatch(css, /\.wildz-creature-drawer-handle\s*\{[^}]*transform:\s*translate\(50%, 50%\)/s);
  assert.match(css, /\.wildz-creature-window\s*\{[^}]*touch-action:\s*pan-x/s);
  assert.match(css, /\.wildz-creature-spread\s*\{[^}]*overflow-y:\s*auto/s);
  assert.match(css, /@media \(max-width: 350px\) \{[\s\S]*\.wildz-creature-choice\s*\{[^}]*min-height:\s*96px/s);
  assert.match(css, /@media \(orientation: landscape\) and \(max-height: 500px\) \{[\s\S]*\.wildz-creature-spread\s*\{[^}]*grid-template-columns:\s*repeat\(4,/s);
});

test("closed roster leaves the companion command as its sole physical and accessible trigger", () => {
  const drawer = readFileSync(drawerPath, "utf8");
  const command = readFileSync("src/features/play/WildsCompanionCommand.tsx", "utf8");
  const css = readFileSync("app/globals.css", "utf8");

  assert.match(drawer, /\{mode !== "closed" \? <button[\s\S]*?className=\{`wildz-creature-drawer-handle/);
  assert.doesNotMatch(drawer, /mode === "closed" \? `Preview creatures/);
  assert.match(command, /event\.key === "ArrowUp"[\s\S]*?onRequestDrawer\("preview"\)/);
  assert.match(css, /\.wildz-companion-home > \.wildz-creature-drawer\.is-closed\s*\{[^}]*pointer-events:\s*none;/);
});

test("companion command opens the controlled living roster while Vault and Trail Pack remain in command dock", () => {
  const controls = readFileSync("src/features/play/WildzWorldControls.tsx", "utf8");
  const campaign = readFileSync("src/features/play/PlayCampaign.tsx", "utf8");
  const drawerSource = readFileSync(drawerPath, "utf8");

  assert.match(controls, /snap=\{worldHomesEnabled \? overlayState\.drawerSnap : "closed"\}/);
  assert.match(controls, /onSnapChange=\{handleDrawerSnapChange\}/);
  assert.match(controls, /onRequestDrawer=\{handleRequestDrawer\}/);
  assert.match(campaign, /key: "deck"/);
  assert.match(campaign, /key: "vault"/);
  assert.match(drawerSource, /entries: readonly VaultCompanionRosterEntry\[\]/);
  assert.match(drawerSource, /snap: CreatureDrawerSnap/);
  assert.match(drawerSource, /onSnapChange: \(snap: CreatureDrawerSnap\) => void/);
  assert.doesNotMatch(drawerSource, /useState<CreatureDrawerSnap>\("closed"\)/);
});
