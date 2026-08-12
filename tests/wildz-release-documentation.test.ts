import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

test("Wildz competitive alpha release doctrine names the exact Receiz v118 toolchain", () => {
  const pkg = JSON.parse(read("package.json")) as {
    version?: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const release = read("docs/release/v4.0.0-alpha.1.md");
  const mcp = read("docs/MCP.md");
  const packageSourceDocs = [
    read("README.md"),
    mcp,
    read("docs/RECEIZ_RAILS.md"),
    read("docs/release/verification.md"),
    release,
    read("ai-skills/README.md"),
    read("ai-skills/wildz-release-skill/SKILL.md")
  ].join("\n");

  assert.equal(pkg.version, "4.0.0-alpha.1");
  assert.equal(pkg.dependencies?.["@receiz/sdk"], "118.0.0");
  assert.equal(pkg.devDependencies?.["@receiz/mcp-server"], "118.0.0");
  assert.equal(pkg.devDependencies?.["@receiz/ai-skills"], "118.0.0");
  for (const version of ["@receiz/sdk 118.0.0", "@receiz/mcp-server 118.0.0", "@receiz/ai-skills 118.0.0"]) {
    assert.match(release, new RegExp(version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(mcp, /@receiz\/sdk@118\.0\.0/);
  assert.match(mcp, /@receiz\/mcp-server@118\.0\.0/);
  assert.match(mcp, /@receiz\/ai-skills@118\.0\.0/);
  assert.match(packageSourceDocs, /public npm/i);
  assert.match(packageSourceDocs, /published (?:SHA-512 )?integrity/i);
  assert.match(packageSourceDocs, /c284bd39a891c1a828b532523bd548507570819c32e307d79b8043f06d2d3360/i);
  assert.match(packageSourceDocs, /153b2472830567ec3b445c2c1b4102e4c036ed4c45cc374d40d0079096a40f54/i);
  assert.match(packageSourceDocs, /first admission only, then append forever/i);
  assert.match(packageSourceDocs, /v119[\s\S]*not shipped/i);
});

test("release documentation states the real offline and remote authority boundaries", () => {
  const release = read("docs/release/v4.0.0-alpha.1.md");
  const verification = read("docs/release/verification.md");
  const interoperability = read("docs/release/artifact-interoperability.md");
  const rails = read("docs/RECEIZ_RAILS.md");
  const combined = [release, verification, interoperability, rails].join("\n");

  assert.match(release, /previously visited public profiles/i);
  assert.match(release, /previously visited public cards/i);
  assert.match(release, /sign-in.*live world.*market.*connection/is);
  assert.match(release, /no external database/i);
  assert.match(interoperability, /byte-identical/i);
  assert.match(interoperability, /owner.*claim.*verify path/is);
  assert.match(interoperability, /legacy.*namespace.*prior-head/is);
  assert.match(rails, /fail(?:s|ed)? closed/i);
  assert.match(combined, /queued[\s\S]*not (?:a )?global(?:ly)? commit/i);
  assert.doesNotMatch(combined, /process-local listing|Kai Pulse character genesis/i);
});

test("release doctrine contains no private artifact paths or assigned credentials", () => {
  const paths = [
    "docs/release/v4.0.0-alpha.1.md",
    "docs/release/verification.md",
    "docs/release/feature-parity.md",
    "docs/release/artifact-interoperability.md",
    "docs/RECEIZ_RAILS.md",
    "docs/MCP.md"
  ];
  const combined = paths.map(read).join("\n");

  assert.doesNotMatch(combined, /\/Users\/|wilds-vault-[a-f0-9]+\.receized\.png/i);
  assert.doesNotMatch(combined, /(?:RECEIZ_ACCESS_TOKEN|RECEIZ_CLIENT_SECRET|RECEIZ_OAUTH_STATE_SECRET)\s*=\s*[^<\s]/);
  assert.doesNotMatch(combined, /"schema"\s*:\s*"receiz\.key\.v1"/);
});

test("competitive release doctrine defines proof, replay, operator, and temporal boundaries", () => {
  const paths = [
    "docs/ARCHITECTURE.md",
    "docs/MCP.md",
    "docs/RECEIZ_RAILS.md",
    "docs/release/competitive-integrity.md"
  ];
  const combined = paths.map(read).join("\n");

  assert.match(combined, /Kai Klok[\s\S]*primary temporal root/i);
  assert.match(combined, /uPulse[\s\S]*safe integer/i);
  assert.match(combined, /ISO[\s\S]*(?:descriptive|display)[\s\S]*never[\s\S]*(?:order|authority)/i);
  assert.match(combined, /creature history[\s\S]*(?:parent|causal)[\s\S]*(?:projection|digest)/i);
  assert.match(combined, /base proof[\s\S]*(?:unchanged|byte-identical|never rewrite)/i);
  assert.match(combined, /Arena[\s\S]*replay[\s\S]*(?:admission|envelope)[\s\S]*audit/i);
  assert.match(combined, /tournament[\s\S]*(?:health|season)/i);
  assert.match(combined, /coaching[\s\S]*(?:simulation|recommendation)[\s\S]*(?:not|never)[\s\S]*authority/i);
  assert.match(combined, /MCP[\s\S]*(?:read-only|read only)[\s\S]*audit/i);
  assert.match(combined, /explicit[\s-]*confirmation[\s\S]*(?:publication|release|deploy)/i);
  assert.match(combined, /(?:AI|agent)[\s\S]*(?:never|cannot)[\s\S]*(?:sign|admit)/i);
});

test("gameplay scorecard grades the alpha against a world-class absolute bar without inventing evidence", () => {
  const scorecard = read("docs/release/gameplay-scorecard.md");

  assert.match(scorecard, /world-class[\s\S]*(?:absolute|10\/10)/i);
  assert.match(scorecard, /competitive mastery/i);
  assert.match(scorecard, /deterministic replay/i);
  assert.match(scorecard, /portable creature continuity/i);
  assert.match(scorecard, /accessibility/i);
  assert.match(scorecard, /performance/i);
  assert.match(scorecard, /live operations/i);
  assert.match(scorecard, /not (?:yet )?(?:verified|proven)|pending evidence/i);
  assert.match(scorecard, /gap[\s-]*closure/i);
  assert.doesNotMatch(scorecard, /(?:is|certified as|proven to be) the best game/i);
});
