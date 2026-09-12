/** Run after pnpm test. Synthetic proof data only; never reads a player's save. */
import { performance } from "node:perf_hooks";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const compiled = resolve(process.argv[2] ?? ".test-build", "src/features/play");
const load = (name) => import(pathToFileURL(resolve(compiled, `${name}.js`)).href);
const { initialWildsWorldProjection } = await load("wilds-world-state");
const { createWildsConstructionProject, constructionProofDigest } = await load("wilds-construction-project");
const { mergeWildsOwnedWorldAdditions, projectWildsOwnedWorldAdditions } = await load("wilds-player-world-additions");
const { preserveWildsConstructionHistory } = await load("wilds-world-outbox");
const owner = "synthetic-performance-explorer";
const world = initialWildsWorldProjection();
for (let i = 0; i < 100; i++) {
  const project = createWildsConstructionProject({ ownerReceizId: owner, name: `Build ${i}`, region: { x: i, z: 0 }, kaiUPulse: i + 1 });
  world.constructionProjects[project.projectId] = project;
  const basis = { schema: "wildz.material-lot.v1", lotId: `wildz:material:stone:${i.toString(16).padStart(64, "0")}`, kind: "stone",
    quantity: 1, quality: 1, ownerReceizId: owner, source: { sourceId: `source:synthetic:${i}`, sourceHead: `sha256:${"a".repeat(64)}`,
      admittedSourceHead: `sha256:${"b".repeat(64)}`, kaiUPulse: i + 1 }, contributors: { explorerReceizId: owner }, authority: "source-proof-object" };
  world.materialLots[basis.lotId] = { ...basis, head: constructionProofDigest(basis) };
}
const owned = projectWildsOwnedWorldAdditions(world, owner);
if (Object.keys(owned.materialLots).length !== 100 || Object.keys(owned.constructionProjects).length !== 100) throw new Error("Synthetic proofs were not admitted");
const candidate = structuredClone(world); // Same worker-response shape; cloning excluded from the CPU stage measurement.
const cases = {
  merge: () => mergeWildsOwnedWorldAdditions(candidate, owned),
  preserve: () => preserveWildsConstructionHistory(world, candidate),
  project: () => projectWildsOwnedWorldAdditions(candidate, owner)
};
const result = { scenario: "100 projects and 100 material lots, unchanged worker snapshot", unit: "ms", stages: {} };
for (const [name, run] of Object.entries(cases)) {
  for (let i = 0; i < 5; i++) run();
  const samples = [];
  for (let i = 0; i < 30; i++) { const start = performance.now(); run(); samples.push(performance.now() - start); }
  samples.sort((a, b) => a - b);
  result.stages[name] = { median: samples[15], p95: samples[28], worst: samples[29] };
}
console.log(JSON.stringify(result, null, 2));
