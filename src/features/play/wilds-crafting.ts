import { canonicalPortableCardJson, sha256PortableBasis } from "./portable-card";

export type CraftInventory = Record<string, number>;
export type CraftRecipe = { id: string; outputKind: string; ingredients: Readonly<Record<string, number>> };
export type CraftResult = { recipeId: string; consumed: CraftInventory; remaining: CraftInventory; output: { id: string; kind: string; ownerReceizId: string; proofDigest: string } };

const RECIPES: Record<string, CraftRecipe> = {
  "ember-sigil": { id: "ember-sigil", outputKind: "ember-sigil", ingredients: { ember_shard: 2, boss_essence: 1 } },
  "tide-relic": { id: "tide-relic", outputKind: "tide-relic", ingredients: { tide_pearl: 3, boss_essence: 1 } }
};

export function recipeFor(id: string): CraftRecipe {
  const recipe = RECIPES[id];
  if (!recipe) throw new Error("craft_recipe_unknown");
  return recipe;
}

export function craftRecipe(input: { recipe: CraftRecipe; inventory: CraftInventory; ownerReceizId: string; craftEventId: string; craftedAt: string }): CraftResult {
  if (!input.ownerReceizId || !input.craftEventId || !Number.isFinite(Date.parse(input.craftedAt))) throw new Error("craft_basis_invalid");
  for (const [material, amount] of Object.entries(input.recipe.ingredients)) if ((input.inventory[material] ?? 0) < amount) throw new Error("insufficient_materials");
  const consumed = Object.fromEntries(Object.entries(input.recipe.ingredients).sort(([a], [b]) => a.localeCompare(b)));
  const remaining = { ...input.inventory };
  for (const [material, amount] of Object.entries(consumed)) remaining[material] = (remaining[material] ?? 0) - amount;
  const outputBasis = { recipeId: input.recipe.id, outputKind: input.recipe.outputKind, ownerReceizId: input.ownerReceizId, craftEventId: input.craftEventId, craftedAt: input.craftedAt, consumed };
  const digest = sha256PortableBasis(canonicalPortableCardJson(outputBasis));
  return { recipeId: input.recipe.id, consumed, remaining, output: { id: `crafted:${digest.slice(7, 31)}`, kind: input.recipe.outputKind, ownerReceizId: input.ownerReceizId, proofDigest: digest } };
}
