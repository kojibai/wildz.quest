import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compileCreation } from '../src/features/play/creation/compiler';
import { projectCreationWorkers } from '../src/features/play/creation/capabilities';
import { creationBuildInReach, CREATION_PHYSICAL_BUILD_REACH_RULE } from '../src/features/play/creation/build-reach';
import { runCreationProposal, selectCreationProposalEvidence } from '../src/features/play/creation/proposal-work';
import { emptyAdventureCondition } from '../src/features/play/adventure/card-condition';
import { sealCollectedCard } from '../src/features/play/portable-card';
import { createCreationCurrentSourcePort } from '../src/features/play/creation/current-source';
import { createCreationInstance, sealCreationInstance } from '../src/features/play/creation/instance';
import { createCreationPhysicalStore } from '../src/features/play/creation/physical-store';
import { projectCreationPhysical } from '../src/features/play/creation/projection';
import { selectWildsAtlasBuildingMeshes } from '../src/features/play/wilds-atlas-building-meshes';
import type { WildsAtlasWorldAddition } from '../src/features/play/wilds-world-atlas';
import { creationContextFixture, creationDefinitionFixture } from './support/creation-fixtures';

test('an atlas draft at its selected coordinate has a real cost and footprint even with zero materials', () => {
  const definition = creationDefinitionFixture();
  const pose = { position: { x: 104, y: 2, z: -75 }, yaw: Math.PI / 2 };
  const short = creationContextFixture({ pose, budget: {} });
  const blocked = compileCreation(definition, short, { includeDraftGeometry: true });
  assert.equal(blocked.status, 'blocked');
  assert.equal('plan' in blocked, false);
  assert.ok(blocked.quote && blocked.quote.requiredResources.timber > 0);
  assert.ok(blocked.draftGeometry);
  assert.deepEqual(blocked.draftGeometry.pose, pose);
  assert.equal(blocked.draftGeometry.chunks[0].bounds.min.x, 101.5);
  assert.equal(blocked.draftGeometry.chunks[0].bounds.max.z, -73);
  const ordinary = compileCreation(definition, short);
  assert.equal(ordinary.status, 'blocked');
  assert.equal(ordinary.draftGeometry, undefined);
});

test('atlas building meshes require both a visible marker and the same installed creation head', async () => {
  const definition = creationDefinitionFixture();
  const result = compileCreation(definition, creationContextFixture({ spaceId: 'wildz.space.outer.v1' }));
  assert.equal(result.status, 'ready');
  const { plan } = result;
  const { head: _planned, ...placed } = createCreationInstance({ instanceId: 'atlas:building', definition, ownerId: 'owner', worldId: plan.worldId, spaceId: plan.spaceId, pose: plan.pose, kaiUPulse: 1 });
  const instance = sealCreationInstance({ ...placed, stage: 'functional' });
  const reader = createCreationCurrentSourcePort({ async read() {
    return { status: 'available', definition, instance, planDigest: plan.digest, source: { fixture: true } };
  }, async authenticateCurrent(current) { return current.instance.head === instance.head && current.planDigest === plan.digest; } });
  const current = await reader.read({ instanceId: instance.instanceId, worldId: instance.worldId, spaceId: instance.spaceId });
  assert.equal(current.status, 'available');
  const store = createCreationPhysicalStore({ async project(...args) { return projectCreationPhysical(...args); } });
  assert.equal(await store.adoptCurrent(current, plan), true);
  const snapshot = store.snapshot();
  const marker: WildsAtlasWorldAddition = { id: instance.instanceId, creationHead: instance.head, blueprint: 'custom-building', phase: 'complete', ownerReceizId: instance.ownerId,
    position: instance.pose.position, progress: 1 };
  const projection = { gridCenterRegion: { x: 0, z: 0 }, worldAdditions: [marker] };
  const selected = selectWildsAtlasBuildingMeshes(projection, snapshot);
  assert.equal(selected.length, 1);
  assert.equal(selected[0].chunks[0], snapshot.projections[0].chunks[0]);
  assert.deepEqual(selectWildsAtlasBuildingMeshes({ ...projection, worldAdditions: [] }, snapshot), []);
  assert.deepEqual(selectWildsAtlasBuildingMeshes({ ...projection, worldAdditions: [{ ...marker, creationHead: `sha256:${'c'.repeat(64)}` }] }, snapshot), []);
  assert.deepEqual(selectWildsAtlasBuildingMeshes({ ...projection, worldAdditions: [{ ...marker, position: { x: 30, y: 0, z: 0 } }] }, snapshot), []);
  assert.deepEqual(selectWildsAtlasBuildingMeshes({ ...projection, gridCenterRegion: { x: 10, z: 10 } }, snapshot), []);
  assert.deepEqual(selectWildsAtlasBuildingMeshes(projection, { ...snapshot, projections: [{ ...snapshot.projections[0] }] }), []);
  store.close();
});

test('an unavailable proposal transport can quote a real map draft without turning it into an admitted build', async () => {
  const card = sealCollectedCard({ formId: 'mintcub-1', ownerReceizId: 'owner', encounterId: 'atlas:proposal', capturedAt: '2026-07-15T00:00:00.000Z' });
  const workers = projectCreationWorkers([card], { [card.id]: emptyAdventureCondition(card.id) });
  const pose = { position: { x: 210, y: 0, z: -94 }, yaw: 0 };
  const context = creationContextFixture({ pose, budget: {} });
  const request = { actorId: 'owner', requestId: 'atlas:proposal', message: 'Build a timber table', selected: null, workers, context };
  const evidence = selectCreationProposalEvidence(request, { cards: [card], cardAdmissions: {}, lots: [], allowLocalOnUnavailable: true });
  const signal = new AbortController().signal;
  const result = await runCreationProposal(request, evidence, signal, async () => { throw Error('offline'); });
  assert.equal(result.status, 'proposed');
  assert.ok('definition' in result.proposal);
  const quoted = compileCreation(result.proposal.definition, context, { includeDraftGeometry: true });
  assert.equal(quoted.status, 'blocked');
  assert.ok(quoted.draftGeometry);
  assert.equal(creationBuildInReach(quoted.draftGeometry, { x: 0, y: 0, z: 0 }, CREATION_PHYSICAL_BUILD_REACH_RULE.id), false);
  assert.equal(creationBuildInReach(quoted.draftGeometry, { x: 207, y: 0, z: -94 }, CREATION_PHYSICAL_BUILD_REACH_RULE.id), true);

  const refusal = await runCreationProposal(request, evidence, signal, async () => Response.json({ status: 'blocked', reason: 'Ownership changed.' }, { status: 403 }));
  assert.deepEqual(refusal, { status: 'blocked', reason: 'Ownership changed.' });
});
