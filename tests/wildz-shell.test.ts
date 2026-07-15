import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

test("root page renders one persistent Wildz app", () => {
  const source = read("app/page.tsx");
  assert.match(source, /<WildzApp/);
  assert.doesNotMatch(source, /PublicStorefront|Header|Footer/);
});

test("Wildz app owns the game and overlay state", () => {
  const source = read("src/features/shell/WildzApp.tsx");
  assert.equal(source.match(/<PlayCampaign\b/g)?.length, 1);
  assert.match(source, /initialOverlay/);
  assert.match(source, /wildz-app/);
});

test("Wildz creates identity before character genesis and enters play with that identity", () => {
  const source = read("src/features/shell/WildzApp.tsx");
  assert.match(source, /ensureWildzIdentity/);
  assert.match(source, /<WildzGenesis/);
  assert.match(source, /ownerReceizId=\{identity\.identity\.username\}/);
  assert.match(source, /WILDZ_CHARACTER_STORAGE_KEY/);
});

test("global shell is edge-to-edge and safe-area aware", () => {
  const styles = read("app/globals.css");
  assert.match(styles, /\.wildz-app-shell\s*\{[\s\S]*?height:\s*100dvh/);
  assert.match(styles, /env\(safe-area-inset-top\)/);
  assert.match(styles, /overscroll-behavior:\s*none/);
  assert.match(styles, /\.wildz-app\s*>\s*\.wilds-play-panel[\s\S]*?position:\s*absolute/);
  assert.match(styles, /\.wildz-app\s+\.wilds-header\s*\{\s*display:\s*none/);
});
