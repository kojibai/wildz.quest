import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("Wildz AI skills state exact release authority and confirmation law", () => {
  for (const name of ["wildz-builder-skill", "wildz-market-operator-skill", "wildz-release-skill"]) {
    const source = readFileSync(`ai-skills/${name}/SKILL.md`, "utf8");
    assert.match(source, /Receiz proof authority/i);
    assert.match(source, /confirmation/i);
    assert.match(source, /command-only|command admission|ownership\.claimBearerAsset/i);
    assert.match(source, /queued[\s\S]*not (?:a )?global(?:ly)? commit/i);
    assert.match(source, /first admission only, then append forever/i);
    assert.doesNotMatch(source, /major 102|major 103|major 105|major 106|107\.0\.0|111\.0\.0|Bearer\s+[A-Za-z0-9_-]{12}/);
  }

  for (const name of ["wildz-builder-skill", "wildz-market-operator-skill"]) {
    const source = readFileSync(`ai-skills/${name}/SKILL.md`, "utf8");
    assert.match(source, /122\.0\.0/i);
    assert.match(source, /ed65956a16dd5f0d76d04db2f4a651fc43eb0a71cef64afd53576aa782dc9896/i);
    assert.match(source, /bd1d7ccf1543e2484df68e3025c7376f8ae37cafe1ca0d7c9cd9f52f6342b325/i);
    assert.match(source, /v122[\s\S]*(?:enclosing artifact|known truth|Merkle|Fibonacci)/i);
  }

  const release = readFileSync("ai-skills/wildz-release-skill/SKILL.md", "utf8");
  assert.match(release, /124\.0\.0/i);
  assert.match(release, /d02429151b0bcebdaeb89485792e377afc55130f9a25e07982c1c88221314247/i);
  assert.match(release, /540d1c1bf39f1b288b257c79a6e020bdcc5e587fc9b7dbf6b7aaa5d082e20ad5/i);
  assert.match(release, /53 v124 application operations/i);
  assert.match(release, /v124[\s\S]*(?:enclosing artifact|known truth|Merkle|Fibonacci)/i);
  assert.doesNotMatch(release, /123\.0\.0|945a581d|e08cec3e/i);
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
