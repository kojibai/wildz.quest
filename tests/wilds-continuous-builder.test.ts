import { resolveWildsGroundMovement } from "../src/features/play/wilds-grounded-movement";
import assert from "node:assert/strict";
import { test } from "node:test";
import { initialWildsWorldProjection, checkpointWildsWorld } from "../src/features/play/wilds-world-state";
import { WildsWorldService } from "../src/features/play/wilds-world-service";
import { previewWildsContinuousBuild, selectWildsConstructionDeposit } from "../src/features/play/wilds-continuous-builder";
import { projectWildsConstructionObstacles } from "../src/features/play/wilds-construction-physics";
import { projectWildsStructureSupports, wildsStructureSupportAt } from "../src/features/play/wilds-structure-support";
import { createWildsMaterialContribution, createWildsWorkContribution, projectWildsConstructionProgress } from "../src/features/play/wilds-construction-component";
import { canonicalPortableCardJson, sha256PortableBasis } from "../src/features/play/portable-card";
import type { WildsMaterialLotV1 } from "../src/features/play/wilds-steward-construction";

const actorId = "owner";
const authority = { actorId, canonical: true, occurredAt: "2026-09-07T12:00:00.000Z", pulse: "2026-09-07T12:00:00.000Z", uPulse: 10 };
const request = { pointer: { x: 20, y: 0, z: 20 }, rotationQuarterTurns: 0, heightStep: 0, surfaceSnap: true };
function fixture(kind: "foundation" | "stair" | "floor" = "foundation") {
  const service = new WildsWorldService();
  service.execute({ type: "construction.project.create", name: "Home", region: { x: 0, z: 0 }, commandId: "project:1" }, authority);
  const preview = previewWildsContinuousBuild(service.snapshot(), actorId, kind, request);
  service.execute({ type: "construction.component.place", projectId: preview.project!.projectId, placement: preview.placement, request, actorPosition: request.pointer, commandId: "place:1" }, authority);
  return { world: service.snapshot(), component: Object.values(service.snapshot().constructionComponents)[0] };
}
function lot(index: number, kind: WildsMaterialLotV1["kind"]): WildsMaterialLotV1 {
  const basis = { schema: "wildz.material-lot.v1" as const, lotId: `wildz:material:${kind}:${index.toString(16).padStart(64, "0")}`, kind, quantity: 1 as const, quality: 1 as const, ownerReceizId: actorId, source: { sourceId: "source:test", sourceHead: `sha256:${"a".repeat(64)}`, admittedSourceHead: `sha256:${"b".repeat(64)}`, kaiUPulse: 1 }, contributors: { explorerReceizId: actorId }, authority: "source-proof-object" as const };
  return { ...basis, head: sha256PortableBasis(canonicalPortableCardJson(basis)) };
}
function finish(kind: "foundation" | "stair" | "floor") {
  const f = fixture(kind);
  let index = 0;
  const materials = f.component.recipe.stages.flatMap(stage => (["hay", "timber", "stone"] as const).flatMap(kind => Array.from({ length: stage.materials[kind] }, () => createWildsMaterialContribution({ component: f.component, lot: lot(++index, kind), custodianReceizId: actorId, contributorReceizId: actorId, commandId: `deposit:${index}`, kaiUPulse: 11 }))));
  const work = createWildsWorkContribution({ component: f.component, materials, worker: { kind: "player", receizId: actorId }, amount: 20, commandId: "work:1", kaiUPulse: 12 });
  return { ...f, world: { ...f.world, constructionMaterialContributions: Object.fromEntries(materials.map(m => [m.contributionId, m])), constructionWorkContributions: { [work.contributionId]: work } }, materials, work };
}

