import assert from 'node:assert/strict';
import { test } from 'node:test';
import { KAI_N_DAY_MICRO } from '../src/features/play/kai-klok-moment';
import { initialPlayState, applyWildsInput, serializePlayState, restorePlayState, projectWildsRestedCompanionCondition } from '../src/features/play/game-state';
import { createPlayerBreaths } from '../src/features/play/player-breath-energy';
import { wildsWildAnimalsForTile, projectWildsWildAnimalPosition, type WildsWildAnimal } from '../src/features/play/wilds-animal-ecology';
import { createWildsLivestockState, wildsAnimalHead, huntWildsAnimal, captureWildsLivestock, collectWildsLivestock, resolveWildsLivestockShelter, createWildsLivestockShelterSelector, selectWildsHuntingSupport, type WildsHusbandryWorld } from '../src/features/play/wilds-livestock';
import { regionForPosition } from '../src/features/play/multiplayer-core';
import { constructionProofDigest, createWildsConstructionProject } from '../src/features/play/wilds-construction-project';
import { createWildsConstructionComponent, createWildsMaterialContribution, createWildsWorkContribution, projectWildsConstructionProgress } from '../src/features/play/wilds-construction-component';
import { createWildsBlueprintPreview, previewWildsBlueprintPlacement } from '../src/features/play/wilds-world-construction';
import { initialWildsWorldProjection } from '../src/features/play/wilds-world-state';
import { createWildsWorkstation, createWildsStewardTool, type WildsMaterialLotV1 } from '../src/features/play/wilds-steward-construction';
const DAY = Number(KAI_N_DAY_MICRO), BASE = DAY * 100, OWNER = 'wilds.player.receiz.id';
function animalFixture(): WildsWildAnimal {
  for (let z = -4; z <= 4; z++) for (let x = -4; x <= 4; x++) {
    const animal = wildsWildAnimalsForTile(x, z).find(a => a.species === 'ground-bird');
    if (animal) return animal;
  }
  throw Error('Expected a canonical ground bird in the test neighborhood');
}
function shelterFixture(animal = animalFixture(), amount = 100) {
  const region = regionForPosition(animal.anchor);
  const project = createWildsConstructionProject({ ownerReceizId: OWNER, name: 'Bird garden', region, kaiUPulse: 1 });
  const base = createWildsBlueprintPreview('blueprint:livestock', `wildz.excavation.region.v1:${region.x}:${region.z}`);
  const evidence = { sourceBlueprint: base, pointer: animal.anchor, rotationQuarterTurns: 0, heightStep: 0,
    physical: { terrainY: animal.anchor.y, waterline: null, anchors: [], solids: [] } };
  const placement = previewWildsBlueprintPlacement({ blueprint: base, kind: 'garden', ...evidence });
  const component = createWildsConstructionComponent({ project, evidence, placement, ownerReceizId: OWNER, kaiUPulse: 2 });
  let index = 0;
  const lots = component.recipe.stages.flatMap(stage => (['hay', 'timber', 'stone'] as const).flatMap(kind => Array.from({ length: stage.materials[kind] }, () => {
    const lotId = `wildz:material:${kind}:${(++index).toString(16).padStart(64, '0')}`;
    const basis = { schema: 'wildz.material-lot.v1' as const, lotId, kind, quantity: 1 as const, quality: 1 as const, ownerReceizId: OWNER,
      source: { sourceId: 'source:test', sourceHead: `sha256:${'a'.repeat(64)}`, admittedSourceHead: `sha256:${'b'.repeat(64)}`, kaiUPulse: 1 },
      contributors: { explorerReceizId: OWNER }, authority: 'source-proof-object' as const };
    return { ...basis, head: constructionProofDigest(basis) } satisfies WildsMaterialLotV1;
  })));
  const materials = lots.map(lot => createWildsMaterialContribution({ component, lot, custodianReceizId: OWNER, contributorReceizId: OWNER, commandId: `deposit:${lot.lotId}`, kaiUPulse: 3 }));
  const work = [createWildsWorkContribution({ component, materials, worker: { kind: 'player', receizId: OWNER }, amount, commandId: 'garden-work', kaiUPulse: 4 })];
  const progress = projectWildsConstructionProgress(component, materials, work);
  const world = { ...initialWildsWorldProjection(), constructionProjects: { [project.projectId]: project }, constructionComponents: { [component.componentId]: component },
    materialLots: Object.fromEntries(lots.map(lot => [lot.lotId, lot])), constructionMaterialContributions: Object.fromEntries(materials.map(p => [p.contributionId, p])),
    constructionWorkContributions: Object.fromEntries(work.map(p => [p.contributionId, p])), consumedMaterialLots: Object.fromEntries(progress.embeddedLotIds.map(id => [id, component.componentId])) };
  return { world, component };
}
function request(animal = animalFixture()) {
  return { state: createWildsLivestockState(OWNER), ownerReceizId: OWNER, animalId: animal.animalId,
    expectedAnimalHead: wildsAnimalHead(animal.animalId), kaiUPulse: BASE,
    player: projectWildsWildAnimalPosition(animal, BASE).position, spaceId: 'wildz.space.outer.v1' };
}
test('movement reuses verified shelters while changes to ownership, reach or the world invalidate readiness', () => {
  const { world, component } = shelterFixture();
  let proofReads = 0;
  const observed = { ...world, get constructionMaterialContributions() { proofReads++; return world.constructionMaterialContributions; } };
  const select = createWildsLivestockShelterSelector(), player = component.transform.position;
  assert.equal(select(observed, player, OWNER)?.shelterId, component.componentId);
  const initialReads = proofReads;
  assert.ok(initialReads > 0);
  for (let i = 0; i < 100; i++) assert.equal(select(observed, { ...player, x: player.x + i / 100 }, OWNER)?.shelterId, component.componentId);
  assert.equal(proofReads, initialReads, 'moving within an immutable world does not reverify material proofs');
  assert.equal(select(observed, { ...player, x: player.x + 9 }, OWNER), null);
  assert.equal(select(observed, player, OWNER, 'wildz.space.other'), null);
  assert.equal(select(observed, player, 'another-owner'), null);
  assert.equal(select(observed, player, OWNER)?.shelterId, component.componentId);
  const damage = { componentId: component.componentId, componentHead: component.head, integrity: 25,
    throughWindow: 10, kaiUPulse: BASE, parentHead: null, priorHeads: [] };
  const damaged: WildsHusbandryWorld = { ...observed, constructionConditions: { [component.componentId]: { ...damage, head: constructionProofDigest(damage) } } };
  assert.equal(select(damaged, player, OWNER), null, 'new world snapshots revalidate shelter integrity');
});
test('landscape fauna wander deterministically while keeping one finite individual identity', () => {
  const animal = animalFixture(), first = projectWildsWildAnimalPosition(animal, BASE), later = projectWildsWildAnimalPosition(animal, BASE + 1_000_000);
  assert.notDeepEqual(first.position, later.position);
  assert.deepEqual(projectWildsWildAnimalPosition(animal, BASE), first);
  assert.ok(Math.hypot(first.position.x - animal.anchor.x, first.position.z - animal.anchor.z) <= 1);
});
test('wildlife covers visible ground within a breath instead of barely drifting over minutes', () => {
  const animals = [];
  for (let z = -4; z <= 4; z++) for (let x = -4; x <= 4; x++) animals.push(...wildsWildAnimalsForTile(x, z));
  for (const species of ['ground-bird', 'meadow-goat', 'hare'] as const) {
    const animal = animals.find(a => a.species === species)!;
    let travelled = 0;
    for (let pulse = 0; pulse < 20; pulse++) {
      const first = projectWildsWildAnimalPosition(animal, BASE + pulse * 1_000_000).position;
      const next = projectWildsWildAnimalPosition(animal, BASE + (pulse + 1) * 1_000_000).position;
      travelled += Math.hypot(first.x - next.x, first.z - next.z);
    }
    assert.ok(travelled / 20 > .3, `${species} must visibly roam between breaths, got ${travelled / 20}m`);
  }
});
test('hunting needs an actual ready companion ability and settles each wild individual only once', () => {
  const input = request(), asset = initialPlayState.inventory[0]!;
  const hunter = { kind: 'creature' as const, asset, condition: initialPlayState.adventureConditions[asset.id], abilityIndex: 0 };
  const first = huntWildsAnimal({ ...input, hunter });
  assert.equal(first.ok, true);
  assert.equal(first.state.animals[input.animalId].status, 'hunted');
  assert.equal(huntWildsAnimal({ ...input, state: first.state, hunter }).ok, false);
  assert.equal(huntWildsAnimal({ ...input, hunter: { ...hunter, abilityIndex: 99 } }).ok, false);
  assert.equal(huntWildsAnimal({ ...input, hunter: { ...hunter, condition: { ...hunter.condition!, fatigue: 100 } } }).ok, false);
  assert.equal(huntWildsAnimal({ ...input, hunter: { kind: 'tool', world: { stewardTools: {}, equippedStewardTools: {} } } }).ok, false);
  assert.equal(huntWildsAnimal({ ...input, player: { ...input.player, x: input.player.x + 10 }, hunter }).ok, false);
});
test('hunting controls select a ready companion and explain cooldown or exhaustion instead of a silent action', () => {
  const input=request(), asset=initialPlayState.inventory[0]!, condition=initialPlayState.adventureConditions[asset.id];
  const props={state:input.state,ownerReceizId:OWNER,kaiUPulse:BASE,companion:asset,condition};
  const ready=selectWildsHuntingSupport(props);
  assert.deepEqual(ready.hunter,{kind:'creature',assetId:asset.id,abilityIndex:0});assert.equal(ready.blocker,null);
  const hunted=huntWildsAnimal({...input,hunter:{kind:'creature',asset,condition,abilityIndex:0}});
  const recovering=selectWildsHuntingSupport({...props,state:hunted.state});
  assert.equal(recovering.hunter,null);assert.match(recovering.blocker!,/recover/);
  assert.equal(selectWildsHuntingSupport({...props,state:hunted.state,kaiUPulse:BASE+12_000_000}).blocker,null);
  const tired=selectWildsHuntingSupport({...props,condition:{...condition!,fatigue:100}});
  assert.equal(tired.hunter,null);assert.match(tired.blocker!,/rest/);
  const absent=selectWildsHuntingSupport({state:input.state,ownerReceizId:OWNER,kaiUPulse:BASE});
  assert.equal(absent.hunter,null);assert.match(absent.blocker!,/axe|companion/);
});
test('elapsed rest makes a tired companion ready to hunt without a separate wake tick, while rejection remains inert', () => {
  const input=request(), asset=initialPlayState.inventory[0]!, condition={...initialPlayState.adventureConditions[asset.id]!,fatigue:90};
  const end=BASE+20*64_000_000, position=projectWildsWildAnimalPosition(animalFixture(),end).position;
  const start={...initialPlayState,selectedAssetId:asset.id,adventureConditions:{...initialPlayState.adventureConditions,[asset.id]:condition},
    player:{x:position.x,z:position.z},siteSpace:{...initialPlayState.siteSpace,position},playerBreaths:createPlayerBreaths(BASE,30),energy:30};
  const rested=applyWildsInput(start,{type:'sleep',kaiUPulse:BASE});
  const projected=projectWildsRestedCompanionCondition(rested,end,asset.id)!;
  assert.equal(projected.fatigue,70); assert.equal(rested.adventureConditions[asset.id]!.fatigue,90);
  const support=selectWildsHuntingSupport({ownerReceizId:OWNER,kaiUPulse:end,companion:asset,condition:projected});
  assert.ok(support.hunter);
  const action={type:'hunt-animal' as const,ownerReceizId:OWNER,animalId:input.animalId,expectedAnimalHead:input.expectedAnimalHead,kaiUPulse:end,
    hunter:{kind:'creature' as const,assetId:asset.id,abilityIndex:0}};
  assert.equal(applyWildsInput(rested,{...action,expectedAnimalHead:'stale'}),rested);
  const hunted=applyWildsInput(rested,action);
  assert.equal(hunted.playerLivestock?.animals[input.animalId]?.status,'hunted');
  assert.equal(hunted.adventureConditions[asset.id]!.fatigue,73);
  assert.equal(hunted.playerBreaths?.mode,'active');
});
test('an equipped verified axe incurs finite local hunting wear without minting a tool proof', () => {
  let index = 500;
  const makeLot = (kind: 'timber' | 'stone'): WildsMaterialLotV1 => {
    const basis = { schema: 'wildz.material-lot.v1' as const, lotId: `wildz:material:${kind}:${(++index).toString(16).padStart(64, '0')}`, kind,
      quantity: 1 as const, quality: 1 as const, ownerReceizId: OWNER,
      source: { sourceId: 'source:test', sourceHead: `sha256:${'a'.repeat(64)}`, admittedSourceHead: `sha256:${'b'.repeat(64)}`, kaiUPulse: 1 },
      contributors: { explorerReceizId: OWNER }, authority: 'source-proof-object' as const };
    return { ...basis, head: constructionProofDigest(basis) };
  };
  const builder = { creatureSubjectId: 'creature:tool-test', creatureHead: `sha256:${'a'.repeat(64)}` };
  const workstation = createWildsWorkstation({ ownerReceizId: OWNER, position: { x: 12, y: 1, z: 18 }, rotationQuarterTurns: 0,
    lots: [makeLot('timber'), makeLot('timber'), makeLot('timber'), makeLot('stone'), makeLot('stone')], builder, existingStructures: [], kaiUPulse: 10 });
  const tool = createWildsStewardTool({ kind: 'steward-axe', ownerReceizId: OWNER, workstation, lots: [makeLot('timber'), makeLot('stone')], builder, kaiUPulse: 11 });
  const world = { stewardTools: { [tool.toolId]: tool }, equippedStewardTools: { [OWNER]: tool.toolId } };
  const input = request(), hunted = huntWildsAnimal({ ...input, hunter: { kind: 'tool', world } });
  assert.equal(hunted.ok, true);
  assert.equal(hunted.state.toolUses[tool.toolId], 1);
  assert.equal(tool.durability.remaining, 24);
  assert.equal(huntWildsAnimal({ ...input, hunter: { kind: 'tool', world: { ...world, equippedStewardTools: {} } } }).ok, false);
  assert.equal(huntWildsAnimal({ ...input, state: { ...input.state, toolUses: { [tool.toolId]: 24 } }, hunter: { kind: 'tool', world } }).ok, false);
  const asset=initialPlayState.inventory[0]!, condition={...initialPlayState.adventureConditions[asset.id]!,fatigue:100};
  const support=selectWildsHuntingSupport({state:input.state,ownerReceizId:OWNER,kaiUPulse:BASE,companion:asset,condition,toolWorld:world});
  assert.deepEqual(support.hunter,{kind:'tool'});assert.equal(support.blocker,null);
  const worn=selectWildsHuntingSupport({state:{...input.state,toolUses:{[tool.toolId]:24}},ownerReceizId:OWNER,kaiUPulse:BASE,toolWorld:world});
  assert.equal(worn.hunter,null);assert.match(worn.blocker!,/axe|companion/);
});
test('capture requires a funded functioning source garden and excludes the same animal from hunting', () => {
  const input = request(), { world, component } = shelterFixture();
  assert.ok(resolveWildsLivestockShelter(world, component.componentId, OWNER));
  assert.equal(resolveWildsLivestockShelter({ ...world, consumedMaterialLots: {} }, component.componentId, OWNER), null);
  assert.equal(resolveWildsLivestockShelter({ ...world, constructionWorkContributions: {} }, component.componentId, OWNER), null);
  const captured = captureWildsLivestock({ ...input, shelterId: component.componentId, world });
  assert.equal(captured.ok, true);
  assert.equal(captured.state.animals[input.animalId].status, 'captured');
  assert.equal(captureWildsLivestock({ ...input, state: captured.state, shelterId: component.componentId, world }).ok, false);
  const asset = initialPlayState.inventory[0]!;
  assert.equal(huntWildsAnimal({ ...input, state: captured.state, hunter: { kind: 'creature', asset, condition: initialPlayState.adventureConditions[asset.id], abilityIndex: 0 } }).ok, false);
});
test('productive livestock waits for Kai time and yields once without banking an offline backlog', () => {
  const input = request(), { world, component } = shelterFixture();
  const captured = captureWildsLivestock({ ...input, shelterId: component.componentId, world });
  assert.equal(captured.ok, true);
  const collect = { state: captured.state, ownerReceizId: OWNER, animalId: input.animalId, kaiUPulse: BASE, player: component.transform.position, spaceId: 'wildz.space.outer.v1', world };
  assert.equal(collectWildsLivestock(collect).ok, false);
  const future = BASE + DAY * 1000, yielded = collectWildsLivestock({ ...collect, kaiUPulse: future });
  assert.equal(yielded.ok, true);
  assert.equal(yielded.state.animals[input.animalId].lastProductDay, 1100);
  assert.equal(collectWildsLivestock({ ...collect, state: yielded.state, kaiUPulse: future }).ok, false);
  assert.equal(collectWildsLivestock({ ...collect, kaiUPulse: future, world: { ...world, consumedMaterialLots: {} } }).ok, false);
  assert.equal(collectWildsLivestock({ ...collect, kaiUPulse: future, ownerReceizId: 'foreign-owner' }).ok, false);
});
test('gameplay animal food is source linked, edible once, and animal depletion survives owner save restoration', () => {
  const animal = animalFixture(), input = request(animal), asset = initialPlayState.inventory[0]!;
  const state = { ...initialPlayState, player: { x: input.player.x, z: input.player.z }, siteSpace: { ...initialPlayState.siteSpace, position: input.player }, playerBreaths: createPlayerBreaths(BASE, 20), energy: 20 };
  const hunted = applyWildsInput(state, { type: 'hunt-animal', ownerReceizId: OWNER, animalId: animal.animalId, expectedAnimalHead: input.expectedAnimalHead,
    hunter: { kind: 'creature', assetId: asset.id, abilityIndex: 0 }, kaiUPulse: BASE });
  assert.equal(hunted.playerLivestock!.animals[animal.animalId].status, 'hunted');
  const food = Object.values(hunted.playerNourishment!.items)[0]!;
  assert.equal(food.foodKind, 'wild-meat');
  const eaten = applyWildsInput(hunted, { type: 'eat-food', ownerReceizId: OWNER, itemId: food.itemId, kaiUPulse: BASE });
  assert.ok(eaten.playerBreaths!.reserveMicroBreaths > hunted.playerBreaths!.reserveMicroBreaths);
  const restored = restorePlayState(serializePlayState(eaten), OWNER);
  assert.deepEqual(restored.playerLivestock, eaten.playerLivestock);
  assert.equal(applyWildsInput(restored, { type: 'eat-food', ownerReceizId: OWNER, itemId: food.itemId, kaiUPulse: BASE }), restored);
  assert.equal(restorePlayState(serializePlayState(eaten), 'foreign-owner').playerLivestock, undefined);
});
