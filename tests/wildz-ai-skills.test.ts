import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("Wildz AI skills state v106 constitutional authority and confirmation law", () => {
  for (const name of ["wildz-builder-skill", "wildz-market-operator-skill", "wildz-release-skill"]) {
    const source = readFileSync(`ai-skills/${name}/SKILL.md`, "utf8");
    assert.match(source, /major 106|106\.0\.0/i);
    assert.match(source, /Receiz proof authority/i);
    assert.match(source, /confirmation/i);
    assert.match(source, /bf851c209e807309672c0f466411baa5607ce6b3195fe4eb16755edfeb7f5a1a/i);
    assert.match(source, /command-only|command admission/i);
    assert.doesNotMatch(source, /major 102|major 103|major 105|Bearer\s+[A-Za-z0-9_-]{12}/);
  }
});
