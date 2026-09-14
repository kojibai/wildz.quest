import type { WildsWorldProjection } from "./wilds-world-state";
import type { WildsAtlasWorldAddition } from "./wilds-world-atlas";

/** Display projection of admitted construction. One marker per project, never per frame/piece. */
export function projectWildsCustomBuildingMap(world: Pick<WildsWorldProjection, "constructionProjects" | "constructionComponents">): WildsAtlasWorldAddition[] {
  const groups = new Map<string, { x: number; y: number; z: number; count: number }>();
  for (const component of Object.values(world.constructionComponents)) {
    if (component.evidence.spaceId && component.evidence.spaceId !== "wildz.space.outer.v1") continue;
    const group = groups.get(component.projectId) ?? { x: 0, y: 0, z: 0, count: 0 };
    const position = component.transform.position;
    group.x += position.x; group.y += position.y; group.z += position.z; group.count++;
    groups.set(component.projectId, group);
  }
  return [...groups].flatMap(([id, group]) => {
    const project = world.constructionProjects[id];
    return project ? [{ id, blueprint: "custom-building" as const, name: project.name,
      pieceCount: group.count, phase: "construction" as const, progress: 0,
      ownerReceizId: project.ownerReceizId,
      position: { x: group.x / group.count, y: group.y / group.count, z: group.z / group.count } }] : [];
  });
}
