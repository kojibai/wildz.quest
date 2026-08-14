import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("Wildz AI skills state v119 artifact authority and confirmation law", () => {
  for (const name of ["wildz-builder-skill", "wildz-market-operator-skill", "wildz-release-skill"]) {
    const source = readFileSync(`ai-skills/${name}/SKILL.md`, "utf8");
    assert.match(source, /119\.0\.0/i);
    assert.match(source, /Receiz proof authority/i);
    assert.match(source, /confirmation/i);
    assert.match(source, /49c167a437ec7c0e486412dd62c54af4abdf94eda1ebc18d263a027d105cecd9/i);
    assert.match(source, /53cf9d6862b2396e2fe7864f8607c00c4e3b6e31b082ab5c5c8dff088fcb52c1/i);
    assert.match(source, /command-only|command admission|ownership\.claimBearerAsset/i);
    assert.match(source, /queued[\s\S]*not (?:a )?global(?:ly)? commit/i);
    assert.match(source, /first admission only, then append forever/i);
    assert.match(source, /v119[\s\S]*(?:enclosing artifact|known truth|Merkle|Fibonacci)/i);
    assert.doesNotMatch(source, /major 102|major 103|major 105|major 106|107\.0\.0|111\.0\.0|Bearer\s+[A-Za-z0-9_-]{12}/);
  }
});

test("the builder skill teaches Kai-rooted competitive and creature-history authority", () => {
  const source = readFileSync("ai-skills/wildz-builder-skill/SKILL.md", "utf8");
  assert.match(source, /Kai Klok[\s\S]*primary temporal root/i);
  assert.match(source, /uPulse[\s\S]*safe integer/i);
  assert.match(source, /ISO[\s\S]*(display|descriptive)[\s\S]*never[\s\S]*(order|authority)/i);
  assert.match(source, /causal descendant[\s\S]*(divergent|sibling)[\s\S]*uPulse/i);
  assert.match(source, /same[^\n]*uPulse[\s\S]*fail closed/i);
  assert.match(source, /Ranked[\s\S]*(signed|verified)[\s\S]*(admission|envelope)/i);
  assert.match(source, /Mortal[\s\S]*(verified|signed)[\s\S]*covenant/i);
});

test("the release skill audits competitive integrity without becoming authority", () => {
  const source = readFileSync("ai-skills/wildz-release-skill/SKILL.md", "utf8");

  assert.match(source, /Kai Klok[\s\S]*primary temporal root/i);
  assert.match(source, /uPulse[\s\S]*safe integer/i);
  assert.match(source, /creature history[\s\S]*(parent|causal)[\s\S]*(projection|digest)/i);
  assert.match(source, /Arena[\s\S]*replay[\s\S]*(admission|envelope)[\s\S]*audit/i);
  assert.match(source, /tournament[\s\S]*(health|season)/i);
  assert.match(source, /balance[\s\S]*coaching[\s\S]*(simulation|recommendation)/i);
  assert.match(source, /(?:AI|agent)[\s\S]*(?:never|cannot)[\s\S]*(?:sign|admit)/i);
  assert.match(source, /explicit[\s-]*confirmation[\s\S]*(publication|release|deploy)/i);
  assert.match(source, /MCP[\s\S]*(read-only|read only)[\s\S]*audit/i);
});
