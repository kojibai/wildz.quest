'use client';
import { createWildsClearanceActionWorkerClient } from '@/lib/receiz/wilds-clearance-action-worker-client';
import { createWildsClearancePublicWorkerReader } from './wilds-clearance-public-worker-client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { paidClearanceTrace, clearanceFixtureTree } from './fixtures/clearance-browser-model';
import { initialWildsResourceJournalV128, reduceWildsResourceJournalV128, replayWildsResourceJournalOwnerV128, type WildsResourceJournalV128, type WildsResourceJournalEventV128 } from '@/lib/receiz/wilds-resource-journal-v128';
import { deriveWildsClearanceCommandV128, planWildsClearancePickupV128, type WildsClearancePickupProposalV128, type WildsClearanceAdmissionV128 } from '@/lib/receiz/wilds-clearance-admission-v128';
import { encodeWildsResourceEventV128, decodeWildsResourceEventV128 } from '@/lib/receiz/wilds-resource-event-codec-v128';
import { createWildsClearanceInteraction } from './wilds-building-clearance-interaction';
import { projectWildsBuildingClearancePiles, type WildsClearancePile } from './wilds-building-clearance';
import { WildsBuildingClearancePiles } from './WildsBuildingClearancePiles';
import { createWildzContinuityDatabase } from '@/lib/storage/wildz-indexed-db';
import { createCreationPhysicalStore } from './creation/physical-store';
import { createCreationCurrentSourcePort } from './creation/current-source';
import { createCreationPhysicalWorkerClient } from './creation/physical-worker-client';
import { compileCreation } from './creation/compiler';
import { createCreationDefinition } from './creation/definition';
import { selectCreationResources } from './creation/resources';
import { previewWildsConstructionAdjustment } from './wilds-construction-placement';
import { creationWorldSourceHistory, creationWorldReplacementSafe, creationWorldSourceHead, creationWorldAvailability, compileWorldCreationSource } from './creation/world-source';
import WildsCreations from './creation/WildsCreations';
import { wildsQualityProfileForTier } from './wilds-quality-profile';
import { createWildsConstructionTerrainSelector, sampleWildsConstructionTerrainAt } from './wilds-construction-terrain';
import { sampleWildsBuildGround } from './wilds-build-ground';
import { filterWildsBuildScenery } from './wilds-build-scenery';
import { wildsTerrainObstaclesForTile, WILDS_RENDERED_PHYSICAL_OBSTACLES } from './wilds-terrain-obstacles';
import { previewWildsContinuousBuild } from './wilds-continuous-builder';
import { createWildsSourceAuthorityProjection } from './wilds-source-work-authority';
import { sealCollectedCard, canonicalPortableCardJson, sha256PortableBasis } from './portable-card';
import { availableWildsFood, createWildsNourishmentState, creditWildsImportedPackageFood, consumeWildsNourishment } from './wilds-nourishment';
import { createWildsResourcePackage, parseWildsResourcePackage, serializeWildsResourcePackage, type WildsResourcePackageMember } from './wilds-resource-package';
import { WildsWalletTerminal } from './wallet/WildsWalletTerminal';
import { createWildsWalletControllerState } from './wallet/wilds-wallet-controller';
import { WildzCreatureDrawer } from './WildzCreatureDrawer';
import type { VaultCompanionRosterEntry } from './vault-companion-roster';
import type { WildsWorldProjection } from './wilds-world-state';
const HEAD = '1'.repeat(64), outer = 'wildz.space.outer.v1';
const profile = wildsQualityProfileForTier('low', false);
type Runtime = Awaited<ReturnType<Parameters<typeof createWildsClearanceInteraction>[0]['openRuntime']>>;
type Probe = {
    actions: Record<string, number[]>;
    frames: number[];
    proofReplays: number;
    runtimeOpens: number;
    codecCalls: number;
    gpu: {
        geometries: number;
        textures: number;
        calls: number;
        triangles: number;
    };
    pileMatrices: number;
    checks: Record<string, unknown>;
};
declare global {
    interface Window {
        clearanceQA?: Probe;
    }
}
const noop = () => { };
function FrameMeter({ probe }: {
    probe: Probe;
}) { const { gl, scene } = useThree(); const previous = useRef(0); useFrame(() => { const now = performance.now(); if (previous.current && probe.frames.length < 20000)
    probe.frames.push(now - previous.current); previous.current = now; probe.gpu = { ...gl.info.memory, calls: gl.info.render.calls, triangles: gl.info.render.triangles }; let version = 0; scene.traverse(object => { if (object.name.startsWith('clearance-') && object instanceof THREE.InstancedMesh)
    version += object.instanceMatrix.version; }); probe.pileMatrices = version; }); return null; }
