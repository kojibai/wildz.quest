import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";
import * as exactProof from "../src/features/play/wilds-exact-proof-cache";
import * as burrow from "../src/features/play/wilds-burrow";
import * as project from "../src/features/play/wilds-construction-project";
import * as component from "../src/features/play/wilds-construction-component";
import * as coordinate from "../src/lib/receiz/wildz-player-coordinate";
import type { WildsConstructionPersistence } from "../src/features/play/wilds-construction-persistence";

function measuredProjection() {
  const attempts: Array<{ schema: unknown; validator: string }> = [];
  const dependencies: Record<string, unknown> = {
    "./wilds-exact-proof-cache": {
      createWildsExactProofCache() {
        const cache = exactProof.createWildsExactProofCache();
        return { ...cache, guard(validator: (value: unknown) => boolean) {
          const verify = cache.guard(validator as (value: unknown) => value is object);
          return (value: { schema?: unknown }) => {
            attempts.push({ schema: value?.schema, validator: validator.name });
            return verify(value);
          };
        } };
      }
    },
    "./wilds-burrow": burrow,
    "./wilds-construction-project": project,
    "./wilds-construction-component": component,
    "../../lib/receiz/wildz-player-coordinate": coordinate
  };
  const testModule = { exports: {} as {
    projectWildsConstructionPersistence(input: Partial<WildsConstructionPersistence>, owner?: string): WildsConstructionPersistence;
  } };
  const source = ts.transpileModule(readFileSync("src/features/play/wilds-construction-persistence.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  Function("module", "exports", "require", source)(testModule, testModule.exports, (name: string) => {
    if (!(name in dependencies)) throw Error(`Unexpected persistence dependency: ${name}`);
    return dependencies[name];
  });
  return { project: testModule.exports.projectWildsConstructionPersistence, attempts };
}

function fixture() {
  const first = project.createWildsConstructionProject({ ownerReceizId: "owner", name: "Foundation", region: { x: 0, z: 0 }, kaiUPulse: 1 });
  const chunk = project.createWildsConstructionChunk({ project: first, kaiUPulse: 2 });
  const { head, ...basis } = first;
  const successor = project.sealConstructionProof({ ...basis, name: "Expanded foundation", revision: 1, parentHead: head, kaiUPulse: 3 });
  return { first, chunk, successor, input: {
    constructionProjects: { [successor.projectId]: successor },
    constructionChunks: { [chunk.chunkId]: chunk },
    constructionRecoverySources: { [first.head]: first },
    constructionCommandReceipts: {}
  } };
}

test("saved construction ancestry reaches only its applicable full proof validator", () => {
  const measured = measuredProjection(), { input, first, successor, chunk } = fixture();
  const output = measured.project(input, "owner");
  assert.deepEqual(output.constructionProjects, { [successor.projectId]: successor });
  assert.deepEqual(output.constructionChunks, { [chunk.chunkId]: chunk });
  assert.deepEqual(output.constructionRecoverySources, { [first.head]: first });
  const schemas: Record<string, string> = {
    verifyWildsConstructionProject: "wildz.construction-project.v1",
    verifyWildsConstructionChunk: "wildz.construction-chunk.v1",
    verifyWildsConstructionComponent: "wildz.construction-component.v1",
    verifyWildsMaterialContribution: "wildz.construction-material-contribution.v1",
    verifyWildsWorkContribution: "wildz.construction-work-contribution.v1"
  };
  assert.ok(measured.attempts.some(attempt => attempt.validator === "verifyWildsConstructionProject"));
  assert.ok(measured.attempts.some(attempt => attempt.validator === "verifyWildsConstructionChunk"));
  assert.deepEqual(measured.attempts.filter(attempt => attempt.schema !== schemas[attempt.validator]), [], "wrong proof types must be rejected before exact-data cache serialization");
});

test("dispatch retains full verification for matching schemas and changed nested source bytes", () => {
  const measured = measuredProjection(), { input, first, successor } = fixture();
  measured.project(input, "owner");
  const forged = structuredClone(input);
  forged.constructionProjects[successor.projectId] = { ...successor, permissions: { ...successor.permissions, plan: true } };
  forged.constructionRecoverySources[first.head] = { ...first, name: "Forged predecessor" };
  const output = measured.project(forged, "owner");
  assert.deepEqual(output.constructionProjects, {});
  assert.deepEqual(output.constructionChunks, {});
  assert.deepEqual(output.constructionRecoverySources, {});
});

test("dispatch does not admit unsupported schemas or sources under altered identity/head keys", () => {
  const measured = measuredProjection(), { input, first, successor } = fixture();
  const output = measured.project({
    ...input,
    constructionProjects: { "wrong-project-id": successor },
    constructionRecoverySources: {
      "wrong-head": first,
      [successor.head]: { ...successor, schema: "wildz.unsupported-project.v1" } as unknown as typeof successor
    }
  }, "owner");
  assert.deepEqual(output.constructionProjects, {});
  assert.deepEqual(output.constructionRecoverySources, {});
});
