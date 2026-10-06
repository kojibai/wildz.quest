"use client";
import { memo, useMemo, useEffect, useState, useRef, useSyncExternalStore } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { createCreationRenderGeometry } from './render-geometry';
import { createCreationMaterialLibrary } from './material-library';
import type { CreationPhysicalSnapshot } from './physical-store';
import type { CreationNavigation } from './navigation';
import type { CreationChunk } from './compiler';
import type { CreationPoint } from './types';
import type { WildsQualityProfile } from '../wilds-quality-profile';
import { createCreationSceneRuntime } from './scene-runtime';
import { creationSceneOffset } from './preview';
import { deriveCreationResidencyBudget } from './residency';
const Page = memo(function Page({ chunk, materials, onRendered }: {
    chunk: CreationChunk;
    materials: ReturnType<typeof createCreationMaterialLibrary>;
    onRendered: (id: string, vertices: number) => void;
}) {
    const geometry = useMemo(() => createCreationRenderGeometry(chunk), [chunk]);
    const shared = useMemo(() => chunk.materials.map(m => materials.material(m.material)), [chunk, materials]);
    useEffect(() => { chunk.materials.forEach(m => { void materials.load(m.material); }); }, [chunk, materials]);
    useEffect(() => () => { geometry.dispose(); }, [geometry]);
    return <mesh geometry={geometry} material={shared} onAfterRender={(_renderer, _scene, _camera, _geometry, _material, group) => onRendered(chunk.id, group?.count ?? chunk.positions.length / 3)} castShadow receiveShadow/>;
});
/** Only the admission store can supply source projections. Rendering and collision share paced page residency. */
export default memo(function WildsCreations({ source, worldId, spaceId, position, profile, onNavigation }: {
    source: Pick<CreationPhysicalSnapshot, 'projections' | 'definitions'>;
    worldId: string;
    spaceId: string;
    position: CreationPoint;
    profile: WildsQualityProfile;
    onNavigation: (navigation: CreationNavigation | null) => void;
}) {
    const gl = useThree(state => state.gl), [runtime] = useState(() => createCreationSceneRuntime({ defer: queueMicrotask }));
    const snapshot = useSyncExternalStore(runtime.subscribe, runtime.snapshot, runtime.snapshot), lifecycle = useMemo(() => ({ epoch: 0 }), []);
    const renderMeter = useRef({ calls: 0, triangles: 0 });
    const onRendered = (id: string, vertices: number) => { renderMeter.current.calls++; renderMeter.current.triangles += vertices / 3; runtime.rendered(id); };
    const materialLease = useMemo(() => ({ epoch: 0, library: createCreationMaterialLibrary({ resolution: profile.tier === 'low' ? 256 : 512, anisotropy: Math.min(4, gl.capabilities.getMaxAnisotropy()) }) }), [profile.tier, gl]);
    const materials = materialLease.library;
    useEffect(() => { const epoch = ++materialLease.epoch; return () => { queueMicrotask(() => { if (materialLease.epoch === epoch) materialLease.library.dispose(); }); }; }, [materialLease]);
    const tileX = Math.floor(position.x / 8), tileZ = Math.floor(position.z / 8), height = Math.round(position.y * 4);
    useEffect(() => {
        const budget = deriveCreationResidencyBudget(profile, { drawCalls: Math.max(0, gl.info.render.calls - renderMeter.current.calls), triangles: Math.max(0, gl.info.render.triangles - renderMeter.current.triangles), textureBytes: materials.textureBytes(), maximumTextureBytes: materials.maximumTextureBytes });
        runtime.refresh(source, budget);
        runtime.select({ worldId, spaceId, position: { x: position.x, y: position.y, z: position.z }, radius: 64, limit: 128 });
        // Selection is batched by source/space/quality and a small spatial cell, outside the render callback.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [source, worldId, spaceId, profile, gl, runtime, materials, tileX, tileZ, height]);
    useEffect(() => { onNavigation(snapshot.navigation); }, [snapshot.navigation, onNavigation]);
    useEffect(() => { const epoch = ++lifecycle.epoch; return () => { queueMicrotask(() => { if (lifecycle.epoch === epoch) {
        runtime.close();
        onNavigation(null);
    } }); }; }, [runtime, onNavigation, lifecycle]);
    useFrame(() => { renderMeter.current.calls = 0; renderMeter.current.triangles = 0; runtime.paint(); });
    return <group position={creationSceneOffset(position)} name="source-admitted-creations">{snapshot.renderProjections.map(p => <group key={`${p.instanceId}:${p.head}`} name={p.instanceId}>{p.chunks.map(chunk => <Page key={chunk.id} chunk={chunk} materials={materials} onRendered={onRendered}/>)}</group>)}</group>;
});
