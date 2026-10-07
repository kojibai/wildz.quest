import type { WildsWorldProjection } from "./wilds-world-state";
import type { WildsAtlasWorldAddition } from "./wilds-world-atlas";
import type { CreationDefinition } from "./creation/types";

function finitePosition(position: { x: number; y: number; z: number }) {
  return [position.x, position.y, position.z].every(Number.isFinite);
}

function creationMapName(definition: CreationDefinition) {
  const seed = definition.seed.trim();
  if (/^farm:/i.test(seed)) return "Farm";
  // Generated seeds identify a proposal; their request IDs are not display names.
  if (!/^(?:local|request|creation|prompt|sha256):/i.test(seed) && !/[a-f\d]{16,}|[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}|[\p{Cc}]/iu.test(seed)) {
    const words = seed.split(/[\s:_-]+/).filter(Boolean);
    if (words.length && words.length <= 6 && words.every(word => word.length <= 24)) {
      return words.map(word => word[0].toUpperCase() + word.slice(1)).join(" ").slice(0, 60);
    }
  }
  const behaviors = new Set(definition.nodes.flatMap(node => node.behaviors.map(behavior => behavior.id)));
  if (behaviors.has("habitat") || definition.nodes.some(node => node.shape.kind === "shell")) return "Shelter";
  if (behaviors.has("garden")) return "Garden";
  if (behaviors.has("storage")) return "Storage";
  if (behaviors.has("bed")) return "Bed";
  if (behaviors.has("tool")) return "Tool";
  if (behaviors.has("weapon")) return "Weapon";
  return "Structure";
}

/** Display admitted durable world records, independent of nearby scene residency. */
export function projectWildsCustomBuildingMap(world: Pick<WildsWorldProjection, "constructionProjects" | "constructionComponents" | "creations">): WildsAtlasWorldAddition[] {
  const groups = new Map<string, { x: number; y: number; z: number; count: number }>();
  for (const component of Object.values(world.constructionComponents)) {
    if (component.evidence.spaceId && component.evidence.spaceId !== "wildz.space.outer.v1") continue;
    const group = groups.get(component.projectId) ?? { x: 0, y: 0, z: 0, count: 0 };
    const position = component.transform.position;
    if (!finitePosition(position)) continue;
    group.x += position.x; group.y += position.y; group.z += position.z; group.count++;
    groups.set(component.projectId, group);
  }
  const projects: WildsAtlasWorldAddition[] = [...groups].flatMap(([id, group]) => {
    const project = world.constructionProjects[id];
    if (![group.x, group.y, group.z].every(Number.isFinite)) return [];
    return project ? [{ id, blueprint: "custom-building" as const, name: project.name,
      pieceCount: group.count, phase: "construction" as const, progress: 0,
      ownerReceizId: project.ownerReceizId,
      position: { x: group.x / group.count, y: group.y / group.count, z: group.z / group.count } }] : [];
  });
  const creations: WildsAtlasWorldAddition[] = Object.values(world.creations ?? {}).flatMap(source => {
    const instance = source.instance;
    if (instance.spaceId !== "wildz.space.outer.v1" || instance.stage === "planned" || instance.stage === "destroyed" || !finitePosition(instance.pose.position)) return [];
    const complete = instance.stage === "functional" || instance.stage === "finished";
    return [{ id: instance.instanceId, blueprint: "custom-building", name: creationMapName(source.command.definition),
      pieceCount: source.command.definition.nodes.length, phase: complete ? "complete" : "construction", progress: complete ? 1 : 0,
      ownerReceizId: instance.ownerId, position: { ...instance.pose.position } }];
  });
  return [...projects, ...creations];
}
