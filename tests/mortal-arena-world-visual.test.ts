import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("the center Arena uses an authored mobile-budgeted world anchor", async () => {
  const source = await readFile("src/features/play/WildsEnvironment.tsx", "utf8");
  for (const feature of ["mortal-arena-world-anchor", "arena-open-bowl", "arena-proof-seams", "arena-split-arch", "arena-spectator-silhouettes", "arena-canonical-seal"]) assert.match(source, new RegExp(feature));
  assert.match(source, /instancedMesh/);
  assert.match(source, /qualityProfile\.tier !== "low"/);
  assert.doesNotMatch(source, /arena-of-echoes-building/);
});
