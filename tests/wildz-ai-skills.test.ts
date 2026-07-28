import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("Wildz AI skills state v114 artifact authority and confirmation law", () => {
  for (const name of ["wildz-builder-skill", "wildz-market-operator-skill", "wildz-release-skill"]) {
    const source = readFileSync(`ai-skills/${name}/SKILL.md`, "utf8");
    assert.match(source, /114\.0\.0/i);
    assert.match(source, /Receiz proof authority/i);
    assert.match(source, /confirmation/i);
    assert.match(source, /ae912154d97b695464c3a19361bceb9440bc5d703a1d9129edac92c64192e29a/i);
    assert.match(source, /fd4ea8fccd867a0b9aab772ea6c5827ea8bdfe4c7fbed017c5a4843a40109c4f/i);
    assert.match(source, /command-only|command admission|ownership\.claimBearerAsset/i);
    assert.match(source, /queued[\s\S]*not (?:a )?global(?:ly)? commit/i);
    assert.doesNotMatch(source, /major 102|major 103|major 105|major 106|107\.0\.0|111\.0\.0|Bearer\s+[A-Za-z0-9_-]{12}/);
  }
});
