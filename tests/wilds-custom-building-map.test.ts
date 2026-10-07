import assert from "node:assert/strict";
import { test } from "node:test";
import { projectWildsCustomBuildingMap } from "../src/features/play/wilds-custom-building-map";
import { createCreationDefinition } from "../src/features/play/creation/definition";
import { createCreationInstance, sealCreationInstance, type CreationInstance } from "../src/features/play/creation/instance";
import { initializeCreationComponents } from "../src/features/play/creation/components";
import { constructionProofDigest } from "../src/features/play/wilds-construction-project";
import type { WildsCreationSourceRecord } from "../src/features/play/creation/world-source";

function creationSource(overrides: { seed?: string; stage?: CreationInstance["stage"]; spaceId?: string } = {}): WildsCreationSourceRecord {
  const definition = createCreationDefinition({
    schema: "wildz.creation-definition.v1", grammarVersion: 1, creatorId: "builder", seed: overrides.seed ?? "local:creation:request:5b1d088e-92b1-4c92-8a04-e5a04740b1ca", assets: [],
    nodes: [{ id: "room", parentId: null, pose: { position: { x: 0, y: 0, z: 0 }, yaw: 0 },
      shape: { kind: "shell", width: 4, height: 3, depth: 5, thickness: .15, doorway: { width: 1.2, height: 2.2 } },
      material: "timber", attachments: [], supports: [], behaviors: [{ id: "habitat", version: 1, parameters: {} }] }]
  });
  const instance = createCreationInstance({ instanceId: "creation:home", definition, ownerId: "builder", worldId: "wildz", spaceId: overrides.spaceId ?? "wildz.space.outer.v1", pose: { position: { x: 9_000, y: 100, z: -9_000 }, yaw: 0 }, kaiUPulse: 20 });
  const { head: _head, ...basis } = instance;
  const functional = sealCreationInstance({ ...basis, stage: overrides.stage ?? "functional", nodeStates: initializeCreationComponents(definition, 20) });
  const command: WildsCreationSourceRecord["command"] = {
    type: "creation.construct", commandId: "creation:command:home", instanceId: instance.instanceId, definition,
    context: { worldId: instance.worldId, spaceId: instance.spaceId, pose: instance.pose, sourceHead: `sha256:${"a".repeat(64)}`, budget: { timber: 100 }, techniques: ["assembly"], physical: [], quality: "low" },
    planDigest: `sha256:${"b".repeat(64)}`, workerSources: [], resources: [], actorPosition: instance.pose.position
  };
  return { schema: "wildz.creation-world-source.v1", command, commandDigest: constructionProofDigest(command), instance: functional, ruleHead: `sha256:${"c".repeat(64)}`, kaiUPulse: 20 };
}

function project(source: WildsCreationSourceRecord) {
  const world = { constructionProjects: {}, constructionComponents: {}, creations: { [source.instance.instanceId]: source } };
  return projectWildsCustomBuildingMap(world);
}

test("durable prompt creations appear once at their saved pose with a readable kind label", () => {
  const source = creationSource();
  const markers = project(source);
  assert.deepEqual(markers, [{ id: "creation:home", blueprint: "custom-building", name: "Shelter", pieceCount: 1,
    phase: "complete", progress: 1, ownerReceizId: "builder", position: { x: 9_000, y: 100, z: -9_000 } }]);
  assert.notEqual(markers[0]!.position, source.instance.pose.position, "map data should not alias the durable instance");
});

test("authored seed names stay concise and do not expose generated identifiers", () => {
  assert.equal(project(creationSource({ seed: "cedar-hall" }))[0]?.name, "Cedar Hall");
  assert.equal(project(creationSource({ seed: "farm:5b1d088e-92b1-4c92-8a04-e5a04740b1ca" }))[0]?.name, "Farm");
});

test("UUID seeds use the creation kind instead of an identifier as the map label", () => {
  assert.equal(project(creationSource({ seed: "5b1d088e-92b1-4c92-8a04-e5a04740b1ca" }))[0]?.name, "Shelter");
});

test("planned, destroyed and interior creations do not become outer-world building markers", () => {
  for (const source of [creationSource({ stage: "planned" }), creationSource({ stage: "destroyed" }), creationSource({ spaceId: "wildz.space.burrow.v1" })]) {
    assert.deepEqual(project(source), []);
  }
  assert.equal(project(creationSource({ stage: "building" }))[0]?.phase, "construction");
  assert.equal(project(creationSource({ stage: "finished" }))[0]?.phase, "complete");
});

test("invalid durable positions do not poison the map", () => {
  const source = creationSource();
  const invalid = { ...source, instance: { ...source.instance, pose: { ...source.instance.pose, position: { x: Infinity, y: 0, z: 0 } } } };
  assert.deepEqual(project(invalid), []);
});