function Ground({ world, point }: {
    world: WildsWorldProjection;
    point: {
        x: number;
        y: number;
        z: number;
    };
}) {
    const [select] = useState(createWildsConstructionTerrainSelector), pads = useMemo(() => select(world), [select, world]);
    const geometry = useMemo(() => { const g = new THREE.PlaneGeometry(70, 70, 70, 70); g.rotateX(-Math.PI / 2); const p = g.attributes.position; for (let i = 0; i < p.count; i++) {
        const x = p.getX(i) + point.x, z = p.getZ(i) + point.z;
        p.setY(i, sampleWildsConstructionTerrainAt(pads, x, z, sampleWildsBuildGround(x, z).elevation) - point.y);
    } g.computeVertexNormals(); return g; }, [pads, point]);
    useEffect(() => () => geometry.dispose(), [geometry]);
    const scenery = useMemo(() => { const x = Math.floor(point.x / 64), z = Math.floor(point.z / 64); return filterWildsBuildScenery(Array.from({ length: 9 }, (_, i) => wildsTerrainObstaclesForTile(x + i % 3 - 1, z + Math.floor(i / 3) - 1)).flat(), pads.filter(p => p.clearsScenery)); }, [pads, point]);
    return <><mesh geometry={geometry} receiveShadow><meshStandardMaterial color="#577c45" roughness={1}/></mesh>{scenery.filter(o => Math.hypot(o.position.x - point.x, o.position.z - point.z) < 32).map(o => <mesh key={o.id} position={[o.position.x - point.x, o.position.y - point.y + .7, o.position.z - point.z]}><coneGeometry args={[o.kind === 'tree' ? .8 : .5, o.kind === 'tree' ? 2.3 : .8, 6]}/><meshStandardMaterial color={o.kind === 'tree' ? '#285d39' : '#848982'}/></mesh>)}</>;
}
/** Disposable local browser harness. No default wallet, identity or runtime
 * opening on mount. Exact native/currentness checks are synthetic test ports;
 * paid replay, finite law, controller, IndexedDB, worker and UI are real. */
