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
    for (const label of ["Focus", "Swap", "Flee"]) assert.match(context, new RegExp(`<strong>${label}</strong>`));
  });

  it("maps primary controls onto the current deterministic simulation inputs", () => {
    assert.match(source, /mortal-arena-primary-strike[\s\S]*?arena\.pulse\(\{ light: true \}\)/);
    assert.match(source, /mortal-arena-guard[\s\S]*?arena\.hold\("guard", true\)/);
    assert.match(source, /mortal-arena-ability[\s\S]*?arena\.pulse\(\{ heavy: true \}\)/);
    assert.match(source, /activeArenaCard\.manifest\.abilityNames\[0\]/);
  });

  it("gives portrait controls thumb-sized geometry without a six-column footer", () => {
    assert.match(css, /\.mortal-arena-actions\s*\{[^}]*grid-template-columns:\s*minmax\(96px, 128px\) minmax\(0, 1fr\) minmax\(58px, 84px\)/);
    assert.match(css, /\.mortal-arena-primary-strike\s*\{[^}]*min-height:\s*68px/);
    assert.match(css, /\.mortal-arena-guard, \.mortal-arena-ability\s*\{[^}]*min-height:\s*56px/);
    assert.doesNotMatch(css, /\.mortal-arena-actions\s*\{[^}]*grid-template-columns:\s*repeat\(2,[^}]*repeat\(3,/);
    assert.doesNotMatch(css, /@media \(max-width: 430px\)[\s\S]*?\.mortal-arena-actions\s*\{[^}]*repeat\(2,[^}]*repeat\(3,/);
  });

  it("keeps labels visible during mobile learning and respects safe areas", () => {
    assert.match(css, /padding-bottom:\s*max\(6px, env\(safe-area-inset-bottom\)\)/);
    assert.doesNotMatch(css, /\.mortal-arena-actions > button span\s*\{\s*display:\s*none/);
  });
});
