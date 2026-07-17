import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("the 3D world consumes one shared Kai expression without recoloring authored environments", async () => {
  const canvas = await readFile("src/features/play/WildsWorldCanvas.tsx", "utf8");
  const atmosphere = await readFile("src/features/play/WildsAtmosphere.tsx", "utf8");
  const geometry = await readFile("src/features/play/WildsKaiAtmosphereGeometry.tsx", "utf8");
  assert.match(canvas, /projectKaiWorldExpression/);
  assert.match(canvas, /<WildsAtmosphere[\s\S]*expression=\{kaiExpression\}/);
  assert.match(canvas, /<WildsKaiAtmosphereGeometry/);
  assert.match(atmosphere, /KaiWorldExpression/);
  assert.match(atmosphere, /expression\.sun/);
  assert.match(atmosphere, /expression\.lighting/);
  assert.match(geometry, /Math\.min\(16/);
  assert.doesNotMatch(geometry, /useFrame\([\s\S]{0,300}set[A-Z]/);
  assert.doesNotMatch(canvas, /world\.chapter\.palette\.(?:ground|mid|accent)[\s\S]{0,80}kaiExpression/);
});
