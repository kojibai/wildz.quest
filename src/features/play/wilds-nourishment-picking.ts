import * as THREE from 'three';

/** Pointer-only padding around present fruit. No extra rendered mesh, frame work,
 * or target on an empty tree; the stem and resource ring keep their own actions. */
export function createWildsFruitTouchRaycast(radii: readonly number[]): THREE.InstancedMesh['raycast'] {
  const matrix = new THREE.Matrix4(), sphere = new THREE.Sphere(), point = new THREE.Vector3();
  return function (this: THREE.InstancedMesh, raycaster, intersections) {
    const scale = this.matrixWorld.getMaxScaleOnAxis();
    for (let index = 0; index < this.count; index++) {
      const radius = radii[index]; if (!radius || !Number.isFinite(radius)) continue;
      this.getMatrixAt(index, matrix);
      sphere.center.setFromMatrixPosition(matrix).applyMatrix4(this.matrixWorld);
      sphere.radius = radius * scale;
      if (!raycaster.ray.intersectSphere(sphere, point)) continue;
      const distance = raycaster.ray.origin.distanceTo(point);
      if (distance < raycaster.near || distance > raycaster.far) continue;
      intersections.push({ distance, point: point.clone(), object: this, instanceId: index });
    }
  };
}
