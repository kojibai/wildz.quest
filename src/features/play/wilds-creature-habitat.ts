import { creatureForms, type CreatureForm, type CreatureRenderRecipe } from "./creature-catalog";
import type { WildsTerrainSurface } from "./wilds-terrain-authority";

export type WildsAquaticProfile = Readonly<{
  element: string;
  anatomy: CreatureRenderRecipe;
  abilityNames: readonly string[];
}>;

export function isWildsAquaticProfile(input: WildsAquaticProfile) {
  const language = input.abilityNames.join(" ").toLowerCase();
  return input.anatomy.aura === "tide"
    || input.element === "Tide"
    || /swim|aqua|current|tide/.test(language);
}

export function isWildsAquaticForm(form: CreatureForm) {
  return isWildsAquaticProfile({
    element: form.element,
    anatomy: form.anatomy,
    abilityNames: form.abilities.map((ability) => ability.name)
  });
}

const stageOneForms = Object.freeze(creatureForms.filter((form) => form.stage === 1));
const aquaticForms = Object.freeze(stageOneForms.filter(isWildsAquaticForm));
const landForms = Object.freeze(stageOneForms.filter((form) => !isWildsAquaticForm(form)));
export function isWildsClimbingForm(form: CreatureForm) {
  return form.anatomy.body === "long" && form.anatomy.detail === "horns";
}
const climbingForms = Object.freeze(landForms.filter(isWildsClimbingForm));

function seedIndex(seed: number, length: number) {
  const normalized = Number.isFinite(seed) ? ((seed % 1) + 1) % 1 : 0;
  return Math.min(length - 1, Math.floor(normalized * length));
}

export function selectWildsHabitatForm(surface: WildsTerrainSurface, seed: number, options: Readonly<{ climbing?: boolean }> = {}) {
  const forms = options.climbing
    ? climbingForms
    : surface === "shallow-water" || surface === "deep-water" ? aquaticForms : landForms;
  const form = forms[seedIndex(seed, forms.length)];
  if (!form) throw new Error("wilds_habitat_form_partition_empty");
  return form;
}