export default function BuildingClearanceBrowserFixture() {
    const probe = useRef<Probe>({ actions: {}, frames: [], proofReplays: 0, runtimeOpens: 0, codecCalls: 0, gpu: { geometries: 0, textures: 0, calls: 0, triangles: 0 }, pileMatrices: 0, checks: {} }).current;
    const [world, setWorld] = useState(createWildsSourceAuthorityProjection), [state, setState] = useState<WildsResourceJournalV128 | null>(null), [busy, setBusy] = useState(false), [status, setStatus] = useState('Ready · no runtime opened');
    const journal = useRef<WildsResourceJournalV128 | null>(null), [point, setPoint] = useState(clearanceFixtureTree.position), [viewer, setViewer] = useState(clearanceFixtureTree.position), [scene, setScene] = useState(true), [owner, setOwner] = useState('bob'), [full, setFull] = useState(false), [lost, setLost] = useState(false), [wallet, setWallet] = useState(false), [drawer, setDrawer] = useState(false), [walletPage, setWalletPage] = useState(createWildsWalletControllerState('fixture-key').page);
    const publicReader = useRef<ReturnType<typeof createWildsClearancePublicWorkerReader> | null>(null);
    const testRuntime = useRef<Runtime | null>(null);
    const live = useRef({ owner: 'bob', full: false, lost: false, viewer });
    live.current = { owner, full, lost, viewer };
    useEffect(()=>{const target=probe.checks.motionTarget as typeof viewer|undefined;if(target&&!probe.checks.motionCommittedAt&&viewer.x===target.x&&viewer.z===target.z){probe.checks.motionCommittedAt=performance.now();probe.checks.motionDuringPending=busy;probe.checks.motionState={...viewer};}},[viewer,busy,probe]);
    const [members, setMembers] = useState<WildsResourcePackageMember[]>([]), [packageText, setPackageText] = useState(''), [sent, setSent] = useState(false), [received, setReceived] = useState(false), [receiverFood, setReceiverFood] = useState(() => createWildsNourishmentState('receiver'));
    const head = useRef(HEAD), controllers = useRef(new Map<string, ReturnType<typeof createWildsClearanceInteraction>>()), database = useMemo(() => createWildzContinuityDatabase({ name: 'wildz-disposable-clearance-browser-qa' }), []);
    const adopting = useRef(world);
    const worker = useMemo(createCreationPhysicalWorkerClient, []), store = useMemo(() => createCreationPhysicalStore({ project: worker.project, canReplace: async (before, after, current) => { const record = adopting.current.creations?.[current.instance.instanceId]; return !!record && record.instance.head === current.instance.head && creationWorldSourceHistory(record).some(prior => prior.instance.head === before.head) && creationWorldReplacementSafe(before.solids, after.solids, live.current.viewer); } }), [worker]), [source, setSource] = useState(store.snapshot());
    useEffect(() => { window.clearanceQA = probe; const unsubscribe = store.subscribe(() => setSource(store.snapshot())); return () => { unsubscribe(); store.close(); worker.close(); publicReader.current?.dispose(); delete window.clearanceQA; }; }, [store, worker, probe]);
    const piles = useMemo(() => state ? projectWildsBuildingClearancePiles(Object.values(state.clearances ?? {}), state.clearanceTaken ?? {}) : [], [state]);
    const cards = useMemo(() => Array.from({ length: 68 }, (_, i) => sealCollectedCard({ ownerReceizId: 'bob', formId: 'mintcub-1', encounterId: `clearance-vault-${i}`, capturedAt: '2026-10-10T00:00:00.000Z' })), []);
    const entries = useMemo<readonly VaultCompanionRosterEntry[]>(() => cards.map((asset, i) => ({ asset, name: asset.manifest.name, level: i + 1, xp: i * 10, bond: 100, fatigue: 0, injuryCount: 0, conditionLabel: 'Ready', element: 'Leaf', species: asset.manifest.species, active: i === 0, newlyCaptured: false })), [cards]);
    const nourishment = useMemo(() => creditWildsImportedPackageFood(createWildsNourishmentState(owner), members.filter(m => m.kind === 'food'), { packageId: 'qa:local-credit', receiptId: 'qa:synthetic-admitted' }, 100000400), [members, owner]);
    async function timed(name: string, run: () => Promise<void> | void) { if (busy)
        return; setBusy(true); const start = performance.now(); try {
        await run();
        setStatus(`${name} complete`);
    }
    catch (error) {
        setStatus(`${name}: ${error instanceof Error ? error.message : String(error)}`);
    }
    finally {
        (probe.actions[name] ??= []).push(performance.now() - start);
        setBusy(false);
    } }
    async function adopt(next: WildsWorldProjection) { adopting.current = next; setWorld(next); for (const record of Object.values(next.creations ?? {})) {
        const plan = compileWorldCreationSource(record);
        const port = createCreationCurrentSourcePort({ read: async () => ({ status: 'available', instance: record.instance, definition: record.command.definition, planDigest: plan.digest, source: { fixtureOnly: true } }), authenticateCurrent: async () => true });
        const current = await port.read({ instanceId: record.instance.instanceId, worldId: record.instance.worldId, spaceId: record.instance.spaceId });
        if (current.status !== 'available' || !await store.adoptCurrent(current, plan))
            throw Error('fixture_physical_adoption_failed');
        probe.checks.physicalBounds = store.snapshot().projections.map(p => ({ bounds: p.chunks.map(c => c.bounds), chunks: p.chunks.length }));
    } }
    async function operation(method:string,args:unknown[],initial:unknown={},beforeCommit?:()=>Promise<void>){
      const client=createWildsClearanceActionWorkerClient({worker:()=>new Worker(new URL('./fixtures/clearance-browser.worker.ts',import.meta.url),{type:'module'}),initialize:()=>initial,callback:async()=>{throw Error('fixture_callback_forbidden');}});
      try{const value=await client.run(method,args,beforeCommit) as {current:{state:WildsResourceJournalV128;predecessor:{head:{head:string}};memberCount:number};world?:WildsWorldProjection;point?:typeof point;result?:unknown;probe:{proofReplays:number;codecCalls:number;actions:Record<string,number[]>};checks?:Record<string,unknown>};
      journal.current=value.current.state;setState(value.current.state);head.current=value.current.predecessor.head.head;probe.checks.memberCount=value.current.memberCount;
      probe.proofReplays+=value.probe.proofReplays;probe.codecCalls+=value.probe.codecCalls;for(const [name,times] of Object.entries(value.probe.actions))(probe.actions[name]??=[]).push(...times);Object.assign(probe.checks,value.checks);
      if(value.world)await adopt(value.world);return value;}finally{client.dispose();}
    }
    async function build(kind:'small'|'large'|'foundation'|'many'|'mountain'|'rotated'){
      const value=await operation('deriveClearance',[],{op:'build',kind});setPoint(value.point!);setViewer(value.point!);setMembers([]);controllers.current.clear();
      const selector=createWildsConstructionTerrainSelector(),pads=selector(value.world!),first=Object.values(value.current.state.clearances!)[0];
      probe.checks.baseCorners=first.footprints.every(pad=>[-1,1].every(x=>[-1,1].every(z=>{const c=Math.cos(pad.yaw),s=Math.sin(pad.yaw),px=pad.center.x+x*pad.halfExtents.x*c+z*pad.halfExtents.z*s,pz=pad.center.z-x*pad.halfExtents.x*s+z*pad.halfExtents.z*c;return Math.abs(sampleWildsConstructionTerrainAt(pads,px,pz,sampleWildsBuildGround(px,pz).elevation)-pad.center.y)<1e-5;})));
      probe.checks.yaw=first.footprints.map(p=>p.yaw);probe.checks.expectedYaw=kind==='rotated'?Math.PI/4:0;probe.checks.protectedBodiesPreserved=filterWildsBuildScenery(WILDS_RENDERED_PHYSICAL_OBSTACLES,pads.filter(p=>p.clearsScenery)).length===WILDS_RENDERED_PHYSICAL_OBSTACLES.length;probe.checks.protectedBodies=WILDS_RENDERED_PHYSICAL_OBSTACLES.length;probe.checks.pilesAvoidProtectedBodies=projectWildsBuildingClearancePiles(Object.values(value.current.state.clearances!),{}).every(pile=>WILDS_RENDERED_PHYSICAL_OBSTACLES.every(obstacle=>Math.hypot(pile.position.x-obstacle.position.x,pile.position.z-obstacle.position.z)>=obstacle.radius+.8));probe.checks.treeRemoved=!filterWildsBuildScenery([clearanceFixtureTree],pads.filter(p=>p.clearsScenery)).length;probe.checks.foodPiles=projectWildsBuildingClearancePiles(Object.values(value.current.state.clearances!),{}).filter(p=>p.kind==='food').length;
    }
    function controller(who: string) {
        let existing = controllers.current.get(who);
        if (existing)
            return existing;
        existing = createWildsClearanceInteraction({ database, binding: { keyId: `qa-${who}`, ownerHandle: `${who}.receiz.id`, gameplayOwnerId: who }, live: () => ({ keyId: `qa-${live.current.owner}`, ownerHandle: `${live.current.owner}.receiz.id`, gameplayOwnerId: live.current.owner, player: live.current.viewer, spaceId: outer, kaiUPulse: 100000300 + (Object.values(journal.current?.clearanceTaken ?? {}).reduce((sum, n) => sum + n, 0)), foodRoom: !live.current.full }), flush: async () => { }, openRuntime: async () => {
                probe.runtimeOpens++;
                return testRuntime.current={exchange:{readCurrent:async()=>(await operation('readCurrent',[])).result,recoverClearance:async(id:string)=>(await operation('recoverClearance',[id])).result,deriveClearance:async()=>{throw Error('fixture_derive_unused');},admitClearancePickup:async(proposal:WildsClearancePickupProposalV128,fence?:()=>Promise<void>)=>{const value=await operation('admitClearancePickup',[proposal],{},fence);return live.current.lost&&value.result&&((value.result as WildsClearanceAdmissionV128).status==='admitted')?{status:'pending',attemptId:proposal.command.commandId,members:[],reason:'fixture lost reply'}:value.result;}}} as Runtime;
            }, apply: async (result) => { if (live.current.full)
                return false; setMembers(rows => [...rows, ...result.members.filter(m => !rows.some(row => row.id === m.id))]); return true; } });
        controllers.current.set(who, existing);
        return existing;
    }
    async function collect(pile: WildsClearancePile) { const result = await controller(owner).pickup(pile); probe.checks.lastPickup = result?.status; }
    async function readPublic() { publicReader.current ??= createWildsClearancePublicWorkerReader(); const before = await publicReader.current.read(); const after = await publicReader.current.read(); probe.checks.publicStable = before === after; probe.checks.publicClearances = Object.keys(before?.buildingClearances ?? {}).length; }
    async function race() {
        const pile = piles.find(p => p.kind === 'food' && p.remaining === 1);
        if (!pile || !testRuntime.current)
            throw Error('Leave one food portion and open a test pickup first');
        const before = Number(probe.checks.memberCount), pose = pile.position;
        const racers = ['racer_a', 'racer_b'].map(who => createWildsClearanceInteraction({ database, binding: { keyId: 'qa-' + who, ownerHandle: who + '.receiz.id', gameplayOwnerId: who }, live: () => ({ keyId: 'qa-' + who, ownerHandle: who + '.receiz.id', gameplayOwnerId: who, player: pose, spaceId: outer, kaiUPulse: 100000500, foodRoom: true }), flush: async () => { }, openRuntime: async () => testRuntime.current!, apply: async () => true }));
        const results = await Promise.all(racers.map(c => c.pickup(pile)));
        probe.checks.race = results.map(r => r?.status);
        probe.checks.raceMembers = Number(probe.checks.memberCount) - before;
        probe.checks.raceRemaining = projectWildsBuildingClearancePiles(Object.values(journal.current!.clearances!), journal.current!.clearanceTaken ?? {}).find(p => p.pileId === pile.pileId)?.remaining ?? 0;
    }
    async function transition(){await operation('deriveClearance',[],{op:'transition'});}
    return <main style={{ background: '#10251d', color: '#edfff1', minHeight: '100dvh', padding: 12, fontFamily: 'system-ui' }}><h1>Building clearance QA</h1><p>DISPOSABLE TEST PORTS · synthetic native/currentness · no identity, host publication or funds</p>
 <p><button disabled={busy} onClick={() => void timed('public-read', readPublic)}>Read genuine public source</button></p><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{(['small', 'large', 'foundation', 'many', 'mountain', 'rotated'] as const).map(kind => <button key={kind} disabled={busy} onClick={() => void timed(`placement-${kind}`, () => build(kind))}>Place {kind}</button>)}<button disabled={busy} onClick={() => void timed('preview', () => { const projection = world, request = { pointer: viewer, rotationQuarterTurns: 0, heightStep: 0, surfaceSnap: true, snapVersion: 2 as const, landscapeRule: 'wildz.build-ground.v2' as const }; probe.checks.previewValid = previewWildsContinuousBuild(projection, 'explorer', 'foundation', request).placement.valid; })}>First preview</button><button disabled={busy} onClick={() => void timed('drag', () => { for (let i = 0; i < 60; i++)
        previewWildsContinuousBuild(world, 'explorer', 'foundation', { pointer: { ...viewer, x: viewer.x + i * .05 }, rotationQuarterTurns: 0, heightStep: 0, surfaceSnap: true, snapVersion: 2, landscapeRule: 'wildz.build-ground.v2' }); })}>Drag 60 previews</button></div>
 <p><button onClick={() => {probe.checks.motionPendingAtDispatch=busy;probe.checks.motionDispatchAt=performance.now();probe.checks.motionTarget={...viewer,x:viewer.x+.1};setViewer({ ...viewer, x: viewer.x + .1 });}}>Move actor</button> <button onClick={() => void timed('unchanged', () => { const select = createWildsConstructionTerrainSelector(), first = select(world); for (let i = 0; i < 120; i++)
        if (select({ ...world, revision: world.revision + i }) !== first)
            throw Error('unstable_terrain_projection'); probe.checks.stableTerrain = true; })}>120 unrelated updates</button> <button disabled={busy} onClick={() => void timed('transition', transition)}>Evolve or adjust</button> <button disabled={busy} onClick={() => void timed('race', race)}>Compete last portion</button> <button onClick={() => setScene(v => !v)}>Toggle scene</button> <button onClick={() => setOwner(owner === 'bob' ? 'carol' : 'bob')}>Switch explorer</button> <label><input type="checkbox" checked={full} onChange={e => setFull(e.target.checked)}/>Full pack</label> <label><input type="checkbox" checked={lost} onChange={e => setLost(e.target.checked)}/>Lose reply</label> <button onClick={() => void timed('recover', async () => { const outcome = await controller(owner).resume(); probe.checks.recovered = outcome?.status; })}>Recover pickup</button></p>
 <div style={{ height: 400 }}>{scene ? <Canvas camera={{ position: [15, 18, -25], fov: 50 }}><ambientLight intensity={1.8}/><directionalLight position={[15, 25, 10]}/><Ground world={world} point={point}/><WildsCreations source={source} worldId={world.worldId} spaceId={outer} position={point} profile={profile} onNavigation={navigation => { probe.checks.renderedInstances = navigation?.instanceCount ?? 0; }}/><WildsBuildingClearancePiles piles={piles} player={point} elevation={point.y} onCollect={pile => void timed('pickup', () => collect(pile))}/><mesh position={[viewer.x - point.x, viewer.y - point.y + .8, viewer.z - point.z]}><capsuleGeometry args={[.25, .8, 4, 8]}/><meshStandardMaterial color="#f2d35d"/></mesh><OrbitControls target={[0, 0, 0]}/><FrameMeter probe={probe}/></Canvas> : <p>Scene disposed</p>}</div>
 <p role="status" data-testid="action-status">{status}</p><output data-testid="counts">Explorer {owner} · piles {piles.length} · portions {piles.reduce((n, p) => n + p.remaining, 0)} · wallet {members.length} · food {availableWildsFood(nourishment).length}</output>
 <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{piles.map((pile, i) => <div key={pile.pileId}><button onClick={() => setViewer(pile.position)}>Approach {pile.kind} {i}</button><button disabled={busy} onClick={() => void timed('pickup', () => collect(pile))}>Collect {pile.kind} {i} ({pile.remaining})</button></div>)}</div>
 <p><button disabled={busy} onClick={() => void timed('reload', async () => { await operation('readCurrent',[]); })}>Reload saved quantities</button> <button onClick={() => setWallet(true)}>Open wallet</button> <button onClick={() => setDrawer(true)}>Open Vault 68</button> <button onClick={() => void timed('package', () => { const packed = createWildsResourcePackage({ ownerReceizId: `${owner}.receiz.id`, createdKaiUPulse: 100000400, commandId: 'qa:package', members }); setPackageText(serializeWildsResourcePackage(packed)); })}>Package contents</button> <button disabled={!packageText} onClick={() => { setSent(true); probe.checks.sent = parseWildsResourcePackage(packageText)?.members.length; }}>Send test package</button> <button disabled={!sent} onClick={() => { const packed = parseWildsResourcePackage(packageText)!; const imported = creditWildsImportedPackageFood(createWildsNourishmentState('receiver'), packed.members, { packageId: packed.packageId, receiptId: 'qa:synthetic-receive' }, 100000400); probe.checks.received = packed.members.length; probe.checks.receivedFood = availableWildsFood(imported).length; setReceiverFood(imported); setReceived(true); }}>Receive test package</button> <button disabled={!received} onClick={() => { const item = availableWildsFood(receiverFood)[0]; if (item) {
        const result = consumeWildsNourishment({ state: receiverFood, ownerReceizId: 'receiver', itemId: item.itemId, kaiUPulse: 100000400, reserveMicroBreaths: 0 });
        probe.checks.consumed = result.ok;
        if (result.ok)
            setReceiverFood(result.state);
        setStatus(`Food use ${result.ok}`);
    } }}>Use received food</button></p>
 <WildzCreatureDrawer entries={entries} snap={drawer ? 'expanded' : 'closed'} onSnapChange={snap => setDrawer(snap !== 'closed')} onSelectCard={id => { probe.checks.vaultSelected = id; }} cardOrder="newest" onCardOrderChange={noop}/>
 <WildsWalletTerminal publicUsername={owner} state={{ ...createWildsWalletControllerState('qa-wallet'), open: wallet, page: walletPage, status: 'offline-verified', sourceAuthorityVerified: true }} cards={cards} materialLots={members.flatMap(m => m.kind === 'material' ? [m.materialLot] : [])} nourishment={nourishment} resourceCards={packageText ? [{ id: parseWildsResourcePackage(packageText)!.packageId, title: 'Clearance test package', summary: `${members.length} finite portions`, status: 'packed', transferable: true, unpackable: true, cancellable: false }] : []} onClose={() => setWallet(false)} onNavigate={setWalletPage} onRefresh={noop} onRequestReceive={noop} onLookupRecipient={noop} onSelectRecipient={noop} onReviewAmount={noop} onStage={noop} onAuthorizationPointerStart={noop} onAuthorizationPointerCancel={noop} onRecover={noop} onEditTransfer={noop} onResetTransfer={noop} onListCard={async (card) => { probe.checks.saleSelected = card.id; return null; }} onSendAsset={async (request) => { probe.checks.walletSent = request; return { status: 'sent', message: 'Disposable test port · pending receiver' }; }}/>
 <pre data-testid="metrics" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{JSON.stringify(probe.checks)}</pre></main>;
}
