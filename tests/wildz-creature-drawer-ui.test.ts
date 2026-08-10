import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const drawerPath = "src/features/play/WildzCreatureDrawer.tsx";

test("social deck mounts a dedicated active-creature drawer above permanent controls", () => {
  const social = readFileSync("src/features/play/WildzSocialDeck.tsx", "utf8");
  const drawer = existsSync(drawerPath) ? readFileSync(drawerPath, "utf8") : "";

  assert.match(social, /<WildzCreatureDrawer/);
  assert.ok(social.indexOf("<WildzCreatureDrawer") < social.indexOf("wildz-bottom-play-controls"));
  assert.match(social, /<WildsCompanionCommand/);
  assert.match(drawer, /aria-expanded=\{mode !== "closed"\}/);
  assert.match(drawer, /settleCreatureDrawer/);
  assert.match(drawer, /selectCard\(assetId\);[\s\S]*?onSnapChange\("closed"\)/);
  assert.doesNotMatch(drawer, /Previous card rail page|Next card rail page|Page \{/);
});

test("drawer exposes three wordless states with automatic windowing", () => {
  const drawer = existsSync(drawerPath) ? readFileSync(drawerPath, "utf8") : "";
  const css = readFileSync("app/globals.css", "utf8");

  assert.match(drawer, /creatureBookWindow/);
  assert.match(drawer, /mode === "preview"/);
  assert.match(drawer, /mode === "expanded"/);
  assert.match(drawer, /wildz-creature-drawer-dots/);
  assert.match(drawer, /wildz:drawer-affordance-seen:v1/);
  assert.match(drawer, /drawerHapticPattern/);
  assert.doesNotMatch(drawer, /beginRailScrollGuard|guardRailHorizontalScroll/);
  assert.match(css, /\.wildz-creature-drawer\.is-closed\s*\{[^}]*height:\s*var\(--wildz-drawer-height\)/s);
  assert.doesNotMatch(css, /\.wildz-creature-drawer-handle\s*\{[^}]*transform:\s*translate\(50%, 50%\)/s);
  assert.match(css, /\.wildz-creature-window\s*\{[^}]*touch-action:\s*pan-x/s);
  assert.match(css, /\.wildz-creature-spread\s*\{[^}]*grid-template-columns:\s*repeat\(2,[^}]*grid-template-rows:\s*repeat\(4,/s);
});

test("companion command opens the controlled roster while Vault and Trail Pack remain in command dock", () => {
  const social = readFileSync("src/features/play/WildzSocialDeck.tsx", "utf8");
  const campaign = readFileSync("src/features/play/PlayCampaign.tsx", "utf8");
  const drawerSource = readFileSync(drawerPath, "utf8");

  assert.match(social, /const \[drawerSnap, setDrawerSnap\] = useState<CreatureDrawerSnap>\("closed"\)/);
  assert.match(social, /snap=\{drawerSnap\}/);
  assert.match(social, /onSnapChange=\{setDrawerSnap\}/);
  assert.match(social, /onRequestDrawer=\{setDrawerSnap\}/);
  assert.doesNotMatch(social, /requestedSnap|onRequestedSnapHandled/);
  assert.match(campaign, /key: "deck"/);
  assert.match(campaign, /key: "vault"/);
  assert.match(drawerSource, /snap: CreatureDrawerSnap/);
  assert.match(drawerSource, /onSnapChange: \(snap: CreatureDrawerSnap\) => void/);
  assert.doesNotMatch(drawerSource, /useState<CreatureDrawerSnap>\("closed"\)/);
});
