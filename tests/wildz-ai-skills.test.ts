import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("Wildz AI skills state v108 artifact authority and confirmation law", () => {
  for (const name of ["wildz-builder-skill", "wildz-market-operator-skill", "wildz-release-skill"]) {
    const source = readFileSync(`ai-skills/${name}/SKILL.md`, "utf8");
    assert.match(source, /108\.0\.0/i);
    assert.match(source, /Receiz proof authority/i);
    assert.match(source, /confirmation/i);
    assert.match(source, /126ca9283fee4ef4c398dbcb958e861cbea191724fdab8eb08df55ff0c14bb79/i);
    assert.match(source, /command-only|command admission|ownership\.claimBearerAsset/i);
    assert.match(source, /queued[\s\S]*not (?:a )?global(?:ly)? commit/i);
    assert.doesNotMatch(source, /major 102|major 103|major 105|major 106|107\.0\.0|Bearer\s+[A-Za-z0-9_-]{12}/);
  }
});
