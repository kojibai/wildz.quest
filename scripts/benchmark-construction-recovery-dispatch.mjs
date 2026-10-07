/** Synthetic CPU probe; does not read player saves or measure browser FPS.
 * Run after a test compilation. Both versions use the same fixture/dependencies. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const compiled = resolve(process.argv[2] ?? ".test-build");
const baselineRef = process.argv[3] ?? "e2f659f";
const projectCount = Number(process.argv[4] ?? 100), revisions = Number(process.argv[5] ?? 10);
if (!Number.isSafeInteger(projectCount) || projectCount < 1 || projectCount > 1000
  || !Number.isSafeInteger(revisions) || revisions < 1 || revisions > 100) throw Error("fixture_size_invalid");
const load = path => import(pathToFileURL(resolve(compiled, path)).href);
const [exact, burrow, project, component, coordinate] = await Promise.all([
  "src/features/play/wilds-exact-proof-cache.js", "src/features/play/wilds-burrow.js",
  "src/features/play/wilds-construction-project.js", "src/features/play/wilds-construction-component.js",
  "src/lib/receiz/wildz-player-coordinate.js"
].map(load));
const file = "src/features/play/wilds-construction-persistence.ts";
const baselineSource = execFileSync("git", ["show", `${baselineRef}:${file}`], { encoding: "utf8" });
const currentSource = readFileSync(file, "utf8");
const fixture = { constructionProjects: {}, constructionRecoverySources: {}, constructionCommandReceipts: {} };
for (let index = 0; index < projectCount; index++) {
  let current = project.createWildsConstructionProject({ ownerReceizId: "latency.fixture", name: `Build ${index}`, region: { x: index, z: 0 }, kaiUPulse: 1 });
  for (let revision = 1; revision <= revisions; revision++) {
    fixture.constructionRecoverySources[current.head] = current;
    const { head, ...basis } = current;
    current = project.sealConstructionProof({ ...basis, name: `Build ${index} revision ${revision}`, revision, parentHead: head, kaiUPulse: revision + 1 });
  }
  fixture.constructionProjects[current.projectId] = current;
}

function measuredModule(input) {
  let attempts = 0, verifications = 0;
  const dependencies = {
    "./wilds-exact-proof-cache": { createWildsExactProofCache(...args) {
      const cache = exact.createWildsExactProofCache(...args);
      return { ...cache, guard(validator) {
        const measured = value => { verifications++; return validator(value); };
        return value => { attempts++; return cache.verify(value, measured); };
      } };
    } },
    "./wilds-burrow": burrow, "./wilds-construction-project": project,
    "./wilds-construction-component": component, "../../lib/receiz/wildz-player-coordinate": coordinate
  };
  const loaded = { exports: {} };
  const source = ts.transpileModule(input, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  Function("module", "exports", "require", source)(loaded, loaded.exports, name => {
    if (!(name in dependencies)) throw Error(`Unexpected construction dependency: ${name}`);
    return dependencies[name];
  });
  return {
    run(input) { return loaded.exports.projectWildsConstructionPersistence(input, "latency.fixture"); },
    counters() { return { exactCacheChecks: attempts, fullVerifierExecutions: verifications }; },
    reset() { attempts = 0; verifications = 0; }
  };
}
const before = measuredModule(baselineSource), after = measuredModule(currentSource);
const results = {}, samples = { before: [], after: [] };
for (const [name, measured] of [["before", before], ["after", after]]) {
  const input = structuredClone(fixture), start = performance.now();
  const output = measured.run(input), coldMs = performance.now() - start;
  results[name] = { coldMs, cold: measured.counters() };
  results[name].output = JSON.stringify(output);
  measured.reset();
}
assert.equal(results.before.output, results.after.output, "every projected source/history field must remain identical");
for (let iteration = 0; iteration < 15; iteration++) {
  const input = structuredClone(fixture);
  for (const [name, measured] of iteration % 2 ? [["after", after], ["before", before]] : [["before", before], ["after", after]]) {
    const start = performance.now(), output = measured.run(input);
    samples[name].push(performance.now() - start);
    assert.equal(JSON.stringify(output), results.before.output);
  }
}
for (const [name, measured] of [["before", before], ["after", after]]) {
  samples[name].sort((a, b) => a - b);
  const counts = measured.counters();
  results[name] = { coldMs: results[name].coldMs, cold: results[name].cold,
    warmMedianMs: samples[name][7], warmP95Ms: samples[name][14],
    warmChecksPerProjection: counts.exactCacheChecks / 15, warmVerificationsPerProjection: counts.fullVerifierExecutions / 15 };
}
console.log(JSON.stringify({ kind: "synthetic CPU stage, not browser FPS or account startup", baselineRef,
  fixture: { projects: projectCount, ancestorRecords: projectCount * revisions, bytes: Buffer.byteLength(JSON.stringify(fixture)) },
  cloneAndFixtureGenerationExcluded: true, equivalentOutputs: true, samplesPerVersion: 15, results }, null, 2));
