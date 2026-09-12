const AXES = ["x", "y", "z"] as const;
type Point = { x: number; y: number; z: number };
/** A bounded slab test, independent of collision authority. Only presentation hides. */
export function wildsConstructionOccludesCamera(box: { center: Point; halfExtents: Point }, camera: Point, target: Point) {
  let enter = 0, exit = .94;
  for (const axis of AXES) {
    const delta = target[axis] - camera[axis];
    const low = box.center[axis] - box.halfExtents[axis], high = box.center[axis] + box.halfExtents[axis];
    if (Math.abs(delta) < .00001) { if (camera[axis] < low || camera[axis] > high) return false; continue; }
    const a = (low - camera[axis]) / delta, b = (high - camera[axis]) / delta;
    enter = Math.max(enter, Math.min(a, b)); exit = Math.min(exit, Math.max(a, b));
    if (enter > exit) return false;
  }
  return exit > 0 && enter < .94;
}