test("zero-material preview is disposable and confirmation persists an admitted plan", () => {
  const world = initialWildsWorldProjection();
  const before = checkpointWildsWorld(world);
  const preview = previewWildsContinuousBuild(world, actorId, "foundation", request);
  assert.equal(preview.placement.valid, true);
  assert.equal(preview.project, null);
  assert.deepEqual(checkpointWildsWorld(world), before);
  const f = fixture();
  assert.equal(projectWildsConstructionObstacles(f.world).length, 0);
  assert.equal(projectWildsStructureSupports(f.world).length, 0);
  assert.deepEqual(new WildsWorldService({ checkpoint: checkpointWildsWorld(f.world) }).snapshot(), f.world);
});
test("completed construction projects matching physical solids and walkable support", () => {
  const f = finish("foundation");
  const solids = projectWildsConstructionObstacles(f.world);
  const supports = projectWildsStructureSupports(f.world);
  assert.equal(solids.length, 1);
  assert.equal(supports.length, 1);
  assert.equal(supports[0].deckY, solids[0].position.y + (solids[0].shape.kind === "box" ? solids[0].shape.halfY : 0));
  assert.equal(wildsStructureSupportAt(request.pointer, supports, 0, supports[0].deckY - .6)?.structureId, f.component.componentId);
  assert.equal(wildsStructureSupportAt(request.pointer, supports, 0, supports[0].deckY - 5), null);
});
test("stairs expose eight increasing tread heights and share rendering/collision geometry", () => {
  const f = finish("stair");
  const solids = projectWildsConstructionObstacles(f.world);
  const supports = projectWildsStructureSupports(f.world);
  assert.equal(solids.length, 8); assert.equal(supports.length, 8);
  assert.equal(new Set(supports.map(s => s.deckY)).size, 8);
  assert.equal(Math.max(...supports.map(s => s.deckY)) - Math.min(...supports.map(s => s.deckY)), 1.75);
});
test("partial deposits select only remaining materials, in stable order", () => {
  const f = fixture();
  const progress = projectWildsConstructionProgress(f.component, [], []);
  const lots = [lot(4, "stone"), lot(1, "stone"), lot(3, "stone"), lot(2, "stone"), lot(5, "hay")];
  const selected = selectWildsConstructionDeposit(lots, progress);
  assert.equal(selected.length, 4);
  assert.equal(selected.includes(lots[0].lotId), false);
  assert.deepEqual(selected, selectWildsConstructionDeposit([...lots].reverse(), progress));
});
test("surface snapping positions walls and furniture across a foundation without rewriting legacy plans", () => {
  const f = fixture();
  const edge = previewWildsContinuousBuild(f.world, actorId, "wall", { ...request, pointer: { ...request.pointer, y: f.component.transform.position.y, z: 23 } });
  assert.equal(edge.placement.valid, true);
  assert.equal(edge.placement.transform.position.z, 23);
  const legacy = previewWildsContinuousBuild(f.world, actorId, "wall", { ...request, surfaceSnap: undefined, pointer: { ...request.pointer, y: f.component.transform.position.y, z: 23 } });
  assert.equal(legacy.placement.transform.position.z, 20);
  const bed = previewWildsContinuousBuild(f.world, actorId, "bed", { ...request, pointer: { ...request.pointer, y: f.component.transform.position.y, x: 21 } });
  assert.equal(bed.placement.valid, true);
  assert.equal(bed.placement.transform.position.x, 21);
});

test("a visible framed floor is walkable and its edge does not block small walking steps", () => {
  const f = finish("floor");
  const framedWork = createWildsWorkContribution({ component: f.component, materials: f.materials, worker: { kind: "player", receizId: actorId }, amount: 1, commandId: "work:frame", kaiUPulse: 12 });
  const world = { ...f.world, constructionWorkContributions: { [framedWork.contributionId]: framedWork } };
  const supports = projectWildsStructureSupports(world);
  const obstacles = projectWildsConstructionObstacles(world);
  assert.equal(supports.length, 1);
  assert.equal(supports[0].deckY, obstacles[0].position.y + (obstacles[0].shape.kind === "box" ? obstacles[0].shape.halfY : 0));
  let point = { x: 16.4, z: 20 };
  let footY = supports[0].deckY - .24;
  for (let step = 0; step < 30; step++) {
    const next = resolveWildsGroundMovement(point, { x: point.x + .1, z: point.z }, { obstacles, structureSupports: supports, verticalWorldY: footY, capabilities: ["climb", "swim"] });
    point = next.position; footY = next.elevation;
  }
  assert.ok(point.x > 18, `floor edge blocked walking at ${point.x}`);
  assert.equal(footY, supports[0].deckY);
});

