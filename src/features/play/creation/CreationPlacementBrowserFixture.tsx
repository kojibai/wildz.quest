'use client';

import { Component, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode, type ComponentRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
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
import { resolveCreationMovement, type CreationNavigation } from './navigation';
import WildsCreations from './WildsCreations';

const capturedAt = '2026-10-07T06:00:00.000Z';
const position = { x: 5000, y: 100, z: 5000 };
const storageKey = 'wildz:test-fixture:creation-placement:v1';
const profile = wildsQualityProfileForTier('low', false);

export function createPlacementFixture(scope?:{ownerId:string;storageKey:string}) {
  const owner=scope?.ownerId??'fixture:creation-placement',saveKey=scope?.storageKey??storageKey;
  const card = sealCollectedCard({ ownerReceizId: owner, formId: 'mintcub-1', encounterId: 'fixture:creation-placement', capturedAt });
  const conditions = { [card.id]: emptyAdventureCondition(card.id) };
  const harvested = Array.from({ length: 25 }, (_, i) => projectWildsResourceRegion(i - 12, 0)).flat()
    .filter(source => source.kind === 'timber').slice(0, 20)
    .map(source => createWildsMaterialHarvest({ source, current: initialWildsHarvestedSourceState(source), ownerReceizId: owner, actorPosition: source.position, kaiUPulse: 10 }));
  let world: WildsWorldProjection = { ...initialWildsWorldProjection(), materialLots: Object.fromEntries(harvested.map(row => [row.lot.lotId, row.lot])), harvestedSources: Object.fromEntries(harvested.map(row => [row.source.sourceId, row.source])) };
  const saved = sessionStorage.getItem(saveKey);
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
      sessionStorage.setItem(saveKey, JSON.stringify(checkpointWildsWorld(projection)));
      return { projection, events: [] };
    }, project: worker.project });
  return { controller, worker, queue, context, definition, workerId: card.id, card, conditions, owner };
}

class FixtureErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(error: Error) { return { error: error.stack || error.message }; }
  render() { return this.state.error ? <pre data-testid="creation-placement-error">{this.state.error}</pre> : this.props.children; }
}

