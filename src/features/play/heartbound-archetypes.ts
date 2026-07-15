import type { HeartboundSpeciesArchetype, HeartboundTemplateId } from "./heartbound-anime-types";
import type { LivingCardGenome } from "./living-card-types";

export type HeartboundArchetypeDefinition = {
  id: HeartboundSpeciesArchetype;
  locomotion: readonly LivingCardGenome["skeleton"]["locomotion"][];
  templates: readonly HeartboundTemplateId[];
  surfaces: readonly LivingCardGenome["surface"]["kind"][];
  gestures: readonly string[];
};

export const heartboundArchetypes: readonly HeartboundArchetypeDefinition[] = [
  { id: "plush-cub", locomotion: ["biped", "quadruped"], templates: ["plush-quadruped", "upright-companion"], surfaces: ["fur"], gestures: ["paw-wave", "tiny-hop", "tail-heart"] },
  { id: "long-ear", locomotion: ["biped", "quadruped"], templates: ["long-ear-companion"], surfaces: ["fur"], gestures: ["ear-flick", "tiny-hop"] },
  { id: "dragon", locomotion: ["biped", "quadruped", "flying"], templates: ["small-dragon", "great-dragon"], surfaces: ["scale", "energy"], gestures: ["wing-bow", "proud-nod"] },
  { id: "bird", locomotion: ["flying", "biped"], templates: ["aerial-bird"], surfaces: ["feather"], gestures: ["wing-bow", "flutter"] },
  { id: "aquatic", locomotion: ["biped", "quadruped", "serpentine"], templates: ["aquatic-friend"], surfaces: ["scale", "shell", "energy"], gestures: ["fin-wave", "bubble-bob"] },
  { id: "spirit", locomotion: ["flying", "serpentine", "biped"], templates: ["floating-spirit"], surfaces: ["energy"], gestures: ["glow-bow", "orbit-spin"] },
  { id: "serpent", locomotion: ["serpentine"], templates: ["serpentine-friend"], surfaces: ["scale", "energy"], gestures: ["coil-heart", "proud-nod"] },
  { id: "guardian", locomotion: ["biped", "quadruped"], templates: ["guardian-beast"], surfaces: ["fur", "shell", "scale"], gestures: ["shield-bow", "proud-nod"] },
  { id: "hybrid", locomotion: ["biped", "quadruped", "flying", "serpentine"], templates: ["compatible-hybrid"], surfaces: ["fur", "feather", "scale", "shell", "energy"], gestures: ["spark-hop", "lineage-bow"] }
] as const;

export function heartboundArchetype(id: HeartboundSpeciesArchetype) {
  return heartboundArchetypes.find((entry) => entry.id === id)!;
}
