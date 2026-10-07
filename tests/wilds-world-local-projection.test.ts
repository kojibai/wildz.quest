import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WildsWorldService } from '../src/features/play/wilds-world-service';
import { checkpointWildsWorld, initialWildsWorldProjection, type WildsWorldProjection } from '../src/features/play/wilds-world-state';

test('local projection execution preserves exact events, constitutional decisions and source immutability', () => {
  const base = initialWildsWorldProjection();
  const reference = new WildsWorldService({ checkpoint: checkpointWildsWorld(base) });
  const local = WildsWorldService.fromLocalProjection(base);
  const authority = { actorId: 'global_keeper.receiz.id', canonical: true, pulse: '2026-07-19T12:00:00.000Z', occurredAt: '2026-07-19T12:00:00.000Z' };
  const command = { type: 'construction.project.create' as const, commandId: 'command:local:project', name: 'Same law', region: { x: 0, z: 0 } };
  assert.deepEqual(local.execute(command, authority), reference.execute(command, authority));
  assert.deepEqual(local.checkpoint(), reference.checkpoint());
  assert.equal(base.revision, 0);
  assert.deepEqual(base.constructionProjects, {});
});

test('local projection hydration matches historical checkpoint defaults and external checkpoints still reject changed bytes', () => {
  const base = initialWildsWorldProjection();
  const legacy = { ...base } as Partial<WildsWorldProjection>;
  delete legacy.materialLots; delete legacy.constructionComponents; delete legacy.worldEmission;
  const checkpoint = checkpointWildsWorld(legacy as WildsWorldProjection);
  assert.deepEqual(WildsWorldService.fromLocalProjection(legacy as WildsWorldProjection).snapshot(), new WildsWorldService({ checkpoint }).snapshot());
  const changed = structuredClone(checkpoint); changed.projection.revision++;
  assert.throws(() => new WildsWorldService({ checkpoint: changed }), /checkpoint_invalid/);
  const changedBytes = structuredClone(checkpoint); changedBytes.projection.worldEmission = { forged: true } as unknown as WildsWorldProjection['worldEmission'];
  assert.throws(() => new WildsWorldService({ checkpoint: changedBytes }), /checkpoint_invalid/);
});
