import { creatureForm, type CreatureForm } from "./creature-catalog";
import type { PortableCardAsset } from "./portable-card";
import type { WildsV11CreatureBirth } from "./wilds-creature-generator-v11";
import { isAdmittedWildsV11LocalCard, WILDS_V11_LOCAL_CARD_SCHEMA, type WildsV11LocalCard } from "./wilds-portable-card-v11";

/** Shared gameplay fields; progression and exchange eligibility are separate from a birth form. */
export type CreatureFormLike = Pick<CreatureForm,
  "id" | "familyId" | "stage" | "name" | "species" | "habitat" | "element" | "temperament" |
  "role" | "rarity" | "foil" | "stats" | "abilities" | "palette" | "anatomy">;

const NAME_START = ["Ari", "Bela", "Cala", "Dori", "Elya", "Fira", "Galo", "Hela",
  "Iri", "Jora", "Kira", "Luma", "Mira", "Nori", "Ona", "Pera"] as const;
const NAME_END = ["bell", "bloom", "dawn", "fen", "glow", "hollow", "leaf", "lume",
  "moss", "ray", "song", "star", "tail", "vale", "wing", "wood"] as const;
const BODY_SPECIES = { round: "sprig", long: "runner", armored: "guardian", winged: "glider",
  serpentine: "serpent" } as const;
const AURA_ELEMENT = { leaf: "Grove", spark: "Spark", tide: "Tide", ember: "Ember",
  prism: "Prism", stone: "Stone" } as const;

function title(value: string) {
  return value[0]!.toUpperCase() + value.slice(1);
}

/** Consume only cards admitted at their respective verifier boundary. No global form cache is needed. */
export function resolveCardForm(card: PortableCardAsset | WildsV11LocalCard): CreatureFormLike | null {
  if ("schema" in card && card.schema === WILDS_V11_LOCAL_CARD_SCHEMA) {
    if (!isAdmittedWildsV11LocalCard(card)) return null;
    return projectVerifiedBirthFormV11(card.birth.birth, card.id);
  }
  return "manifest" in card ? creatureForm(card.manifest.formId) : null;
}

/** Only call after the complete signed birth has passed the async proof boundary. */
export function projectVerifiedBirthFormV11(birth: WildsV11CreatureBirth, id: string): CreatureFormLike {
  const seed = birth.generationDigest.slice(7);
  const name = `${NAME_START[Number.parseInt(seed.slice(0, 2), 16) % NAME_START.length]}${NAME_END[Number.parseInt(seed.slice(2, 4), 16) % NAME_END.length]}`;
  const abilityPower = 20 + Math.floor(birth.stats.power / 4);
  const ability = (abilityName: string) => ({ name: abilityName,
    text: `${name}'s ${abilityName.toLowerCase()} reflects its proven starting traits.`, power: abilityPower });
  return {
    id,
    familyId: birth.lineage.regionFamily,
    stage: 1,
    name,
    species: `${title(birth.habitat)} ${BODY_SPECIES[birth.body.body]}`,
    habitat: title(birth.habitat),
    element: AURA_ELEMENT[birth.body.aura],
    temperament: birth.temperament,
    role: `A ${birth.temperament} companion with its own journey.`,
    rarity: birth.rarity,
    foil: birth.rarity === "eternal" ? "eternal" : birth.rarity === "mythic" ? "prism"
      : birth.rarity === "rare" ? "shimmer" : "standard",
    stats: birth.stats,
    abilities: [ability(birth.abilities[0]), ability(birth.abilities[1])],
    palette: { primary: birth.surface.primary, accent: birth.surface.accent, glow: birth.surface.glow },
    anatomy: { body: birth.body.body, detail: birth.body.detail, aura: birth.body.aura }
  };
}
