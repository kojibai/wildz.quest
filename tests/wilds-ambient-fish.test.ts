import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { createWildsAmbientFishGeometry, createWildsAmbientFishMaterial } from '../src/features/play/wilds-ambient-fish';
import * as birds from '../src/features/play/wilds-ambient-birds';
import { WILDS_WATERLINE_ELEVATION } from '../src/features/play/wilds-terrain-rendering';
import * as life from '../src/features/play/wilds-ambient-life';
import { mountFrameComponent } from './support/frame-component-harness';

test('fish anatomy has a streamlined body, eyes, paired fins and a vertical forked tail within the shared mesh budget', () => {
  const geometry = createWildsAmbientFishGeometry();
  try {
    const position = geometry.getAttribute('position');
    assert.ok(position.count / 3 < 750);
    assert.ok(position.count / 3 > 300);
    assert.ok(Array.from(position.array).every(Number.isFinite));
    assert.equal(geometry.getAttribute('color').count, position.count);
    assert.equal(geometry.getAttribute('fishScales').count, position.count);
    geometry.computeBoundingBox();
    const bounds = geometry.boundingBox!;
    assert.ok(bounds.max.z > .7 && bounds.min.z < -1.1);
    assert.ok(bounds.max.x > .4 && bounds.min.x < -.4, 'paired pectoral fins');
    const tail = Array.from({ length: position.count }, (_, i) => i).filter(i => position.getZ(i) < -1);
    assert.ok(tail.some(i => position.getY(i) > .4));
    assert.ok(tail.some(i => position.getY(i) < -.4));
    assert.ok(tail.every(i => Math.abs(position.getX(i)) < .01), 'caudal fin is vertical, unlike bird wings');
    assert.equal(geometry.groups.length, 0, 'one material and draw for all anatomical parts');
  } finally { geometry.dispose(); }
});

test('fish swimming and silver scale shading reuse GPU uniforms without geometry uploads', () => {
  const time = { value: 0 }, material = createWildsAmbientFishMaterial(time);
  try {
    const shader = { uniforms: {}, vertexShader: '#include <beginnormal_vertex>\n#include <begin_vertex>', fragmentShader: '#include <color_fragment>' } as Parameters<THREE.Material['onBeforeCompile']>[0];
    material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
    assert.equal(shader.uniforms.wildsFishTime, time);
    assert.match(shader.vertexShader, /transformed\.x \+=/);
    assert.match(shader.vertexShader, /objectNormal\.z -=/);
    assert.match(shader.fragmentShader, /wildsFishScales/);
    const program = material.customProgramCacheKey();
    for (let i = 0; i < 10_000; i++) {
      time.value = i / 60;
      assert.equal(shader.uniforms.wildsFishTime.value, time.value);
      assert.equal(material.customProgramCacheKey(), program);
    }
    assert.equal(material.version, 0);
  } finally { material.dispose(); }
});

test('rendered birds stay above water and fish bodies stay submerged, including formation offsets and shallow water', () => {
  const write = mountFrameComponent('src/features/play/WildsAmbientLife.tsx', ['writeAmbientInstances'], {
    ...birds, WILDS_WATERLINE_ELEVATION, wildsSiteRuntimeGroundY: (_: unknown, __: unknown, ___: unknown, ____: unknown, fallback: number) => fallback
  });
  const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), rotation = new THREE.Quaternion(), scale = new THREE.Vector3();
  const runtime = { matrix, position, quaternion: rotation, rotation: new THREE.Euler(), scale,
    flight: { x: 0, y: 0, z: 0, directionX: 0, directionZ: 0, pitch: 0, bank: 0 } };
  const mesh = new THREE.InstancedMesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial(), 4);
  const matrixAt = new THREE.Matrix4();
  try {
    for (const medium of ['aerial', 'aquatic'] as const) {
      const water = WILDS_WATERLINE_ELEVATION;
      const projection = { medium, phase: .2, speed: .1, variant: 2, members: 4,
        path: [{ x: 0, z: 0, y: water - .03, floorY: water - .06 }, { x: .2, z: .2, y: water - .04, floorY: water - .06 },
          { x: .2, z: 0, y: water - .04, floorY: water - .06 }, { x: 0, z: .2, y: water - .03, floorY: water - .06 }] };
      const members = Array.from({ length: 4 }, (_, member) => ({ life: projection, member }));
      for (let frame = 0; frame < 120; frame++) {
        write.invoke(mesh, members, frame / 10, 4, -2, -3, {}, runtime);
        for (let index = 0; index < 4; index++) {
          mesh.getMatrixAt(index, matrixAt); matrixAt.decompose(position, rotation, scale);
          const worldY = position.y - 3;
          if (medium === 'aerial') assert.ok(worldY > water + .6);
          else {
            assert.ok(worldY + scale.y * .55 < water, 'even the dorsal fin stays submerged');
            assert.ok(worldY - scale.y * .55 > water - .06, 'body clears the seabed');
            assert.ok(scale.x > 0);
          }
        }
      }
    }
  } finally { mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); }
});

test('ambient fish retain two shared instance batches, respect reduced motion, and dispose geometry and materials', () => {
  const path = 'src/features/play/WildsAmbientLife.tsx';
  const members = mountFrameComponent(path, ['membersFor'], { EMPTY_MEMBERS: Object.freeze([]) });
  const write = mountFrameComponent(path, ['writeAmbientInstances'], { ...birds, WILDS_WATERLINE_ELEVATION,
    wildsSiteRuntimeGroundY: (_: unknown, __: unknown, ___: unknown, ____: unknown, fallback: number) => fallback });
  const scene = mountFrameComponent(path, ['WildsAmbientLife'], { ...life, ...birds,
    createWildsAmbientFishGeometry, createWildsAmbientFishMaterial, membersFor: members.invoke,
    writeAmbientInstances: write.invoke });
  const props = { enabled: true, player: { x: -229, z: -299 }, terrainElevation: -2, siteRuntime: {}, qualityProfile: { tier: 'high', reducedMotion: false } };
  const tree = scene.render(props), children = tree.props.children;
  let disposals = 0;
  const resources: THREE.EventDispatcher<any>[] = [];
  for (const child of children) {
    const [geometry, material, count] = child.props.args;
    child.props.ref.current = new THREE.InstancedMesh(geometry, material, count);
    resources.push(geometry, material);
    geometry.addEventListener('dispose', () => disposals++);
    material.addEventListener('dispose', () => disposals++);
  }
  assert.equal(children.length, 2);
  assert.equal(children[0].props.args[0].getAttribute('birdWingSide'), undefined, 'underwater creatures use fish geometry');
  assert.ok(children[0].props.args[2] > 0);
  scene.flushEffects(); scene.frame({ clock: { elapsedTime: 3 } });
  const time = scene.slots.find(slot => slot.value?.value === 3)?.value;
  assert.ok(time);
  const fishGeometry = children[0].props.args[0] as THREE.BufferGeometry;
  const swim = fishGeometry.getAttribute('fishSwim');
  assert.equal(swim.count, children[0].props.args[2]);
  const version = (swim as THREE.InstancedBufferAttribute).version;
  props.qualityProfile.reducedMotion = true;
  scene.render(props); scene.flushEffects(); scene.frame({ clock: { elapsedTime: 9 } });
  assert.equal(time.value, 0);
  assert.equal((swim as THREE.InstancedBufferAttribute).version, version);
  scene.unmount();
  assert.equal(disposals, resources.length);
});
