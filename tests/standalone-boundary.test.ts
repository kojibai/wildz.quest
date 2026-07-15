import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

function sourceFiles(root: string) {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { recursive: true })
    .map(String)
    .filter((file) => /\.(ts|tsx)$/.test(file))
    .map((file) => path.join(root, file));
}

test("standalone source does not import storefront or merchant features", () => {
  const forbidden = ["app", "src"]
    .flatMap(sourceFiles)
    .filter((file) => /@\/features\/(storefront|admin)|@\/lib\/storefront/.test(fs.readFileSync(file, "utf8")));

  assert.deepEqual(forbidden, []);
  assert.equal(fs.existsSync("src/lib/storefront"), false);
});

test("standalone app source exists", () => {
  assert.equal(fs.existsSync("src/features/play/PlayCampaign.tsx"), true);
  assert.equal(fs.existsSync("app/api/wilds/world/snapshot/route.ts"), true);
});
