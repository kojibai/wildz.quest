import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

function source(path: string) {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

test("command sheets share a compact status consequence action hierarchy", () => {
  const insight = source("src/features/play/WildzCommandInsight.tsx");
  const dock = source("src/features/play/WildsCommandDock.tsx");
  const css = source("app/globals.css");

  assert.match(insight, /export function WildzCommandInsight/);
  assert.match(insight, /wilds-command-insight/);
  assert.match(dock, /status\?: string/);
  assert.match(dock, /wilds-command-sheet-status/);
  assert.match(css, /\.wilds-command-sheet-header\s*\{[^}]*position:\s*sticky/s);
  assert.match(css, /\.wilds-command-sheet-content\s*\{[^}]*padding:\s*0 12px 12px/s);
  assert.doesNotMatch(css, /\.wilds-command-sheet[^}]*transform:\s*scale\(/s);
});

test("in-world panels expose real reducer actions and compact consequences", () => {
  const campaign = source("src/features/play/PlayCampaign.tsx");

  assert.match(campaign, /<WildzCommandInsight/);
  assert.match(campaign, /type: "rest"/);
  assert.match(campaign, /type: "train"/);
  assert.match(campaign, /type: "mission"/);
  assert.match(campaign, /type: "assign-support"/);
  assert.match(campaign, /status: `[^`]+`/);
});

test("Vault keeps its proof actions while using the compact premium header", () => {
  const inventory = source("src/features/play/WildsInventory.tsx");

  assert.match(inventory, /wilds-vault-compact-header/);
  assert.match(inventory, /onRestoreArtifact/);
  assert.match(inventory, /onExportVault/);
  assert.match(inventory, /onListAsset/);
  assert.match(inventory, /aria-label="Sort card vault"/);
});

test("Profile and Market show admitted impact without inventing authority", () => {
  const profile = source("src/features/profile/WildzProfileSheet.tsx");
  const market = source("src/features/market/WildzMarketSheet.tsx");

  assert.match(profile, /wildz-profile-impact/);
  assert.match(market, /wildz-market-consequence/);
  assert.match(market, /Trade settled\. Receiz admitted the ownership transfer\./);
  assert.match(market, /recovery_pending/);
});
