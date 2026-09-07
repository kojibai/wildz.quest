import type { WildsConstructionKind } from "./wilds-world-construction";

export type WildsConstructionStage = "planned" | "framed" | "functional" | "finished";
export type WildsConstructionMaterials = Readonly<{ hay: number; timber: number; stone: number }>;
export type WildsStageCost = Readonly<{
  stage: Exclude<WildsConstructionStage, "planned">;
  materials: WildsConstructionMaterials;
  work: number;
}>;
export type WildsConstructionRecipe = Readonly<{
  kind: WildsConstructionKind;
  stages: readonly [WildsStageCost, WildsStageCost, WildsStageCost];
  functionId: string | null;
  salvagePercent: number;
}>;

function freeze<T>(value: T): T {
  if (Array.isArray(value)) {
    for (const entry of value) freeze(entry);
    return Object.freeze(value);
  }
  if (value && typeof value === "object") {
    for (const entry of Object.values(value as Record<string, unknown>)) freeze(entry);
    return Object.freeze(value);
  }
  return value;
}

type StageTuple = readonly [hay: number, timber: number, stone: number, work: number];
const stage = (name: WildsStageCost["stage"], values: StageTuple): WildsStageCost => freeze({
  stage: name,
  materials: { hay: values[0], timber: values[1], stone: values[2] },
  work: values[3]
});
const recipe = (kind: WildsConstructionKind, framed: StageTuple, functional: StageTuple, finished: StageTuple, functionId: string | null): WildsConstructionRecipe => freeze({
  kind,
  stages: [stage("framed", framed), stage("functional", functional), stage("finished", finished)],
  functionId,
  salvagePercent: 50
});

export const WILDS_CONSTRUCTION_RECIPES: readonly WildsConstructionRecipe[] = freeze([
  recipe("foundation", [0, 0, 2, 1], [0, 1, 1, 1], [1, 0, 0, 1], "support"),
  recipe("floor", [0, 2, 1, 1], [1, 1, 0, 1], [1, 1, 0, 1], "floor"),
  recipe("room", [0, 3, 1, 2], [3, 1, 0, 2], [2, 1, 0, 1], "shelter"),
  recipe("wall", [0, 2, 1, 1], [2, 1, 0, 1], [1, 1, 0, 1], "cover"),
  recipe("roof", [0, 2, 0, 1], [4, 1, 0, 2], [2, 0, 0, 1], "cover"),
  recipe("door", [0, 1, 0, 1], [0, 1, 0, 1], [1, 0, 0, 1], "traversal"),
  recipe("window", [0, 1, 0, 1], [1, 1, 0, 1], [1, 0, 0, 1], "daylight"),
  recipe("column", [0, 1, 1, 1], [0, 1, 1, 1], [1, 0, 0, 1], "support"),
  recipe("stair", [0, 2, 1, 1], [0, 2, 0, 2], [1, 0, 0, 1], "traversal"),
  recipe("bridge", [0, 3, 2, 2], [0, 3, 1, 2], [2, 1, 0, 1], "traversal"),
  recipe("platform", [0, 2, 1, 1], [0, 2, 1, 2], [1, 1, 0, 1], "traversal"),
  recipe("path", [0, 0, 2, 1], [1, 0, 1, 1], [1, 0, 1, 1], "traversal"),
  recipe("storage", [0, 2, 0, 1], [1, 1, 0, 1], [1, 0, 0, 1], "storage"),
  recipe("workshop", [0, 2, 1, 1], [0, 2, 1, 2], [1, 1, 0, 1], "workshop"),
  recipe("habitat", [0, 2, 1, 1], [3, 1, 0, 2], [2, 0, 0, 1], "habitat"),
  recipe("bed", [1, 1, 0, 1], [2, 1, 0, 1], [1, 0, 0, 1], "rest"),
  recipe("hearth", [0, 0, 2, 1], [1, 1, 1, 2], [1, 0, 1, 1], "rest"),
  recipe("light", [0, 1, 1, 1], [1, 0, 0, 1], [1, 0, 0, 1], "light"),
  recipe("garden", [1, 1, 1, 1], [2, 1, 1, 2], [1, 0, 0, 1], "garden"),
  recipe("water", [0, 0, 2, 1], [1, 1, 2, 2], [1, 0, 1, 1], "water"),
  recipe("trim", [1, 1, 0, 1], [1, 1, 0, 1], [1, 0, 0, 1], null),
  recipe("railing", [0, 2, 0, 1], [1, 1, 0, 1], [1, 0, 0, 1], "safety"),
  recipe("partition", [1, 1, 0, 1], [2, 1, 0, 1], [1, 0, 0, 1], "cover")
]);

const RECIPES = new Map(WILDS_CONSTRUCTION_RECIPES.map((value) => [value.kind, value]));

export function wildsConstructionRecipe(kind: WildsConstructionKind): WildsConstructionRecipe {
  const found = RECIPES.get(kind);
  if (!found) throw new Error("wilds_construction_recipe_unknown");
  return found;
}

function includedStages(recipe: WildsConstructionRecipe, target: WildsConstructionStage) {
  if (target === "planned") return [];
  const targetIndex = recipe.stages.findIndex((entry) => entry.stage === target);
  if (targetIndex < 0) throw new Error("wilds_construction_stage_unknown");
  return recipe.stages.slice(0, targetIndex + 1);
}

export function cumulativeWildsConstructionMaterials(recipe: WildsConstructionRecipe, target: WildsConstructionStage): WildsConstructionMaterials {
  return freeze(includedStages(recipe, target).reduce((sum, entry) => ({
    hay: sum.hay + entry.materials.hay,
    timber: sum.timber + entry.materials.timber,
    stone: sum.stone + entry.materials.stone
  }), { hay: 0, timber: 0, stone: 0 }));
}

export function cumulativeWildsConstructionWork(recipe: WildsConstructionRecipe, target: WildsConstructionStage): number {
  return includedStages(recipe, target).reduce((sum, entry) => sum + entry.work, 0);
}
