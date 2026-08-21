import { creatureForms, type CreatureForm } from "./creature-catalog";
import { coverForHabitat, type HiddenHotspot } from "./hidden-hotspots";
import type { KaiKlokMoment } from "./kai-klok-moment";
import { isWildsAquaticForm } from "./wilds-creature-habitat";

function hashUnit(value: string) {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0) / 0xffffffff;
}

export function kaiEncounterCandidates(hotspot: HiddenHotspot) {
  const aquatic = hotspot.cover === "water";
  const partition = creatureForms.filter((form) => form.stage === 1 && isWildsAquaticForm(form) === aquatic);
  const candidates = partition.filter((form) => coverForHabitat(form.habitat, form.positionSeed) === hotspot.cover);
  return candidates.length ? candidates : partition;
}

export function scoreKaiEncounter(form: CreatureForm, moment: KaiKlokMoment) {
  const semantic = `${form.element} ${form.temperament} ${form.role}`.toLowerCase();
  const arkTerms: Record<KaiKlokMoment["ark"], readonly string[]> = {
    Ignite: ["fire", "ember", "root", "brave", "guard"],
    Integrate: ["water", "tide", "flow", "bond", "heal"],
    Harmonize: ["air", "song", "heart", "voice", "bloom"],
    Reflekt: ["light", "mirror", "crystal", "mind", "night"],
    Purify: ["prism", "solar", "storm", "truth", "crown"],
    Dream: ["dream", "moon", "star", "void", "memory"]
  };
  const matches = arkTerms[moment.ark].reduce((sum, term) => sum + (semantic.includes(term) ? 0.12 : 0), 0);
  const geometry = ((form.positionSeed + moment.sides) % Math.max(2, moment.sides)) / Math.max(2, moment.sides) * 0.15;
  return 1 + Math.min(0.75, matches + geometry);
}

export function selectKaiAffinedForm(input: { hotspot: HiddenHotspot; moment: KaiKlokMoment; ownerReceizId: string }) {
  const candidates = kaiEncounterCandidates(input.hotspot);
  return [...candidates].sort((left, right) => {
    const leftNoise = hashUnit(`${input.ownerReceizId}|${input.hotspot.id}|${input.moment.ark}|${input.moment.chakra}|${left.id}`) * 0.72;
    const rightNoise = hashUnit(`${input.ownerReceizId}|${input.hotspot.id}|${input.moment.ark}|${input.moment.chakra}|${right.id}`) * 0.72;
    return (scoreKaiEncounter(right, input.moment) + rightNoise) - (scoreKaiEncounter(left, input.moment) + leftNoise) || left.id.localeCompare(right.id);
  })[0]!;
}

export function applyKaiAffinityToHotspot(hotspot: HiddenHotspot, moment: KaiKlokMoment, ownerReceizId: string): HiddenHotspot {
  const form = selectKaiAffinedForm({ hotspot, moment, ownerReceizId });
  return { ...hotspot, familyId: form.familyId, formId: form.id };
}
