'use client';

import { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import type { Mesh } from 'three';
import { createWildsWorldWorkerClient } from './wilds-world-work-client';
import { prepareAndPersistWildsWorldOutboxEntry } from './wilds-world-outbox';
import { createWildsSourceAuthorityProjection, replanQueuedWildsMaterialHarvest } from './wilds-source-work-authority';
import { projectWildsResourceRegion } from './wilds-resource-authority';
import { createWildsConstructionProject } from './wilds-construction-project';
import { createWildsConstructionComponent } from './wilds-construction-component';
import { createWildsBlueprintPreview, previewWildsBlueprintPlacement } from './wilds-world-construction';
import { prepareReceivedWildsWorldProofs } from './wilds-received-proof-immutability';
import { withWildsWorldCommandKai } from './wilds-world-authority';
import { createKaiTemporalRoot } from './kai-temporal-root';
import { deriveKaiKlokMomentFromUPulse } from './kai-klok-moment';
import type { WildsWorldProjection } from './wilds-world-state';

const actorId = 'global_worker_fixture.receiz.id';
type WorkerPort = ReturnType<NonNullable<Parameters<typeof createWildsWorldWorkerClient>[0]>>;

function fixtureWorld() {
  const project = createWildsConstructionProject({ ownerReceizId: actorId, name: 'Worker fixture', region: { x: 0, z: 0 }, kaiUPulse: 1 });
  const evidence = { sourceBlueprint: createWildsBlueprintPreview('blueprint:worker-fixture', 'wildz.excavation.region.v1:0:0'), pointer: { x: 2, y: 0, z: 2 }, rotationQuarterTurns: 0, heightStep: 0, physical: { terrainY: 0, waterline: null, anchors: [], solids: [] } };
  const placement = previewWildsBlueprintPlacement({ blueprint: evidence.sourceBlueprint, kind: 'foundation', ...evidence });
  const components = Array.from({ length: 64 }, (_, index) => createWildsConstructionComponent({ project, evidence, placement, ownerReceizId: actorId, kaiUPulse: 2, commandId: `worker:fixture:${index}` }));
  return { ...createWildsSourceAuthorityProjection(), constructionProjects: { [project.projectId]: project }, constructionComponents: Object.fromEntries(components.map(row => [row.componentId, row])) };
}

function Actor({ x, frames }: { x: number; frames: React.RefObject<number> }) {
  const mesh = useRef<Mesh>(null);
  useFrame((_, delta) => { frames.current++; if (mesh.current) mesh.current.rotation.y += delta; });
  return <mesh ref={mesh} position={[x, 0, 0]}><boxGeometry /><meshStandardMaterial color="#92e4b0" /></mesh>;
}

/** Explicitly gated synthetic-world test: real browser worker, source law and
 * device persistence, with no user account, wallet or network publication. */
export function WorldWorkerBrowserFixture() {
  const [world, setWorld] = useState<WildsWorldProjection | null>(null);
  const [x, setX] = useState(0);
  const [status, setStatus] = useState('Preparing synthetic geometry');
  const [pending, setPending] = useState(false);
  const frames = useRef(0), busy = useRef(false), client = useRef<ReturnType<typeof createWildsWorldWorkerClient> | null>(null);
  useEffect(() => {
    let active = true;
    const worker = createWildsWorldWorkerClient(() => new Worker(new URL('./wilds-world-work.worker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerPort);
    client.current = worker;
    void prepareReceivedWildsWorldProofs(fixtureWorld()).then(prepared => { if (active) { setWorld(prepared); setStatus('Real worker ready'); } });
    return () => { active = false; worker.close(); client.current = null; };
  }, []);
  async function harvest() {
    if (!world || !client.current || busy.current) return;
    busy.current = true; setPending(true); setStatus('Worker validating and saving; movement stays enabled');
    const base = world, startingFrames = frames.current, kaiUPulse = 2000010 + world.revision;
    const source = projectWildsResourceRegion(0, 0).find(row => row.kind === 'timber')!;
    try {
      const command = withWildsWorldCommandKai(replanQueuedWildsMaterialHarvest({ projection: base, source, actorId, actorPosition: source.position, kaiUPulse, commandId: `command:fixture:harvest:${crypto.randomUUID()}` }), createKaiTemporalRoot(deriveKaiKlokMomentFromUPulse({ uPulse: kaiUPulse, authority: 'local' })));
      const result = await client.current.run({ kind: 'prepare-persist', base, entry: { schema: 'receiz.wilds_world_outbox_entry.v1', actorId, guestId: 'guest-worker-fixture', command, queuedAt: new Date().toISOString() } }) as Awaited<ReturnType<typeof prepareAndPersistWildsWorldOutboxEntry>>;
      if (!client.current) return;
      const rows = Object.entries(base.constructionComponents);
      const retained = rows.filter(([id, row]) => result.projection.constructionComponents[id] === row).length;
      setWorld(result.projection);
      setStatus(`Harvest admitted · unchanged geometry retained ${retained}/${rows.length} · scene frames during work ${frames.current - startingFrames}`);
    } catch (error) { if (client.current) setStatus(error instanceof Error ? error.message : 'Worker check failed'); }
    finally { busy.current = false; if (client.current) setPending(false); }
  }
  return <main style={{ minHeight: '100dvh', padding: 24, color: '#edfff3', background: '#071411', fontFamily: 'system-ui' }}>
    <h1>World worker gameplay check</h1>
    <p>SIMULATION ONLY · isolated synthetic world · no user accounts, wallet or network publication</p>
    <div style={{ height: 300 }}><Canvas camera={{ position: [0, 2, 6] }}><ambientLight intensity={1.5} /><directionalLight position={[4, 5, 4]} /><Actor x={x} frames={frames} /></Canvas></div>
    <button onClick={() => setX(value => value >= 2 ? -2 : value + .5)} type="button">Move actor</button>{' '}
    <button disabled={!world || pending} onClick={() => void harvest()} type="button">Harvest test timber</button>
    <p role="status">{status}</p>
    <p>Accepted actor x: {x.toFixed(1)} · Timber lots: {Object.keys(world?.materialLots ?? {}).length}</p>
  </main>;
}
