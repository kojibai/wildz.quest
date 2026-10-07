import assert from 'node:assert/strict';
import { test } from 'node:test';
import type * as THREE from 'three';
import * as birds from '../src/features/play/wilds-ambient-birds';

test('bird anatomy has a rounded body, bilateral articulated wings and a bounded shared mesh', () => {
  const geometry = birds.createWildsAmbientBirdGeometry();
  try {
    const positions = geometry.getAttribute('position'), sides = geometry.getAttribute('birdWingSide');
    assert.ok(positions.count / 3 < 400);
    assert.ok(positions.count > 100);
    assert.ok(Array.from(sides.array).some(side => side === -1));
    assert.ok(Array.from(sides.array).some(side => side === 1));
    assert.ok(Array.from(sides.array).some(side => side === 0));
    assert.ok(Array.from(positions.array).every(Number.isFinite));
    geometry.computeBoundingBox();
    assert.ok(geometry.boundingBox!.max.x > 1 && geometry.boundingBox!.min.x < -1);
    assert.ok(geometry.boundingBox!.max.z > .8 && geometry.boundingBox!.min.z < -.9);
    assert.equal(geometry.getAttribute('color').count, positions.count);
  } finally { geometry.dispose(); }
});

test('repeated wingbeats update one GPU uniform without rewriting geometry or adding materials', () => {
  const time = { value: 0 }, material = birds.createWildsAmbientBirdMaterial(time);
  try {
    const shader = { uniforms: {}, vertexShader: '#include <beginnormal_vertex>\n#include <begin_vertex>', fragmentShader: '' } as Parameters<THREE.Material['onBeforeCompile']>[0];
    material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
    assert.equal(shader.uniforms.wildsBirdTime, time);
    assert.match(shader.vertexShader, /birdFlight/);
    assert.match(shader.vertexShader, /objectNormal/);
    const program = material.customProgramCacheKey();
    for (let frame = 0; frame < 10_000; frame++) {
      time.value = frame / 60;
      assert.equal(shader.uniforms.wildsBirdTime.value, time.value);
      assert.equal(material.customProgramCacheKey(), program);
    }
    assert.equal(material.version, 0);
  } finally { material.dispose(); }
});

test('bird flight repeats a continuous curved route and reuses its mutable frame', () => {
  type Frame = { x: number; y: number; z: number; directionX: number; directionZ: number; pitch: number; bank: number };
  const write = (birds as unknown as { writeWildsAmbientBirdPath?: (out: Frame, path: readonly { x: number; y: number; z: number }[], progress: number) => Frame }).writeWildsAmbientBirdPath;
  assert.equal(typeof write, 'function');
  const path = [{ x: 3, y: 4, z: 0 }, { x: 0, y: 4.2, z: 3 }, { x: -3, y: 4, z: 0 }, { x: 0, y: 3.8, z: -3 }];
  const frame: Frame = { x: 0, y: 0, z: 0, directionX: 0, directionZ: 0, pitch: 0, bank: 0 };
  const seam = { ...write!(frame, path, .999999) }, next = { ...write!(frame, path, .000001) };
  assert.ok(Math.hypot(seam.x-next.x, seam.y-next.y, seam.z-next.z) < .001);
  assert.ok(Math.hypot(seam.directionX-next.directionX, seam.directionZ-next.directionZ) < .001);
  const first = { ...write!(frame, path, .375) };
  assert.deepEqual(write!(frame, path, 1.375), first);
  for (let index = 0; index < 10_000; index++) {
    assert.equal(write!(frame, path, index / 10_000), frame);
    assert.ok(Object.values(frame).every(Number.isFinite));
  }
});
