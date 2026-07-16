import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const drawerPath = "src/features/play/WildzCreatureDrawer.tsx";

test("social deck mounts a dedicated active-creature drawer above permanent controls", () => {
  const social = readFileSync("src/features/play/WildzSocialDeck.tsx", "utf8");
  const drawer = existsSync(drawerPath) ? readFileSync(drawerPath, "utf8") : "";

  assert.match(social, /<WildzCreatureDrawer/);
  assert.ok(social.indexOf("<WildzCreatureDrawer") < social.indexOf("wildz-bottom-play-controls"));
  assert.ok(social.indexOf("wildz-bottom-play-controls") < social.indexOf("wildz-social-actions"));
  assert.match(drawer, /aria-expanded=\{mode !== "closed"\}/);
  assert.match(drawer, /settleCreatureDrawer/);
  assert.match(drawer, /selectCard\(assetId\);[\s\S]*?setSnap\("closed"\)/);
  assert.doesNotMatch(drawer, /Previous card rail page|Next card rail page|Page \{/);
});

test("drawer exposes rail grid and eight-card book layouts with automatic windowing", () => {
  const drawer = existsSync(drawerPath) ? readFileSync(drawerPath, "utf8") : "";
  const css = readFileSync("app/globals.css", "utf8");

  assert.match(drawer, /creatureBookWindow/);
  assert.match(drawer, /mode === "rail"/);
  assert.match(drawer, /mode === "grid"/);
  assert.match(drawer, /mode === "book"/);
  assert.match(css, /\.wildz-creature-drawer\.is-closed\s*\{[^}]*height:\s*0/s);
  assert.match(css, /\.wildz-creature-spread\s*\{[^}]*grid-template-columns:\s*repeat\(2,[^}]*grid-template-rows:\s*repeat\(4,/s);
});

test("toolbar creature opens Vault while the archive icon opens Trail Pack", () => {
  const social = readFileSync("src/features/play/WildzSocialDeck.tsx", "utf8");

  assert.match(social, /aria-label="Open Trail Pack[^"]*"[\s\S]*?className="wildz-action-vault"[\s\S]*?onClick=\{onOpenDeck\}/);
  assert.match(social, /aria-label="Open card vault"[\s\S]*?className="wildz-action-companion"[\s\S]*?onClick=\{onOpenVault\}/);
});
