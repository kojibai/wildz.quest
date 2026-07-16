import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

describe("Wildz dynamic particle geometry", () => {
  it("remounts every dynamically counted Drei Sparkles system when its count changes", async () => {
    const world = await readFile("src/features/play/WildsWorldCanvas.tsx", "utf8");
    const atlas = await readFile("src/features/play/WildsAtlasCanvas.tsx", "utf8");

    assert.equal(world.match(/<Sparkles\b/g)?.length, 2);
    assert.match(world, /const worldSparkleCount = Math\.round\(54 \* qualityProfile\.particles\);/);
    assert.match(
      world,
      /<Sparkles\s+key=\{`wilds-world-sparkles-\$\{worldSparkleCount\}`\}\s+count=\{worldSparkleCount\}/
    );
    assert.match(world, /const clueSparkleCount = hot \? 18 : 9;/);
    assert.match(
      world,
      /<Sparkles\s+key=\{`wilds-clue-sparkles-\$\{clueSparkleCount\}`\}\s+count=\{clueSparkleCount\}/
    );

    assert.equal(atlas.match(/<Sparkles\b/g)?.length, 1);
    assert.match(atlas, /const atlasSparkleCount = reducedMotion \? 12 : Math\.round\(38 \* qualityProfile\.particles\);/);
    assert.match(
      atlas,
      /<Sparkles\s+key=\{`wilds-atlas-sparkles-\$\{atlasSparkleCount\}`\}\s+count=\{atlasSparkleCount\}/
    );
  });
});
