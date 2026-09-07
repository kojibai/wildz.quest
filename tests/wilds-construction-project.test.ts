import assert from "node:assert/strict";
import { it } from "node:test";
import { createWildsConstructionProject, verifyWildsConstructionProject, createWildsConstructionChunk, appendWildsConstructionChunkReference, appendWildsConstructionProjectChunk, verifyWildsConstructionChunk, canWildsConstructionProject } from "../src/features/play/wilds-construction-project";

it("seals owner-safe projects and rejects policy tampering", () => {
  const project = createWildsConstructionProject({ ownerReceizId: "owner", name: "Meadow", region: { x: 0, z: 0 }, kaiUPulse: 1, access: "public", permissions: { plan: false, contribute: true, work: true, renovate: false, remove: false } });
  assert.equal(verifyWildsConstructionProject(project), true);
  assert.equal(canWildsConstructionProject(project, "owner", "remove"), true);
  assert.equal(canWildsConstructionProject(project, "guest", "plan"), false);
  assert.equal(canWildsConstructionProject(project, "guest", "work"), true);
  assert.equal(verifyWildsConstructionProject({ ...project, name: "Changed" }), false);
  const invited = createWildsConstructionProject({ ownerReceizId: "owner", name: "Meadow", region: { x: 0, z: 0 }, kaiUPulse: 1, access: "invited" });
  assert.equal(canWildsConstructionProject(invited, "guest", "work"), false);
});

it("automatically links a 65th reference without growing the project", () => {
  const project = createWildsConstructionProject({ ownerReceizId: "owner", name: "Meadow", region: { x: 0, z: 0 }, kaiUPulse: 1 });
  let chunk = createWildsConstructionChunk({ project, kaiUPulse: 2 });
  const successor = appendWildsConstructionProjectChunk({ project, chunk, kaiUPulse: 2 });
  assert.equal(successor.firstChunkId, chunk.chunkId);
  assert.equal(successor.parentHead, project.head);
  for (let index = 0; index < 64; index++) {
    chunk = appendWildsConstructionChunkReference({ chunk, component: { componentId: `component:${index.toString().padStart(3, "0")}`, head: `sha256:${"a".repeat(64)}`, projectId: project.projectId, region: project.region }, kaiUPulse: index + 3 }).chunk;
  }
  const result = appendWildsConstructionChunkReference({ chunk, component: { componentId: "component:065", head: `sha256:${"b".repeat(64)}`, projectId: project.projectId, region: project.region }, kaiUPulse: 70 });
  assert.equal(result.chunk.references.length, 64);
  assert.equal(result.chunk.nextChunkId, result.continuation?.chunkId);
  assert.equal(result.continuation?.references.length, 1);
  assert.equal(verifyWildsConstructionChunk(result.chunk), true);
  assert.equal(verifyWildsConstructionChunk(result.continuation), true);
  assert.equal(verifyWildsConstructionChunk({ ...chunk, references: [...chunk.references, chunk.references[0]] }), false);
  assert.throws(() => appendWildsConstructionChunkReference({ chunk, component: { componentId: "bad", head: `sha256:${"b".repeat(64)}`, projectId: project.projectId, region: { x: 1, z: 0 } }, kaiUPulse: 70 }));
});

it("rejects re-sealed project identity and root-page rebinding", async () => {
  const { canonicalPortableCardJson, sha256PortableBasis } = await import("../src/features/play/portable-card");
  const project = createWildsConstructionProject({ ownerReceizId: "owner", name: "Meadow", region: { x: 0, z: 0 }, kaiUPulse: 1 });
  const reseal = (patch: object) => {
    const { head: _, ...basis } = { ...project, ...patch };
    return { ...basis, head: sha256PortableBasis(canonicalPortableCardJson(basis)) };
  };
  assert.equal(verifyWildsConstructionProject(reseal({ ownerReceizId: "intruder" })), false);
  assert.equal(verifyWildsConstructionProject(reseal({ firstChunkId: "unrelated:chunk" })), false);
});
