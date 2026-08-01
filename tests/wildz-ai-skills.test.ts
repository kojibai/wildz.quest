import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("Wildz AI skills state v118 artifact authority and confirmation law", () => {
  for (const name of ["wildz-builder-skill", "wildz-market-operator-skill", "wildz-release-skill"]) {
    const source = readFileSync(`ai-skills/${name}/SKILL.md`, "utf8");
    assert.match(source, /118\.0\.0/i);
    assert.match(source, /Receiz proof authority/i);
    assert.match(source, /confirmation/i);
    assert.match(source, /c284bd39a891c1a828b532523bd548507570819c32e307d79b8043f06d2d3360/i);
    assert.match(source, /153b2472830567ec3b445c2c1b4102e4c036ed4c45cc374d40d0079096a40f54/i);
    assert.match(source, /command-only|command admission|ownership\.claimBearerAsset/i);
    assert.match(source, /queued[\s\S]*not (?:a )?global(?:ly)? commit/i);
    assert.match(source, /first admission only, then append forever/i);
    assert.match(source, /v119[\s\S]*not shipped/i);
    assert.doesNotMatch(source, /major 102|major 103|major 105|major 106|107\.0\.0|111\.0\.0|Bearer\s+[A-Za-z0-9_-]{12}/);
  }
});
