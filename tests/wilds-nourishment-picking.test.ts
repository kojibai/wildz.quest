import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createWildsFruitTouchRaycast } from '../src/features/play/wilds-nourishment-picking';

test('fruit accepts a forgiving near tap while a trunk tap remains outside its target', () => {
  const geometry = new THREE.SphereGeometry(1, 8, 6), material = new THREE.MeshBasicMaterial();
  const apples = new THREE.InstancedMesh(geometry, material, 1);
  apples.setMatrixAt(0, new THREE.Matrix4().compose(new THREE.Vector3(.48, 1.7, 0), new THREE.Quaternion(), new THREE.Vector3(.065, .065, .065)));
  // The touch target changes raycasting, never the rendered fruit geometry.
  apples.raycast = createWildsFruitTouchRaycast([.2]);
  try {
    const near = new THREE.Raycaster(new THREE.Vector3(.63, 1.7, 4), new THREE.Vector3(0, 0, -1));
    const picked = near.intersectObject(apples);
    assert.equal(picked.length, 1); assert.equal(picked[0]!.instanceId, 0);
    assert.equal(picked[0]!.object, apples);
    const trunk = new THREE.Raycaster(new THREE.Vector3(0, 1.7, 4), new THREE.Vector3(0, 0, -1));
    assert.equal(trunk.intersectObject(apples).length, 0);
    apples.count = 0;
    assert.equal(near.intersectObject(apples).length, 0, 'depleted fruit must leave no intercepting touch target');
  } finally { geometry.dispose(); material.dispose(); }
});

test('fruit targeting follows translated world roots and respects ray reach', () => {
  const geometry = new THREE.SphereGeometry(1), material = new THREE.MeshBasicMaterial();
  const apples = new THREE.InstancedMesh(geometry, material, 1);
  apples.setMatrixAt(0, new THREE.Matrix4().makeTranslation(.48, 1.7, 0));
  apples.position.set(20, 3, -10); apples.updateMatrixWorld();
  apples.raycast = createWildsFruitTouchRaycast([.2]);
  try {
    const ray = new THREE.Raycaster(new THREE.Vector3(20.63, 4.7, -6), new THREE.Vector3(0, 0, -1), 0, 2);
    assert.equal(ray.intersectObject(apples).length, 0);
    ray.far = 6;
    assert.equal(ray.intersectObject(apples).length, 1);
  } finally { geometry.dispose(); material.dispose(); }
});
