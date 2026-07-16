import { creatureForm } from "../creature-catalog";
import type { HearttreeCardCapability } from "./card-capability";

export type HearttreeAbilityTag =
  | "strike"
  | "guard"
  | "heal"
  | "reveal"
  | "move"
  | "bind"
  | "cleanse"
  | "interrupt"
  | "energize"
  | "break"
  | "support";

export type HearttreeAbilityDefinition = Readonly<{
  id: string;
  sourceName: string;
  slot: 0 | 1;
  tags: readonly HearttreeAbilityTag[];
  element: string;
  power: number;
  range: number;
  windupMs: number;
  activeMs: number;
  recoveryMs: number;
  staminaCost: number;
  cooldownMs: number;
}>;

const elementTags: Readonly<Record<string, readonly HearttreeAbilityTag[]>> = {
  Grove: ["bind", "heal"],
  Spark: ["energize", "interrupt"],
  Tide: ["cleanse", "move"],
  Ember: ["strike", "interrupt"],
  Prism: ["reveal", "support"],
  Stone: ["guard", "break"]
};

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function hearttreeAbilitiesFor(card: HearttreeCardCapability): readonly [HearttreeAbilityDefinition, HearttreeAbilityDefinition] {
  const form = creatureForm(card.formId);
  if (!form || form.element !== card.element) throw new Error("hearttree_ability_form_invalid");
  if (form.abilities.some((ability, index) => ability.name !== card.abilityNames[index])) {
    throw new Error("hearttree_ability_unknown");
  }
  const definition = (slot: 0 | 1): HearttreeAbilityDefinition => {
    const ability = form.abilities[slot];
    return {
      id: `hearttree:${card.formId}:${slot}:${slug(ability.name)}`,
      sourceName: ability.name,
      slot,
      tags: slot === 0 ? [...(elementTags[form.element] ?? ["strike"])] : ["support"],
      element: form.element,
      power: ability.power,
      range: slot === 0 ? 3.25 : 5,
      windupMs: slot === 0 ? 220 : 320,
      activeMs: slot === 0 ? 180 : 240,
      recoveryMs: slot === 0 ? 360 : 480,
      staminaCost: slot === 0 ? 18 : 14,
      cooldownMs: slot === 0 ? 1_400 : 2_200
    };
  };
  return [definition(0), definition(1)];
}

export function hearttreeAbilityById(card: HearttreeCardCapability, abilityId: string) {
  const ability = hearttreeAbilitiesFor(card).find((candidate) => candidate.id === abilityId);
  if (!ability) throw new Error("hearttree_ability_unknown");
  return ability;
}
