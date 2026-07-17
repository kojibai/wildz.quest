import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("battle life values own a non-shrinking track beside an ellipsized name", () => {
  const css = readFileSync("app/globals.css", "utf8");

  assert.match(
    css,
    /\.wilds-battle-world-stat > span\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+max-content/s
  );
  assert.match(
    css,
    /\.wilds-battle-world-stat strong\s*\{[^}]*min-width:\s*0;[^}]*text-overflow:\s*ellipsis/s
  );
  assert.match(
    css,
    /\.wilds-battle-world-stat small\s*\{[^}]*min-width:\s*max-content;[^}]*white-space:\s*nowrap/s
  );
});

test("battle life telemetry stays materially above creatures and remains legible on mobile", () => {
  const canvas = readFileSync("src/features/play/WildsWorldCanvas.tsx", "utf8");
  const css = readFileSync("app/globals.css", "utf8");

  assert.match(canvas, /fighter=\{state\.battle\.player\}\s+position=\{\[0, 1\.9, 0\]\}/s);
  assert.match(canvas, /fighter=\{state\.battle\.wild\}\s+position=\{\[0, 2\.15, 0\]\}/s);
  assert.match(css, /\.wilds-battle-world-stat\s*\{[^}]*width:\s*clamp\(118px,\s*18vw,\s*156px\)/s);
  assert.match(css, /\.wilds-battle-world-stat strong\s*\{[^}]*font-size:\s*11px/s);
  assert.match(css, /@media \(max-width: 560px\)\s*\{[\s\S]*?\.wilds-battle-world-stat\s*\{[^}]*width:\s*118px/s);
  assert.doesNotMatch(css, /\.wilds-battle-world-stat strong,\s*\.wilds-battle-world-stat small\s*\{[^}]*font-size:\s*7px/s);
});
