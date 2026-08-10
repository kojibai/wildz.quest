import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

test("active companion command exposes portrait peeks and the full semantic gesture surface", () => {
  const source = read("src/features/play/WildsCompanionCommand.tsx");
  assert.match(source, /WildsCreatureThumbnail/);
  assert.match(source, /wilds-companion-peek previous/);
  assert.match(source, /wilds-companion-peek next/);
  assert.match(source, /aria-hidden="true"/);
  assert.match(source, /setPointerCapture/);
  assert.match(source, /capture is optional/);
  assert.match(source, /releaseCompanionGesture/);
  for (const result of ["tap-power", "cycle-next", "cycle-previous", "open-drawer", "select-ability"]) {
    assert.match(source, new RegExp(result));
  }
});

test("hold and slide has accessible abilities and equivalent keyboard controls", () => {
  const source = read("src/features/play/WildsCompanionCommand.tsx");
  assert.match(source, /role="listbox"/);
  assert.match(source, /aria-activedescendant/);
  assert.match(source, /event\.key === "Enter"|event\.key === " "/);
  assert.match(source, /ArrowLeft/);
  assert.match(source, /ArrowRight/);
  assert.match(source, /ArrowUp/);
  assert.match(source, /Escape/);
  assert.match(source, /playWildsHaptic\("wheel-open"\)/);
  assert.match(source, /playWildsHaptic\("wheel-detent"\)/);
});

test("raw wheel sectors visibly select the same normalized ability that release equips", () => {
  const source = read("src/features/play/WildsCompanionCommand.tsx");
  assert.match(source, /const normalizedActiveAbilityIndex = activeAbilityIndex === null \? null : activeAbilityIndex % abilityCount/);
  assert.match(source, /aria-activedescendant=\{normalizedActiveAbilityIndex === null \? undefined : `wilds-companion-ability-\$\{normalizedActiveAbilityIndex\}`\}/);
  assert.match(source, /aria-selected=\{normalizedActiveAbilityIndex === index\}/);
  assert.match(source, /normalizedActiveAbilityIndex === index \? " is-active" : ""/);
  assert.match(source, /const index = result\.index % abilityCount;[\s\S]*setSelectedAbilityIndex\(index\);[\s\S]*onSelectAbility\(index\)/);
  assert.doesNotMatch(source, /aria-selected=\{activeAbilityIndex === index\}/);
});

test("companion command is thumb-sized, safe-area aware, directional, and motion-safe", () => {
  const css = read("app/globals.css");
  assert.match(css, /\.wilds-companion-command\s*\{[^}]*width:\s*(?:clamp\([^;]*72px[^;]*94px|[789]\dpx)/s);
  assert.match(css, /\.wilds-companion-command-zone\s*\{[^}]*env\(safe-area-inset-right\)/s);
  assert.match(css, /\.wilds-companion-peek\.previous\s*\{[^}]*translate/s);
  assert.match(css, /\.wilds-companion-peek\.next\s*\{[^}]*translate/s);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.wilds-companion-command/s);
});

test("the command requests controlled drawer snaps and replaces the duplicate action rails", () => {
  const command = read("src/features/play/WildsCompanionCommand.tsx");
  const drawer = read("src/features/play/WildzCreatureDrawer.tsx");
  const social = read("src/features/play/WildzSocialDeck.tsx");
  assert.match(command, /onRequestDrawer\("preview"\)/);
  assert.match(drawer, /requestedSnap/);
  assert.match(drawer, /onRequestedSnapHandled/);
  assert.match(social, /<WildsCompanionCommand/);
  assert.doesNotMatch(social, /wildz-play-control-rail|wildz-social-actions/);
});

test("the command visibly renders the proof-sealed individual name", () => {
  const companionSource = read("src/features/play/WildsCompanionCommand.tsx");
  assert.match(companionSource, /className="wilds-companion-real-name"[^>]*>\{activeCard\.manifest\.name\}/);
  assert.doesNotMatch(companionSource, /wilds-companion-real-name[^\n]*(familyId|species|formId)/);
});