test("adjusting a worked piece preserves exact contributions through checkpoint and merge", async () => {
  const { previewWildsConstructionAdjustment } = await import("../src/features/play/wilds-construction-placement");
  const { mergeWildsConstructionPersistence } = await import("../src/features/play/wilds-construction-persistence");
  const f = finish("foundation");
  const service = new WildsWorldService({checkpoint:checkpointWildsWorld(f.world)});
  const nextRequest = {...request,pointer:{...request.pointer,x:22}};
  const preview = previewWildsConstructionAdjustment(service.snapshot(),f.component.componentId,nextRequest);
  assert.equal(preview.blocker,null);
  assert.equal(preview.placement.valid,true);
  const command = {type:"construction.component.adjust" as const, componentId:f.component.componentId,componentHead:f.component.head,placement:preview.placement,request:nextRequest,actorPosition:request.pointer,commandId:"adjust:1"};
  const before = projectWildsConstructionProgress(f.component,f.materials,[f.work]);
  service.execute(command,{...authority,uPulse:13});
  const changed = service.snapshot();
  const next = changed.constructionComponents[f.component.componentId];
  assert.equal(next.transform.position.x,22);
  assert.deepEqual(projectWildsConstructionProgress(next,f.materials,[f.work]),{...before,componentHead:next.head});
  assert.deepEqual(changed.constructionMaterialContributions,f.world.constructionMaterialContributions);
  assert.deepEqual(changed.constructionWorkContributions,f.world.constructionWorkContributions);
  const checkpoint = checkpointWildsWorld(changed);
  assert.deepEqual(new WildsWorldService({checkpoint}).snapshot(),changed);
  const merged = mergeWildsConstructionPersistence(f.world,changed);
  assert.equal(merged.constructionComponents[next.componentId].head,next.head);
  assert.ok(Object.values(merged.constructionChunks).some(chunk=>chunk.references.some(ref=>ref.componentHead===next.head)));
  service.execute(command,{...authority,uPulse:14});
  assert.deepEqual(service.snapshot(),changed);
  assert.throws(()=>service.execute({...command,commandId:"stale:1"},{...authority,uPulse:14}));
  assert.throws(()=>service.execute({...command,componentHead:next.head,commandId:"foreign:1"},{...authority,actorId:"other",uPulse:14}));
  assert.deepEqual(service.snapshot(),changed);
});

test("moving a supporting foundation is blocked until its wall is moved", async () => {
  const { previewWildsConstructionAdjustment } = await import("../src/features/play/wilds-construction-placement");
  const f=fixture();
  const service=new WildsWorldService({checkpoint:checkpointWildsWorld(f.world)});
  const wallRequest={...request,pointer:{...request.pointer,y:f.component.transform.position.y,z:23}};
  const wall=previewWildsContinuousBuild(service.snapshot(),actorId,"wall",wallRequest);
  assert.ok(wall.placement.valid);
  service.execute({type:"construction.component.place",projectId:f.component.projectId,placement:wall.placement,request:wallRequest,actorPosition:request.pointer,commandId:"wall:1"},authority);
  const nextRequest={...request,pointer:{...request.pointer,x:22}};
  const preview=previewWildsConstructionAdjustment(service.snapshot(),f.component.componentId,nextRequest);
  assert.match(preview.blocker ?? "",/supported/);
  const before=checkpointWildsWorld(service.snapshot());
  assert.throws(()=>service.execute({type:"construction.component.adjust",componentId:f.component.componentId,componentHead:f.component.head,placement:preview.placement,request:nextRequest,actorPosition:request.pointer,commandId:"support:1"},{...authority,uPulse:13}));
  assert.deepEqual(checkpointWildsWorld(service.snapshot()),before);
});
