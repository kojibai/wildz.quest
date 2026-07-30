import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("Wildz AI skills state v116 artifact authority and confirmation law", () => {
  for (const name of ["wildz-builder-skill", "wildz-market-operator-skill", "wildz-release-skill"]) {
    const source = readFileSync(`ai-skills/${name}/SKILL.md`, "utf8");
    assert.match(source, /116\.0\.0/i);
    assert.match(source, /Receiz proof authority/i);
    assert.match(source, /confirmation/i);
    assert.match(source, /9bf61fcf4541edf565bb2ded252e35a976a3ca7c9176dea0f1ffac74ce192a80/i);
    assert.match(source, /ec5829eeec039c1f4885d056b8cd6cf6506d08547cee58daa229ecbd44155420/i);
    assert.match(source, /command-only|command admission|ownership\.claimBearerAsset/i);
    assert.match(source, /queued[\s\S]*not (?:a )?global(?:ly)? commit/i);
    assert.doesNotMatch(source, /major 102|major 103|major 105|major 106|107\.0\.0|111\.0\.0|Bearer\s+[A-Za-z0-9_-]{12}/);
  }
});
