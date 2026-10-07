import assert from "node:assert/strict";
import { test } from "node:test";
import { prepareReceivedWildsWorldProofs, retainReceivedWildsWorldProofs } from "../src/features/play/wilds-received-proof-immutability";
import { createWildsConstructionProject } from "../src/features/play/wilds-construction-project";
import { createWildsConstructionComponent } from "../src/features/play/wilds-construction-component";
import { createWildsBlueprintPreview, previewWildsBlueprintPlacement } from "../src/features/play/wilds-world-construction";
import { createWildsConstructionGeometryProjector } from "../src/features/play/wilds-construction-geometry";
import { initialWildsWorldProjection } from "../src/features/play/wilds-world-state";

test("initial received construction preparation yields and keeps exact geometry ready for rendering", async () => {
  const project = createWildsConstructionProject({ ownerReceizId: "owner", name: "Startup", region: { x: 0, z: 0 }, kaiUPulse: 1 });
  const evidence = { sourceBlueprint: createWildsBlueprintPreview("blueprint:test", "wildz.excavation.region.v1:0:0"),
    pointer: { x: 2, y: 0, z: 2 }, rotationQuarterTurns: 0, heightStep: 0,
    physical: { terrainY: 0, waterline: null, anchors: [], solids: [] } };
  const components = Array.from({ length: 80 }, (_, index) => createWildsConstructionComponent({ project, evidence,
    placement: previewWildsBlueprintPlacement({ blueprint: evidence.sourceBlueprint, kind: "foundation", ...evidence }),
    ownerReceizId: "owner", kaiUPulse: 2, commandId: `startup:${index}` }));
  const world = structuredClone({ ...initialWildsWorldProjection(),
    constructionComponents: Object.fromEntries(components.map(component => [component.componentId, component])) });
  let rendered = 0;
  const timer = setInterval(() => { rendered++; }, 0);
  try {
    assert.equal(await prepareReceivedWildsWorldProofs(world), world);
    assert.ok(rendered > 0, "render tasks can run before the first heavy geometry pass finishes");
    const projectGeometry = createWildsConstructionGeometryProjector([], []);
    for (const component of components) {
      const received = projectGeometry(world.constructionComponents[component.componentId]!);
      assert.deepEqual(received, projectGeometry(component));
      assert.equal(projectGeometry(world.constructionComponents[component.componentId]!), received, "render selectors reuse the prepared immutable proof geometry");
    }
  } finally { clearInterval(timer); }
});

test("private transferred proof rows freeze deeply while unrelated gameplay and maps remain mutable", () => {
  const row = { nested: { values: [1, 2] } }, player = { x: 1 };
  const world = { constructionComponents: { row }, materialLots: { lot: { owner: "owner" } }, player };
  assert.equal(retainReceivedWildsWorldProofs(world), world);
  assert.ok(Object.isFrozen(row)); assert.ok(Object.isFrozen(row.nested.values));
  assert.ok(Object.isFrozen(world.materialLots.lot));
  assert.equal(Object.isFrozen(world.constructionComponents), false);
  assert.equal(Object.isFrozen(player), false);
  world.constructionComponents.row = { nested: { values: [] } }; player.x = 2;
});

test("malformed proof data never invokes accessors or partially freezes descendants", () => {
  let reads = 0;
  const child = { owner: "owner" };
  const accessor = { child, get source() { reads++; return "pretend"; } };
  const custom = Object.assign(Object.create({}), { child });
  const cyclic: { child: object; self?: object } = { child }; cyclic.self = cyclic;
  const rows = [accessor, custom, cyclic, { child, missing: undefined }, { child, sparse: Array(2) }, { child, [Symbol("hidden")]: 1 }];
  for (const row of rows) {
    retainReceivedWildsWorldProofs({ constructionComponents: { row } });
    assert.equal(Object.isFrozen(row), false);
    assert.equal(Object.isFrozen(child), false);
  }
  assert.equal(reads, 0);
});
