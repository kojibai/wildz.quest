'use client';

import { Component, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { createReceizInMemoryOfflineProofQueueStorage } from '@receiz/sdk';
import { sealCollectedCard } from '../portable-card';
import { emptyAdventureCondition } from '../adventure/card-condition';
import { projectWildsResourceRegion } from '../wilds-resource-authority';
import { createWildsMaterialHarvest, initialWildsHarvestedSourceState } from '../wilds-steward-construction';
import { checkpointWildsWorld, initialWildsWorldProjection, replayWildsWorld, type WildsWorldCheckpoint, type WildsWorldProjection } from '../wilds-world-state';
import { createWildsWorldEdgeAdmissionQueue, persistWildsWorldCommandDurably } from '../wilds-world-outbox';
import { wildsQualityProfileForTier } from '../wilds-quality-profile';
import { proposeLocalCreation } from '@/lib/receiz/wilds-local-creation-planner';
import { compileCreation, type CreationCompileContext } from './compiler';
import { creationWorldSourceHead } from './world-source';
import { combineCreationTechniques, projectCreationWorkers } from './capabilities';
import { createWorldCreationController } from './world-controller';
import { createCreationPhysicalWorkerClient } from './physical-worker-client';
import type { CreationNavigation } from './navigation';
import WildsCreations from './WildsCreations';

const owner = 'fixture:creation-placement', capturedAt = '2026-10-07T06:00:00.000Z';
const position = { x: 5000, y: 100, z: 5000 };
const storageKey = 'wildz:test-fixture:creation-placement:v1';
const profile = wildsQualityProfileForTier('low', false);

function createFixture() {
  const card = sealCollectedCard({ ownerReceizId: owner, formId: 'mintcub-1', encounterId: 'fixture:creation-placement', capturedAt });
  const conditions = { [card.id]: emptyAdventureCondition(card.id) };
  const harvested = Array.from({ length: 25 }, (_, i) => projectWildsResourceRegion(i - 12, 0)).flat()
    .filter(source => source.kind === 'timber').slice(0, 20)
    .map(source => createWildsMaterialHarvest({ source, current: initialWildsHarvestedSourceState(source), ownerReceizId: owner, actorPosition: source.position, kaiUPulse: 10 }));
  let world: WildsWorldProjection = { ...initialWildsWorldProjection(), materialLots: Object.fromEntries(harvested.map(row => [row.lot.lotId, row.lot])), harvestedSources: Object.fromEntries(harvested.map(row => [row.source.sourceId, row.source])) };
  const saved = sessionStorage.getItem(storageKey);
  if (saved) world = replayWildsWorld([], JSON.parse(saved) as WildsWorldCheckpoint);
  const durable = createReceizInMemoryOfflineProofQueueStorage();
  const queue = createWildsWorldEdgeAdmissionQueue({ initialProjection: world, persist: candidate => persistWildsWorldCommandDurably(candidate, durable) });
  const context: CreationCompileContext = { worldId: world.worldId, spaceId: 'wildz.space.outer.v1', sourceHead: creationWorldSourceHead(world), pose: { position, yaw: 0 }, budget: { timber: harvested.length }, techniques: combineCreationTechniques(projectCreationWorkers([card], conditions)), physical: [], quality: 'low' };
  const proposal = proposeLocalCreation({ requestId: 'fixture:placed-home', actorId: owner, selected: null, message: 'Build a timber home with a usable bed', workers: [], context }, new AbortController().signal);
  if (!('definition' in proposal)) throw Error('creation_fixture_definition_missing');
  const definition = proposal.definition;
  const worker = createCreationPhysicalWorkerClient();
  const controller = createWorldCreationController({ environment: () => ({ ownerId: owner, worldId: world.worldId, spaceId: context.spaceId }), world: queue.current, crew: () => ({ cards: [card], conditions }), position: () => position, compileContext: () => context,
    admit: async (command, beforeAdmit) => {
      const projection = await queue.admit({ schema: 'receiz.wilds_world_outbox_entry.v1', actorId: owner, guestId: 'fixture:creation-placement', command, queuedAt: capturedAt }, { beforeAdmit });
      sessionStorage.setItem(storageKey, JSON.stringify(checkpointWildsWorld(projection)));
      return { projection, events: [] };
    }, project: worker.project });
  return { controller, worker, queue, context, definition, workerId: card.id };
}

class FixtureErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(error: Error) { return { error: error.stack || error.message }; }
  render() { return this.state.error ? <pre data-testid="creation-placement-error">{this.state.error}</pre> : this.props.children; }
}

function PlacementScene({ fixture }: { fixture: ReturnType<typeof createFixture> }) {
  const source = useSyncExternalStore(fixture.controller.subscribe, fixture.controller.snapshot, fixture.controller.snapshot);
  const [navigation, setNavigation] = useState<CreationNavigation | null>(null);
  const [result, setResult] = useState('Ready to build');
  return <>
    <Canvas camera={{ position: [8, 7, 9], fov: 45 }}>
      <ambientLight intensity={1.5} /><directionalLight position={[6, 10, 4]} />
      <gridHelper args={[40, 40, '#607b6c', '#24392c']} />
      <WildsCreations source={source} worldId={fixture.context.worldId} spaceId={fixture.context.spaceId} position={position} profile={profile} onNavigation={setNavigation} />
      <OrbitControls target={[0, 1, 0]} />
    </Canvas>
    <aside style={{ position: 'absolute', zIndex: 10, top: 12, left: 16, background: '#101c18dd', padding: 12, maxWidth: 420 }}>
      <p>Placement regression fixture · synthetic finite resources · real admission, physical worker, scene and saved source replay</p>
      <button disabled={source.projections.length > 0} onClick={() => {
        const plan = compileCreation(fixture.definition, fixture.context);
        if (plan.status !== 'ready') { setResult(JSON.stringify(plan.blockers)); return; }
        setResult('Saving and projecting');
        void fixture.controller.commit(fixture.definition, plan.plan, [fixture.workerId]).then(result => setResult(JSON.stringify(result)));
      }}>Build saved home</button>{' '}
      <button onClick={() => location.reload()}>Reload saved world</button>{' '}
      <button onClick={() => { sessionStorage.removeItem(storageKey); location.reload(); }}>Reset fixture</button>
      <p><output data-testid="creation-placement-state">{result} · admitted: {source.projections.length} · rendered collision: {navigation?.instanceCount ?? 0}</output></p>
    </aside>
  </>;
}

export default function CreationPlacementBrowserFixture() {
  const [fixture, setFixture] = useState<ReturnType<typeof createFixture> | null>(null);
  useEffect(() => {
    const current = createFixture();
    setFixture(current);
    void current.controller.restore();
    return () => { current.controller.close(); current.worker.close(); };
  }, []);
  return <main style={{ position: 'fixed', inset: 0, background: '#101c18', color: '#edf2e5' }}><FixtureErrorBoundary>{fixture ? <PlacementScene fixture={fixture} /> : <p>Preparing placement fixture</p>}</FixtureErrorBoundary></main>;
}
