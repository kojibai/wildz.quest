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
