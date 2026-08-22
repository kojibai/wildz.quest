export type WildsFlightCameraControlState = {
  dampingFactor: number;
  maxDistance: number;
  minDistance: number;
  minPolarAngle: number;
  maxPolarAngle: number;
  rotateSpeed: number;
  zoomSpeed: number;
};

const GROUND = Object.freeze({ dampingFactor: .08, maxDistance: 12.5, minDistance: 4.4, minPolarAngle: .38, maxPolarAngle: Math.PI / 2.15, rotateSpeed: .62, zoomSpeed: .82 });
const FLIGHT = Object.freeze({ dampingFactor: .11, maxDistance: 15.5, minDistance: 5.1, minPolarAngle: .46, maxPolarAngle: 1.3, rotateSpeed: .56, zoomSpeed: .78 });

export function createWildsFlightCameraControlState(): WildsFlightCameraControlState {
  return { ...GROUND };
}

export function writeWildsFlightCameraControlState(state: WildsFlightCameraControlState, airborne: boolean, deltaSeconds: number) {
  const target = airborne ? FLIGHT : GROUND;
  const delta = Number.isFinite(deltaSeconds) ? Math.max(0, Math.min(.1, deltaSeconds)) : 0;
  const amount = 1 - Math.exp(-12 * delta);
  state.dampingFactor += (target.dampingFactor - state.dampingFactor) * amount;
  state.maxDistance += (target.maxDistance - state.maxDistance) * amount;
  state.minDistance += (target.minDistance - state.minDistance) * amount;
  state.minPolarAngle += (target.minPolarAngle - state.minPolarAngle) * amount;
  state.maxPolarAngle += (target.maxPolarAngle - state.maxPolarAngle) * amount;
  state.rotateSpeed += (target.rotateSpeed - state.rotateSpeed) * amount;
  state.zoomSpeed += (target.zoomSpeed - state.zoomSpeed) * amount;
  return state;
}
