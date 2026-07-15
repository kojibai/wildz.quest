import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("gameplay composes the reference HUD and social deck over the preserved world", () => {
  const source = readFileSync("src/features/play/PlayCampaign.tsx", "utf8");
  for (const token of ["WildsWorldCanvas", "WildzReferenceHud", "WildzSocialDeck"]) assert.match(source, new RegExp(token));
  const world = readFileSync("src/features/play/WildsWorldCanvas.tsx", "utf8");
  assert.match(world, /ActiveCompanion/);
});

test("D-pad occupies the centered column inside the safe-area deck", () => {
  const css = readFileSync("app/globals.css", "utf8");
  assert.match(css, /\.wildz-bottom-play-controls\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) 72px minmax\(0, 1fr\)/);
  assert.match(css, /\.wildz-bottom-play-controls \.wildz-dpad/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
});
