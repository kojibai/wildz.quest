import type { WildsBlueprintPlacement, WildsConstructionKind, WildsConstructionPoint3 } from "./wilds-world-construction";

/** Version two connection geometry; old placements keep their exact replay law. */
export function architecturalSnap(kind: WildsConstructionKind, pointer: WildsConstructionPoint3, support: WildsBlueprintPlacement, rotation: 0 | 1 | 2 | 3) {
  const c = support.geometry.center, h = support.geometry.halfExtents;
  const alongX = Math.abs(pointer.x - c.x) >= Math.abs(pointer.z - c.z);
  const sign = (alongX ? pointer.x - c.x : pointer.z - c.z) < 0 ? -1 : 1;
  if ((kind === "wall" || kind === "partition") && ["foundation", "floor", "platform"].includes(support.kind)) {
    const inset = kind === "wall" ? .15 : .08;
    return { x: c.x + (alongX ? sign * (h.x - inset) : 0), z: c.z + (alongX ? 0 : sign * (h.z - inset)), rotation: (alongX ? 1 : 0) as 0 | 1 | 2 | 3 };
  }
  if (kind === "floor" && support.kind === "floor") {
    return { x: c.x + (alongX ? sign * h.x * 2 : 0), z: c.z + (alongX ? 0 : sign * h.z * 2), rotation, baseY: c.y - h.y };
  }
  if (kind === "roof" && support.kind === "wall") {
    const normalX = support.transform.rotationQuarterTurns % 2 === 1;
    const side = (normalX ? pointer.x - c.x : pointer.z - c.z) < 0 ? -1 : 1;
    return { x: c.x + (normalX ? side * 2.85 : 0), z: c.z + (normalX ? 0 : side * 2.85), rotation };
  }
  if (kind === "door" && ["room", "wall", "partition"].includes(support.kind)) {
    return { rotation: support.transform.rotationQuarterTurns };
  }
  return null;
}
