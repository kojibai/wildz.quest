/** Shared closed shell: open front at +Z, solid sides, roof and rear. */
export const WILDS_CAVE_EXTERIOR = Object.freeze([
  { center: { x: 0, y: 1.15, z: -1.7 }, halfExtents: { x: 1.45, y: 1.25, z: .48 } },
  { center: { x: -1.15, y: .95, z: -.85 }, halfExtents: { x: .4, y: 1.2, z: .85 } },
  { center: { x: 1.15, y: .95, z: -.85 }, halfExtents: { x: .4, y: 1.2, z: .85 } },
  { center: { x: 0, y: 2.12, z: -.85 }, halfExtents: { x: 1.3, y: .4, z: .85 } }
]);

export function wildsCaveExteriorSolids(siteKey: string, position: { x: number; y: number; z: number }) {
  return WILDS_CAVE_EXTERIOR.map((box, index) => Object.freeze({
    id: `cave-exterior:${siteKey}:${index}`, siteKey, spaceId: "wildz.space.outer.v1",
    center: Object.freeze({ x: position.x + box.center.x, y: position.y + box.center.y, z: position.z + box.center.z }),
    halfExtents: Object.freeze({ ...box.halfExtents })
  }));
}
