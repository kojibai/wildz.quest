export const WILDS_FIRST_PERSON_DISTANCE = .045;
export const WILDS_FIRST_PERSON_ZOOM_EXIT = .0455;
export type WildsPlayerEyePose = { x: number; y: number; z: number };
type Point = WildsPlayerEyePose;

/** Keep the camera at the rendered binocular midpoint while retaining free look. */
export function writeWildsEmbodiedEyeAnchor(position: Point, target: Point, eye: Point, clearance: number) {
  const dx=position.x-target.x,dy=position.y-target.y,dz=position.z-target.z;
  position.x=eye.x; position.y=eye.y+clearance; position.z=eye.z;
  target.x=position.x-dx; target.y=position.y-dy; target.z=position.z-dz;
}

export function wildsPlayerTapDestination(sleepMode?: string): "dream" | "first-person" {
  return sleepMode === "sleep" || sleepMode === "bed" ? "dream" : "first-person";
}

/** Reuses the existing orbit camera and direction; no second camera or frame loop. */
export function writeWildsPlayerViewPose(position: Point, target: Point, targetY: number, distance: number) {
  const dx = position.x - target.x, dy = position.y - target.y, dz = position.z - target.z;
  const length = Math.hypot(dx, dy, dz);
  const scale = length > 1e-8 ? distance / length : 0;
  target.y = targetY;
  position.x = target.x + dx * scale;
  position.y = target.y + dy * scale;
  position.z = target.z + (length > 1e-8 ? dz * scale : distance);
}

export function wildsFirstPersonZoomedOut(position: Point, target: Point) {
  return Math.hypot(position.x - target.x, position.y - target.y, position.z - target.z) > WILDS_FIRST_PERSON_ZOOM_EXIT;
}

type HitObject = {name: string; parent: HitObject | null; userData: Record<string, unknown>};
/** Resource tap proxies are deliberately wider than their visible models. An
 * actual avatar hit takes precedence over those invisible interaction volumes. */
export function prioritizeWildsLocalPlayerHit<T extends {object: HitObject}>(hits: T[]): T[] {
  const local = hits.findIndex(hit => {
    let object: HitObject | null = hit.object;
    while (object) {if (object.userData.wildsLocalPlayer === true) return true; object = object.parent;}
    return false;
  });
  if (local <= 0 || !hits.slice(0, local).every(hit => hit.object.name === "resource-tap-proxy")) return hits;
  return [hits[local], ...hits.slice(0, local), ...hits.slice(local + 1)];
}