function PlacementScene({ fixture }: { fixture: ReturnType<typeof createPlacementFixture> }) {
  const source = useSyncExternalStore(fixture.controller.subscribe, fixture.controller.snapshot, fixture.controller.snapshot);
  const [navigation, setNavigation] = useState<CreationNavigation | null>(null);
  const [result, setResult] = useState('Ready to build');
  const [viewer, setViewer] = useState({ ...position, z: position.z - 3.5 });
  const [travel, setTravel] = useState('Outside');
  const [cameraReadout, setCameraReadout] = useState('');
  const [cameraView, setCameraView] = useState<'doorway' | 'inside' | 'wall' | 'outside'>('doorway');
  const world=fixture.queue.current(),carried=Object.values(world.materialLots).filter(lot=>!world.consumedMaterialLots[lot.lotId]).length;
  const move = (x: number, z: number, steps = 1) => {
    if (!navigation?.instanceCount) return;
    let next = viewer, blocked = false;
    for (let i = 0; i < steps; i++) {
      const movement = resolveCreationMovement(navigation, fixture.context.spaceId, next, { x: next.x + x, y: position.y, z: next.z + z });
      next = movement.position; blocked ||= movement.blocked;
    }
    setViewer(next);
    setTravel(`${blocked ? 'Blocked at wall' : 'Walked'} · x ${(next.x - position.x).toFixed(2)} · y ${(next.y - position.y).toFixed(2)} · z ${(next.z - position.z).toFixed(2)}`);
  };
  return <>
    <Canvas camera={{ position: [0, 3, -7], fov: 45, near: .1 }}>
      <ambientLight intensity={1.5} /><directionalLight position={[6, 10, 4]} />
      <gridHelper args={[40, 40, '#607b6c', '#24392c']} />
      <WildsCreations source={source} worldId={fixture.context.worldId} spaceId={fixture.context.spaceId} position={viewer} profile={profile} onNavigation={setNavigation} />
      <mesh position={[0, .8, 0]}><capsuleGeometry args={[.25, .8, 4, 8]} /><meshStandardMaterial color="#83ddb0" /></mesh>
      <PlacementCamera navigation={navigation} viewer={viewer} spaceId={fixture.context.spaceId} view={cameraView} onReadout={setCameraReadout} />
    </Canvas>
    <aside style={{ position: 'absolute', zIndex: 10, top: 12, left: 16, background: '#101c18dd', padding: 12, maxWidth: 420 }}>
      <details open><summary>Building entry checks</summary>
      <p>Placement regression fixture · synthetic finite resources · real admission, physical worker, scene and saved source replay</p>
      <button disabled={source.projections.length > 0} onClick={() => {
        const plan = compileCreation(fixture.definition, fixture.context);
        if (plan.status !== 'ready') { setResult(JSON.stringify(plan.blockers)); return; }
        setResult('Saving and projecting');
        void fixture.controller.commit(fixture.definition, plan.plan, [fixture.workerId]).then(result => setResult(result.status));
      }}>Build saved home</button>{' '}
      <button onClick={() => location.reload()}>Reload saved world</button>{' '}
      <button onClick={() => { sessionStorage.removeItem(storageKey); location.reload(); }}>Reset fixture</button>
      <p><button disabled={!navigation?.instanceCount} onClick={() => move(0, .25, 14)}>Walk through doorway</button>{' '}<button disabled={!navigation?.instanceCount} onClick={() => move(0, -.25, 14)}>Walk outside</button></p>
      <p><button disabled={!navigation?.instanceCount} onClick={() => move(-.25, 0)}>Walk left</button>{' '}<button disabled={!navigation?.instanceCount} onClick={() => move(.25, 0)}>Walk right</button></p>
      <p><button disabled={!navigation?.instanceCount} onClick={() => move(.25, .25, 8)}>Walk diagonally along wall</button></p>
      <p><button onClick={() => setCameraView('inside')}>Camera inside</button>{' '}<button onClick={() => setCameraView('wall')}>Orbit toward wall</button>{' '}<button onClick={() => setCameraView('outside')}>Camera outside</button>{' '}<button onClick={() => setCameraView('doorway')}>Camera doorway</button></p>
      </details>
      <p><output data-testid="creation-placement-state">{result} · admitted: {source.projections.length} · rendered collision: {navigation?.instanceCount ?? 0}</output></p>
      <p><output data-testid="creation-walk-state">{travel}</output></p>
      <p><output data-testid="creation-camera-state">{cameraReadout}</output></p>
      <p><output data-testid="creation-resource-state">Timber carried: {carried} · spent: {Object.keys(world.consumedMaterialLots).length}</output></p>
    </aside>
  </>;
}

function PlacementCamera({ navigation, view, onReadout }: { navigation: CreationNavigation | null; viewer: typeof position; spaceId: string; view: 'doorway' | 'inside' | 'wall' | 'outside'; onReadout: (value: string) => void }) {
  const { camera } = useThree(), controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const desiredCamera = useMemo(() => camera.clone(), [camera]), previous = useRef('');
  useEffect(() => {
    if (view === 'inside') desiredCamera.position.set(0, 1.5, -1.1);
    else if (view === 'wall') desiredCamera.position.set(6, 3, 0);
    else if (view === 'outside') desiredCamera.position.set(12, 3, 0);
    else desiredCamera.position.set(0, 3, -7);
    controls.current?.update();
  }, [desiredCamera, view]);
  useFrame(() => {
    const orbit = controls.current;
    if (!orbit || !navigation) return;
    camera.position.copy(desiredCamera.position);
    camera.lookAt(orbit.target);
    const value = `Camera · x ${camera.position.x.toFixed(2)} · y ${camera.position.y.toFixed(2)} · z ${camera.position.z.toFixed(2)} · distance ${camera.position.distanceTo(orbit.target).toFixed(2)} · free zoom`;
    if (value !== previous.current) { previous.current = value; onReadout(value); }
  }, -.25);
  return <OrbitControls ref={controls} camera={desiredCamera} makeDefault target={[0, .9, 0]} minDistance={.45} maxDistance={12.5} enablePan={false} />;
}

export default function CreationPlacementBrowserFixture() {
  const [fixture, setFixture] = useState<ReturnType<typeof createPlacementFixture> | null>(null);
  useEffect(() => {
    const current = createPlacementFixture();
    setFixture(current);
    void current.controller.restore();
    return () => { current.controller.close(); current.worker.close(); };
  }, []);
  return <main style={{ position: 'fixed', inset: 0, background: '#101c18', color: '#edf2e5' }}><FixtureErrorBoundary>{fixture ? <PlacementScene fixture={fixture} /> : <p>Preparing placement fixture</p>}</FixtureErrorBoundary></main>;
}
