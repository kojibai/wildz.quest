import * as THREE from "three";

export type WildsMovingInstancesRuntime = {
  matrix: THREE.Matrix4;
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  rotation: THREE.Euler;
  scale: THREE.Vector3;
};

export type WildsMovingInstancesTarget = {
  instanceMatrix: { needsUpdate: boolean };
  setMatrixAt: (index: number, matrix: THREE.Matrix4) => void;
};

export function createWildsMovingInstancesRuntime(): WildsMovingInstancesRuntime {
  return {
    matrix: new THREE.Matrix4(),
    position: new THREE.Vector3(),
    quaternion: new THREE.Quaternion(),
    rotation: new THREE.Euler(),
    scale: new THREE.Vector3()
  };
}

export function writeWildsMovingInstances(
  runtime: WildsMovingInstancesRuntime,
  target: WildsMovingInstancesTarget | null,
  count: number,
  elapsedTime: number,
  vertical: boolean
): WildsMovingInstancesRuntime {
  if (!target) return runtime;
  for (let index = 0; index < count; index += 1) {
    const angle = index / count * Math.PI * 2 + elapsedTime * (vertical ? .08 : .16);
    const radius = 1.2 + (index % 3) * .72;
    runtime.position.set(
      Math.cos(angle) * radius,
      vertical ? .42 + Math.sin(elapsedTime * 1.5 + index) * .2 : .34,
      Math.sin(angle) * radius
    );
    runtime.rotation.set(0, -angle, vertical ? .2 : 0);
    runtime.quaternion.setFromEuler(runtime.rotation);
    runtime.scale.set(vertical ? .7 : 1.2, vertical ? 1.6 : .78, vertical ? .7 : .9);
    runtime.matrix.compose(runtime.position, runtime.quaternion, runtime.scale);
    target.setMatrixAt(index, runtime.matrix);
  }
  target.instanceMatrix.needsUpdate = true;
  return runtime;
}
