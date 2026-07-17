import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

test("Wildz v3 release doctrine names the exact Receiz v106 toolchain", () => {
  const pkg = JSON.parse(read("package.json")) as {
    version?: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const release = read("docs/release/v3.0.0.md");
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

  assert.equal(pkg.version, "3.0.0");
  assert.equal(pkg.dependencies?.["@receiz/sdk"], "106.0.0");
  assert.equal(pkg.devDependencies?.["@receiz/mcp-server"], "106.0.0");
  assert.equal(pkg.devDependencies?.["@receiz/ai-skills"], "106.0.0");
  for (const version of ["@receiz/sdk 106.0.0", "@receiz/mcp-server 106.0.0", "@receiz/ai-skills 106.0.0"]) {
    assert.match(release, new RegExp(version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(mcp, /@receiz\/sdk@106\.0\.0/);
  assert.match(mcp, /@receiz\/mcp-server@106\.0\.0/);
  assert.match(mcp, /@receiz\/ai-skills@106\.0\.0/);
  assert.match(packageSourceDocs, /official npm registry/i);
  assert.doesNotMatch(packageSourceDocs, /vendored|vendoring|until registry publication|vendor\//i);
});

test("release documentation states the real offline and remote authority boundaries", () => {
  const release = read("docs/release/v3.0.0.md");
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
  assert.doesNotMatch(combined, /process-local listing|Kai Pulse character genesis/i);
});

test("release doctrine contains no private artifact paths or assigned credentials", () => {
  const paths = [
    "docs/release/v3.0.0.md",
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
