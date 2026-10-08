import assert from "node:assert/strict";
import { test } from "node:test";
import { cloneWildsWorldWorkerInput, encodeWildsWorldWorkerResult, decodeWildsWorldWorkerResult } from "../src/features/play/wilds-world-worker-transfer";
import { initialWildsWorldProjection } from "../src/features/play/wilds-world-state";
import { createWildsConstructionProject, verifyWildsConstructionProject } from "../src/features/play/wilds-construction-project";
import { retainReceivedWildsWorldProofs } from "../src/features/play/wilds-received-proof-immutability";

test("table deltas preserve unchanged evidence, removals, new rows, metadata and changed same-head bytes", () => {
  const first = createWildsConstructionProject({ ownerReceizId: "keeper", name: "First", region: { x: 0, z: 0 }, kaiUPulse: 1 });
  const removed = createWildsConstructionProject({ ownerReceizId: "keeper", name: "Removed", region: { x: 0, z: 0 }, kaiUPulse: 2 });
  const added = createWildsConstructionProject({ ownerReceizId: "keeper", name: "Added", region: { x: 0, z: 0 }, kaiUPulse: 3 });
  const base = retainReceivedWildsWorldProofs({ ...initialWildsWorldProjection(), constructionProjects: { [first.projectId]: first, [removed.projectId]: removed } });
  const work = { kind: "prepare" as const, base, entry: { command: {} } as never };
  const captured = cloneWildsWorldWorkerInput(work);
  const sent = structuredClone(work);
  const projection = { ...sent.base, revision: 1, constructionProjects: { [first.projectId]: sent.base.constructionProjects[first.projectId]!, [added.projectId]: added } };
  const value = { projection, events: ["accepted"], entry: { saved: true }, constitution: { result: "VALID" } };
  const wire = encodeWildsWorldWorkerResult(sent, value);
  assert.equal(JSON.stringify(wire).includes(first.head), false);
  const decoded = decodeWildsWorldWorkerResult(captured, structuredClone(wire)) as typeof value;
  assert.deepEqual(decoded, value);
  assert.equal(decoded.projection.constructionProjects[first.projectId], first);
  assert.equal(decoded.projection.constructionProjects[removed.projectId], undefined);
  const altered = structuredClone(first); Object.assign(altered.permissions, { remove: !altered.permissions.remove });
  const forged = { ...value, projection: { ...projection, constructionProjects: { [first.projectId]: altered } } };
  const received = decodeWildsWorldWorkerResult(captured, structuredClone(encodeWildsWorldWorkerResult(sent, forged))) as typeof forged;
  assert.equal(verifyWildsConstructionProject(received.projection.constructionProjects[first.projectId]), false, "a claimed unchanged head never supplies proof authority");
});

test("mutable caller evidence is captured and malformed or mismatched worker deltas reject", () => {
  const project = createWildsConstructionProject({ ownerReceizId: "keeper", name: "Mutable", region: { x: 0, z: 0 }, kaiUPulse: 1 });
  const work = { kind: "restore" as const, actorId: "keeper", base: { ...initialWildsWorldProjection(), constructionProjects: { [project.projectId]: structuredClone(project) } } };
  const captured = cloneWildsWorldWorkerInput(work);
  Object.assign(work.base.constructionProjects[project.projectId]!.permissions, { remove: !project.permissions.remove });
  assert.ok(verifyWildsConstructionProject(captured.base.constructionProjects[project.projectId]));
  const wire = encodeWildsWorldWorkerResult(captured, { ...captured.base, revision: 1 }) as Record<string, unknown>;
  assert.throws(() => decodeWildsWorldWorkerResult(captured, { ...wire, nested: true }), /delta_invalid/);
  assert.throws(() => decodeWildsWorldWorkerResult(captured, { ...wire, tables: { unauthorized: { patch: {}, removed: [] } } }), /delta_invalid/);
  assert.throws(() => decodeWildsWorldWorkerResult(captured, { ...wire, removed: [null] }), /delta_invalid/);
});
