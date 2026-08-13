import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = readFileSync("src/features/games/mortal-arena/MortalArenaExperience.tsx", "utf8");
const css = readFileSync("app/globals.css", "utf8");

describe("Mortal Arena mobile combat zones", () => {
  it("separates movement, primary combat, and contextual survival actions", () => {
    for (const token of [
      "mortal-arena-movement-zone",
      "mortal-arena-combat-zone",
      "mortal-arena-primary-strike",
      "mortal-arena-guard",
      "mortal-arena-ability",
      "mortal-arena-context-actions"
    ]) assert.match(source, new RegExp(token));
    const contextStart = source.indexOf('className="mortal-arena-context-actions"');
    const contextEnd = source.indexOf("</div>", contextStart);
    const context = source.slice(contextStart, contextEnd);
    for (const label of ["Dodge", "Parry", "Focus", "Tag", "Use", "Withdraw"]) assert.match(context, new RegExp(`<strong>${label}</strong>`));
  });

  it("maps primary controls onto the current deterministic simulation inputs", () => {
    assert.match(source, /mortal-arena-primary-strike[\s\S]*?arena\.pulse\(\{ light: true \}\)/);
    assert.match(source, /mortal-arena-guard[\s\S]*?arena\.hold\("guard", true\)/);
    assert.match(source, /mortal-arena-ability[\s\S]*?arena\.pulse\(\{ abilitySlot: 0 \}\)/);
    assert.match(source, /activeArenaCard\.manifest\.abilityNames\[0\]/);
  });

  it("gives portrait controls thumb-sized geometry without a six-column footer", () => {
    assert.match(css, /\.mortal-arena-context-actions\s*\{[^}]*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)[^}]*grid-template-rows:\s*repeat\(2, minmax\(40px, 1fr\)\)/);
    assert.match(css, /@media \(max-width: 430px\)[\s\S]*?\.mortal-arena-actions\s*\{[^}]*min-height:\s*104px/);
    assert.match(css, /@media \(max-width: 430px\)[\s\S]*?\.mortal-arena-trackpad\s*\{[^}]*width:\s*72px;[^}]*height:\s*72px/);
    assert.match(css, /\.mortal-arena-primary-strike\s*\{[^}]*min-height:\s*68px/);
    assert.match(css, /\.mortal-arena-guard, \.mortal-arena-ability\s*\{[^}]*min-height:\s*48px/);
    assert.doesNotMatch(css, /\.mortal-arena-actions\s*\{[^}]*min-height:\s*146px/);
    assert.doesNotMatch(css, /\.mortal-arena-actions\s*\{[^}]*grid-template-columns:\s*repeat\(2,[^}]*repeat\(3,/);
    assert.doesNotMatch(css, /@media \(max-width: 430px\)[\s\S]*?\.mortal-arena-actions\s*\{[^}]*repeat\(2,[^}]*repeat\(3,/);
  });

  it("keeps labels visible during mobile learning and respects safe areas", () => {
    assert.match(css, /padding-bottom:\s*max\(6px, env\(safe-area-inset-bottom\)\)/);
    assert.doesNotMatch(css, /\.mortal-arena-actions > button span\s*\{\s*display:\s*none/);
    assert.doesNotMatch(css, /\.mortal-arena-context-actions button strong\s*\{[^}]*display:\s*none/);
  });

  it("keeps both life cards full-width above a separate compact resource rail", () => {
    assert.match(css, /\.mortal-arena-life\.is-player\s*\{[^}]*grid-column:\s*1;[^}]*grid-row:\s*1/);
    assert.match(css, /\.mortal-arena-round-mark\s*\{[^}]*grid-column:\s*2;[^}]*grid-row:\s*1/);
    assert.match(css, /\.mortal-arena-life\.is-rival\s*\{[^}]*grid-column:\s*3;[^}]*grid-row:\s*1/);
    assert.match(css, /\.mortal-arena-skill-state\s*\{[^}]*grid-column:\s*1 \/ -1;[^}]*grid-row:\s*2;[^}]*display:\s*flex/);
  });
});
