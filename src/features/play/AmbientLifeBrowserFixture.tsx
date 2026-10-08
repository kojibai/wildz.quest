'use client';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { WildsAmbientLife } from './WildsAmbientLife';
import { projectWildsAmbientLifeNeighborhood } from './wilds-ambient-life';
import { createWildsAmbientFishGeometry, createWildsAmbientFishMaterial } from './wilds-ambient-fish';
import { wildsQualityProfileForTier } from './wilds-quality-profile';
import { admitWildsDiscoveryPhysicalNeighborhood } from './wilds-discovery-sites';
import { prepareWildsSiteRuntime } from './wilds-site-runtime';
import { WILDS_WATERLINE_ELEVATION } from './wilds-terrain-rendering';

function FishDetail({ frozen }: { frozen: boolean }) {
  const time = useMemo(() => ({ value: 0 }), []);
  const geometry = useMemo(() => {
    const result = createWildsAmbientFishGeometry();
    result.setAttribute('fishSwim', new THREE.InstancedBufferAttribute(new Float32Array([0, 12]), 2));
    return result;
  }, []);
  const material = useMemo(() => createWildsAmbientFishMaterial(time), [time]);
  const mesh = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => { mesh.current?.setMatrixAt(0, new THREE.Matrix4()); if (mesh.current) mesh.current.instanceMatrix.needsUpdate = true; }, []);
  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);
  useFrame(({ clock }) => { time.value = frozen ? 0 : clock.elapsedTime; });
  return <instancedMesh args={[geometry, material, 1]} ref={mesh} dispose={null} />;
}

export function AmbientLifeBrowserFixture() {
  const [detail, setDetail] = useState(false), [frozen, setFrozen] = useState(false);
  const setup = useMemo(() => {
    const school = projectWildsAmbientLifeNeighborhood({ x: -229, z: -299 }, 'high').find(life => life.medium === 'aquatic')!;
    const x = school.path.reduce((sum, point) => sum + point.x, 0) / school.path.length;
    const z = school.path.reduce((sum, point) => sum + point.z, 0) / school.path.length;
    const y = school.path.reduce((sum, point) => sum + point.y, 0) / school.path.length;
    return { player: { x, z }, y, siteRuntime: prepareWildsSiteRuntime(admitWildsDiscoveryPhysicalNeighborhood(Math.floor(x / 128), Math.floor(z / 128))) };
  }, []);
  return <main style={{ position: 'fixed', inset: 0, background: '#173e48' }}>
    <Canvas key={String(detail)} dpr={1} camera={{ position: detail ? [2, .2, 1.4] : [1.6, .08, 1.6], fov: 38, near: .01, far: 100 }}>
      <color attach="background" args={['#173e48']} /><fog attach="fog" args={['#173e48', 5, 45]} />
      <hemisphereLight args={['#b9e8e9', '#344735', 2.4]} /><directionalLight intensity={2.8} position={[2, 6, 3]} />
      {detail ? <FishDetail frozen={frozen} /> : <WildsAmbientLife enabled player={setup.player} qualityProfile={wildsQualityProfileForTier('high', frozen)} terrainElevation={setup.y} siteRuntime={setup.siteRuntime} />}
      {!detail ? <mesh position={[0, WILDS_WATERLINE_ELEVATION - setup.y, 0]} rotation={[Math.PI / 2, 0, 0]}><planeGeometry args={[100, 100]} /><meshStandardMaterial color="#53958c" side={THREE.DoubleSide} transparent opacity={.25} /></mesh> : null}
      <mesh position={[0, detail ? -.57 : -.65, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[100, 100]} /><meshStandardMaterial color="#7d8970" roughness={1} /></mesh>
      <OrbitControls target={[0, 0, 0]} enableDamping={false} />
    </Canvas>
    <aside style={{ position: 'absolute', top: 16, left: 16, maxWidth: 320, color: '#f0fff6', background: '#102a32d9', padding: 12, borderRadius: 12 }}>
      <p>Ambient wildlife · {detail ? 'fish anatomy' : 'real projected school underwater'}</p>
      <button onClick={() => setDetail(value => !value)}>{detail ? 'View underwater school' : 'Inspect fish anatomy'}</button>{' '}
      <button onClick={() => setFrozen(value => !value)}>{frozen ? 'Resume swimming' : 'Reduce motion'}</button>
    </aside>
  </main>;
}
