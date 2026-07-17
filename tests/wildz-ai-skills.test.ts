import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("Wildz AI skills state v107 constitutional authority and confirmation law", () => {
  for (const name of ["wildz-builder-skill", "wildz-market-operator-skill", "wildz-release-skill"]) {
    const source = readFileSync(`ai-skills/${name}/SKILL.md`, "utf8");
    assert.match(source, /major 107|107\.0\.0/i);
    assert.match(source, /Receiz proof authority/i);
    assert.match(source, /confirmation/i);
    assert.match(source, /4d0caa6172a69c3bf5817c1c35db5630e555b5d6d824091d45a90fb426b86ef6/i);
    assert.match(source, /command-only|command admission/i);
    assert.match(source, /queued[\s\S]*not (?:a )?global(?:ly)? commit/i);
    assert.doesNotMatch(source, /major 102|major 103|major 105|major 106|Bearer\s+[A-Za-z0-9_-]{12}/);
  }
});
