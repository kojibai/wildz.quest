import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

test("active companion command is a character-only Vault selector", () => {
  const source = read("src/features/play/WildsCompanionCommand.tsx");
  assert.match(source, /WildsCreatureThumbnail/);
  assert.match(source, /asset=\{activeEntry\.asset\}/);
  assert.match(source, /activeEntry\.name/);
  assert.doesNotMatch(source, /wilds-companion-peek|previous \?|next \?/);
  assert.match(source, /setPointerCapture/);
  assert.match(source, /capture is optional/);
  assert.match(source, /releaseCompanionGesture/);
  for (const result of ["open-drawer-preview", "open-quick-actions", "cycle-next", "cycle-previous"]) {
    assert.match(source, new RegExp(result));
  }
  assert.doesNotMatch(source, /fieldPowers|onUsePower|onSelectAbility|ability-wheel|role="listbox"|Grove Pulse/);
  assert.match(source, /Bond \{activeEntry\.bond\}/);
});

test("tap toggles character actions while upward flick restores the Slate preview", () => {
  const source = read("src/features/play/WildsCompanionCommand.tsx");
  assert.match(source, /companionCommandKeyResult/);
  assert.match(source, /setQuickActionsOpen\(\(open\) => !open\)/);
  assert.match(source, /onRequestDrawer\("preview"\)/);
  assert.match(source, /advanceCompanionGesture/);
  assert.match(source, />Bond<\/button>/);
  assert.doesNotMatch(source, />Train<\/button>/);
  assert.match(source, /Recover/);
  assert.match(source, /View in Vault/);
  assert.match(source, /Swipe sideways to change character, flick up for Slate, or hold for character actions/);
  assert.doesNotMatch(source, /Close character actions|Icons\.close/);
});

test("companion command is thumb-sized, safe-area aware, directional, and motion-safe", () => {
  const css = read("app/globals.css");
  assert.match(css, /\.wilds-companion-command\s*\{[^}]*width:\s*(?:clamp\([^;]*72px[^;]*94px|[789]\dpx)/s);
  assert.match(css, /\.wilds-companion-command-zone\s*\{[^}]*env\(safe-area-inset-right\)/s);
  assert.doesNotMatch(css, /wilds-companion-peek/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.wilds-companion-command/s);
});

test("only the visible active companion portrait blinks at its identity cadence", () => {
  const css = read("app/globals.css");
  const visiblePortrait = String.raw`\.wildz-companion-home:not\(\[aria-hidden="true"\]\) \.wilds-companion-active-portrait`;

  assert.match(css, new RegExp(`${visiblePortrait} \\[data-slot\\]\\s*\\{[^}]*transform-box:\\s*fill-box;`, "s"));
  assert.match(css, new RegExp(`${visiblePortrait} \\[data-slot="eyes"\\]\\s*\\{[^}]*animation:\\s*wilds-creature-blink var\\(--heartbound-blink, 3600ms\\) linear infinite;`, "s"));
  assert.match(css, new RegExp(`@media \\(prefers-reduced-motion: reduce\\)\\s*\\{[\\s\\S]*${visiblePortrait} \\[data-slot="eyes"\\]\\s*\\{[^}]*animation:\\s*none;`));
  assert.doesNotMatch(css, /\.wilds-creature-thumbnail\s+\[data-slot="eyes"\]\s*\{[^}]*animation:/s);
});

test("the command requests controlled drawer snaps and replaces the duplicate action rails", () => {
  const command = read("src/features/play/WildsCompanionCommand.tsx");
  const drawer = read("src/features/play/WildzCreatureDrawer.tsx");
  assert.match(command, /open-quick-actions/);
  assert.match(drawer, /onSnapChange: \(snap: CreatureDrawerSnap\) => void/);
  assert.doesNotMatch(drawer, /useState<CreatureDrawerSnap>\("closed"\)/);
  assert.match(read("src/features/play/WildzWorldControls.tsx"), /<WildsCompanionCommand/);
});

test("the command visibly renders the proof-sealed individual name", () => {
  const companionSource = read("src/features/play/WildsCompanionCommand.tsx");
  assert.match(companionSource, /className="wilds-companion-real-name"[^>]*>\{activeEntry\.name\}/);
  assert.doesNotMatch(companionSource, /wilds-companion-real-name[^\n]*(familyId|species|formId)/);
});
