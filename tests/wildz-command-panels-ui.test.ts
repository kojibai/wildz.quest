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
  assert.match(dock, /document\.documentElement\.classList\.add\("wilds-command-open"\)/);
  assert.match(dock, /document\.body\.classList\.add\("wilds-command-open"\)/);
  assert.match(dock, /autoFocus[\s\S]*aria-label=\{`Close \$\{activeItem\.label\}`\}/);
  assert.match(dock, /const sheetRef = useRef<HTMLElement \| null>\(null\)/);
  assert.match(dock, /if \(event\.key === "Tab"\)[\s\S]*event\.preventDefault\(\)/);
  assert.match(dock, /document\.addEventListener\("focusin", containFocus\)/);
  assert.match(dock, /tabIndex=\{-1\}[\s\S]*className="wilds-command-backdrop"/);
  assert.match(dock, /aria-hidden=\{activeItem \? true : undefined\}[\s\S]*disabled=\{Boolean\(activeItem\)\}/);
  assert.match(css, /\.wilds-command-sheet-header\s*\{[^}]*position:\s*sticky/s);
  assert.match(css, /\.wilds-command-sheet-content\s*\{[^}]*padding:\s*0 12px 12px/s);
  assert.match(css, /html\.wilds-command-open,\s*body\.wilds-command-open\s*\{[^}]*background:\s*#09110d\s*!important/s);
  assert.match(css, /\.wilds-command-overlay::after\s*\{[^}]*position:\s*fixed[^}]*background:\s*#09110d/s);
  assert.match(css, /\.wildz-tools-home\s*\{[^}]*transform:\s*none/s);
  assert.match(css, /\.wildz-world-controls\.is-panel-open \.wildz-tools-home\s*\{[^}]*z-index:\s*2/s);
  assert.match(css, /\.wildz-world-controls\.is-panel-open :is\(\.wildz-movement-home, \.wildz-companion-home\)\s*\{[^}]*pointer-events:\s*none/s);
  assert.doesNotMatch(css, /\.wildz-tools-home\s*\{[^}]*transform:\s*translate/s);
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

test("all mobile HUD popovers own one continuous vertical touch scroller", () => {
  const dock = source("src/features/play/WildsCommandDock.tsx");
  const audio = source("src/features/play/WildsAudioSettings.tsx");
  const living = source("src/features/play/WildsLivingWorldHud.tsx");
  const multiplayer = source("src/features/play/WildsMultiplayer.tsx");
  const surface = source("src/features/play/WildsPopoverSurface.tsx");
  const css = source("app/globals.css");
  assert.match(dock, /createPortal\([\s\S]*wilds-command-overlay[\s\S]*document\.body/s);
  assert.doesNotMatch(dock, /wilds-command-handle|setPointerCapture/);
  for (const component of [audio, living, multiplayer]) assert.match(component, /<WildsPopoverSurface/);
  assert.match(surface, /createPortal/);
  assert.match(surface, /className=\{`wilds-popover-layer\$\{portalTarget \? " is-contained" : ""\}`\}/);
  assert.match(surface, /className="wilds-popover-scroll"/);
  assert.match(surface, /onPointerDown=\{stopPointerPropagation\}/);
  assert.match(surface, /onPointerMove=\{stopPointerPropagation\}/);
  assert.match(css, /\.wilds-command-overlay\s*\{[^}]*pointer-events:\s*auto;/s);
  assert.match(css, /\.wilds-popover-layer\s*\{[^}]*position:\s*fixed;[^}]*inset:\s*0;[^}]*touch-action:\s*none;/s);
  assert.match(css, /\.wilds-popover-surface\s*\{[^}]*display:\s*grid;[^}]*grid-template-rows:\s*auto minmax\(0, 1fr\);[^}]*overflow:\s*hidden;/s);
  assert.match(css, /\.wilds-popover-scroll\s*\{[^}]*min-height:\s*0;[^}]*overflow-y:\s*auto;[^}]*overscroll-behavior-y:\s*contain;[^}]*scroll-snap-type:\s*none;[^}]*touch-action:\s*pan-y;[^}]*-webkit-overflow-scrolling:\s*touch;/s);
  assert.match(css, /\.wilds-popover-scroll :is\(button, a, summary, label\)\s*\{[^}]*touch-action:\s*pan-y;/s);
  assert.doesNotMatch(css, /\.wilds-command-sheet-content \.wilds-kai-inspector-popover\s*\{[^}]*position:\s*relative;[^}]*overflow:\s*visible;/s);
  assert.match(css, /\.wilds-command-sheet-content :is\(\.wilds-card-back-scroll, \.wilds-growth-panel ol\)\s*\{[^}]*height:\s*auto;[^}]*max-height:\s*none;[^}]*overflow:\s*visible;[^}]*overscroll-behavior:\s*auto;/s);
  assert.match(css, /\.wilds-command-sheet-content \.wilds-card-proof-dossier pre\s*\{[^}]*max-height:\s*none;[^}]*overflow:\s*visible;/s);
  assert.match(css, /\.wilds-live-sheet \.wilds-live-chat > div\s*\{[^}]*max-height:\s*none;[^}]*overflow:\s*visible;/s);
});

test("command sheet uses premium fixed chrome without a competing drag strip", () => {
  const dock = source("src/features/play/WildsCommandDock.tsx");
  const css = source("app/globals.css");

  assert.match(dock, /<div className="wilds-command-sheet-chrome">[\s\S]*<header className="wilds-command-sheet-header">/s);
  assert.doesNotMatch(dock, /className="wilds-command-handle"/);
  assert.match(css, /\.wilds-command-sheet-chrome\s*\{[^}]*border-bottom:[^;}]+;/s);
  assert.match(css, /\.wilds-command-sheet-chrome\s*\{[^}]*background:[^;}]+;/s);
  assert.match(css, /\.wilds-command-sheet-chrome::before\s*\{[^}]*background:[^;}]+;/s);
  assert.doesNotMatch(css, /\.wilds-command-handle\s*\{/s);
});

test("Profile and Market show admitted impact without inventing authority", () => {
  const profile = source("src/features/profile/WildzProfileSheet.tsx");
  const market = source("src/features/market/WildzMarketSheet.tsx");

  assert.match(profile, /wildz-profile-impact/);
  assert.match(market, /wildz-market-consequence/);
  assert.match(market, /Trade settled\. Receiz admitted the ownership transfer\./);
  assert.match(market, /recovery_pending/);
});
