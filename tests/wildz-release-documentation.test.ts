import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

test("Wildz current release doctrine names the exact Receiz v124 toolchain", () => {
  const pkg = JSON.parse(read("package.json")) as {
    version?: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const release = read("docs/release/verification.md");
  const mcp = read("docs/MCP.md");
  const currentDoctrine = {
    readme: read("README.md"),
    rails: read("docs/RECEIZ_RAILS.md"),
    releaseSkill: read("ai-skills/wildz-release-skill/SKILL.md"),
    mcp
  };

  assert.equal(pkg.version, "8.0.0");
  assert.equal(pkg.dependencies?.["@receiz/sdk"], "124.0.0");
  assert.equal(pkg.devDependencies?.["@receiz/mcp-server"], "124.0.0");
  assert.equal(pkg.devDependencies?.["@receiz/ai-skills"], "124.0.0");
  for (const [name, source] of Object.entries(currentDoctrine)) {
    for (const packageName of ["@receiz/sdk", "@receiz/mcp-server", "@receiz/ai-skills"]) {
      assert.match(source, new RegExp(`${packageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}@124\\.0\\.0`), name);
    }
    assert.match(source, /d02429151b0bcebdaeb89485792e377afc55130f9a25e07982c1c88221314247/i, name);
    assert.match(source, /540d1c1bf39f1b288b257c79a6e020bdcc5e587fc9b7dbf6b7aaa5d082e20ad5/i, name);
    assert.doesNotMatch(source, /@receiz\/(?:sdk|mcp-server|ai-skills)@122\.0\.0/i, name);
  }
  assert.match(mcp, /@receiz\/sdk@124\.0\.0/);
  assert.match(mcp, /@receiz\/mcp-server@124\.0\.0/);
  assert.match(mcp, /@receiz\/ai-skills@124\.0\.0/);
  assert.match(currentDoctrine.readme, /public npm/i);
  assert.match(currentDoctrine.readme, /published (?:SHA-512 )?integrity/i);
  assert.match(currentDoctrine.releaseSkill, /first admission only, then append forever/i);
  assert.match(currentDoctrine.rails, /v121[\s\S]*(?:living subject|proof brain|Merkle|bearer)/i);
  assert.match(release, /local v121 living-subject Twin/i);
  assert.match(release, /optional performance enrichment/i);
  assert.match(release, /never replace or delay/);
  assert.match(release, /proof object remains authority/i);
});

test("v8 documents the complete Proof-Native Living World delta", () => {
  const release = read("docs/release/v8.0.0.md");
  const changelog = read("CHANGELOG.md");

  assert.match(release, /^# Wildz v8\.0\.0 — Proof-Native Living World$/m);
  assert.match(release, /Proof Object is authority/i);
  assert.match(release, /server.*(?:transport|projection)/i);
  assert.match(release, /(?:uploading one creature card|single-card import)/i);
  assert.match(release, /complete identity and game-state restoration/i);
  assert.match(release, /immediate gameplay after admission/i);
  assert.match(release, /genome-derived anatomy/i);
  for (const commit of [
    "da3fb96",
    "2d21be2",
    "4f490c1",
    "0b59f6a",
    "a6630a6",
    "e95ecfb",
    "95e2958",
    "5b42131",
    "c2351a0",
    "989829e",
    "be6ab53"
  ]) {
    assert.match(release, new RegExp("\\| `" + commit + "` \\|"));
  }
  assert.match(changelog, /^## \[8\.0\.0\] - 2026-08-20$/m);
  assert.match(changelog, /complete v8\.0\.0 release notes/i);
});

test("release documentation states the real offline and remote authority boundaries", () => {
  const release = read("docs/release/v6.1.0.md");
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

test("v6.1 documents the Receiz-native voice rail, unchanged proof memory, and rejected reasoning", () => {
  const release = read("docs/release/v6.1.0.md");
  const voice = read("docs/RECEIZ_V120_CREATURE_VOICE.md");
  const postmortem = read("docs/release/v6.1.0-reasoning-postmortem.md");
  const builder = read("ai-skills/wildz-builder-skill/SKILL.md");
  const releaseSkill = read("ai-skills/wildz-release-skill/SKILL.md");
  const combined = [release, voice, postmortem, builder, releaseSkill].join("\n");

  assert.match(combined, /subjects\.twin\.streamPerformance/);
  assert.match(combined, /contextHead/);
  assert.match(combined, /expected subject digest/i);
  assert.match(combined, /proof object remains authority/i);
  assert.match(combined, /server (?:remains|is).*?(?:transport|observer)/i);
  assert.match(combined, /voice.*never.*(?:gate|block).*proof memory/is);
  assert.match(combined, /since v6\.0\.0/i);
  assert.match(postmortem, /implementation reasoning deviated/i);
  assert.match(postmortem, /provider-specific infrastructure/i);
  assert.match(postmortem, /latency language got ahead of evidence/i);
  assert.doesNotMatch(voice, /RECEIZ_CREATURE_VOICE_API_KEY=/);
});

test("Receiz-first reasoning is a mandatory repository and CI gate", () => {
  const law = read("docs/RECEIZ_FIRST_ENGINEERING.md");
  const gapTemplate = read("docs/receiz-decisions/TEMPLATE.md");
  const contributing = read("CONTRIBUTING.md");
  const pullRequest = read(".github/PULL_REQUEST_TEMPLATE.md");
  const releaseCheck = read("scripts/release-check.mjs");
  const architectureLock = read("scripts/receiz-architecture-lock.mjs");
  const pkg = JSON.parse(read("package.json")) as { scripts?: Record<string, string> };
  const combined = [law, gapTemplate, contributing, pullRequest].join("\n");

  assert.match(combined, /SDK[\s\S]*first[\s\S]*MCP[\s\S]*(?:second|inventory)[\s\S]*AI[- ]skills?/i);
  assert.match(law, /Custom infrastructure[\s\S]*(?:only|blocked)[\s\S]*capability gap/i);
  assert.match(gapTemplate, /SDK inventory performed first/i);
  assert.match(gapTemplate, /MCP inventory performed second/i);
  assert.match(gapTemplate, /AI-skill doctrine performed third/i);
  assert.match(pullRequest, /Receiz-first reasoning record/i);
  assert.equal(pkg.scripts?.["receiz:architecture-lock"], "node scripts/receiz-architecture-lock.mjs");
  assert.match(releaseCheck, /receiz:architecture-lock/);
  assert.match(architectureLock, /forbidden_voice_runtime/);
  assert.match(architectureLock, /tooling_imported_into_runtime/);
  assert.match(architectureLock, /voice_precedes_or_gates_proof_memory_append/);
  const result = spawnSync(process.execPath, ["scripts/receiz-architecture-lock.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8"
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

test("release doctrine contains no private artifact paths or assigned credentials", () => {
  const paths = [
    "docs/release/v6.1.0.md",
    "docs/RECEIZ_V120_CREATURE_VOICE.md",
    "docs/release/v6.1.0-reasoning-postmortem.md",
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
