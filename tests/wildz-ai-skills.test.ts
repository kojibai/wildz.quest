import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("Wildz AI skills state v111 artifact authority and confirmation law", () => {
  for (const name of ["wildz-builder-skill", "wildz-market-operator-skill", "wildz-release-skill"]) {
    const source = readFileSync(`ai-skills/${name}/SKILL.md`, "utf8");
    assert.match(source, /111\.0\.0/i);
    assert.match(source, /Receiz proof authority/i);
    assert.match(source, /confirmation/i);
    assert.match(source, /cf02d0bce6ad1541cfe84e27bfb1036777b29616bf8a1e5aeafb899a945e359a/i);
    assert.match(source, /command-only|command admission|ownership\.claimBearerAsset/i);
    assert.match(source, /queued[\s\S]*not (?:a )?global(?:ly)? commit/i);
    assert.doesNotMatch(source, /major 102|major 103|major 105|major 106|107\.0\.0|Bearer\s+[A-Za-z0-9_-]{12}/);
  }
});
