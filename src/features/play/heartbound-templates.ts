import type { HeartboundMaturityBand, HeartboundSpeciesArchetype, HeartboundTemplateId } from "./heartbound-anime-types";
import type { LivingCardGenome } from "./living-card-types";

type MaturityPreset = { headToBody: number; eyeScale: number; limbScale: number; detail: number };
export type HeartboundTemplateDefinition = {
  id: HeartboundTemplateId;
  compatibleArchetypes: readonly HeartboundSpeciesArchetype[];
  locomotion: readonly LivingCardGenome["skeleton"]["locomotion"][];
  faceClearance: number;
  bodyWidth: number;
  maturity: Record<HeartboundMaturityBand, MaturityPreset>;
};

const maturity = (baby = 1.34): Record<HeartboundMaturityBand, MaturityPreset> => ({
  baby: { headToBody: baby, eyeScale: 1.2, limbScale: .78, detail: .35 },
  adolescent: { headToBody: 1.1, eyeScale: 1.08, limbScale: .94, detail: .58 },
  heroic: { headToBody: .94, eyeScale: 1, limbScale: 1.08, detail: .78 },
  legendary: { headToBody: .9, eyeScale: 1.02, limbScale: 1.14, detail: 1 }
});

export const heartboundTemplates: readonly HeartboundTemplateDefinition[] = [
  { id: "plush-quadruped", compatibleArchetypes: ["plush-cub"], locomotion: ["quadruped"], faceClearance: 22, bodyWidth: 1.08, maturity: maturity(1.38) },
  { id: "upright-companion", compatibleArchetypes: ["plush-cub"], locomotion: ["biped"], faceClearance: 24, bodyWidth: .98, maturity: maturity() },
  { id: "long-ear-companion", compatibleArchetypes: ["long-ear"], locomotion: ["biped", "quadruped"], faceClearance: 25, bodyWidth: .9, maturity: maturity(1.4) },
  { id: "small-dragon", compatibleArchetypes: ["dragon"], locomotion: ["biped", "quadruped", "flying"], faceClearance: 27, bodyWidth: 1, maturity: maturity(1.3) },
  { id: "great-dragon", compatibleArchetypes: ["dragon"], locomotion: ["biped", "quadruped", "flying"], faceClearance: 31, bodyWidth: 1.13, maturity: maturity(1.23) },
  { id: "aerial-bird", compatibleArchetypes: ["bird"], locomotion: ["flying", "biped"], faceClearance: 28, bodyWidth: .9, maturity: maturity(1.32) },
  { id: "aquatic-friend", compatibleArchetypes: ["aquatic"], locomotion: ["biped", "quadruped", "serpentine"], faceClearance: 24, bodyWidth: 1.05, maturity: maturity(1.36) },
  { id: "floating-spirit", compatibleArchetypes: ["spirit"], locomotion: ["flying", "serpentine", "biped"], faceClearance: 30, bodyWidth: .92, maturity: maturity(1.42) },
  { id: "serpentine-friend", compatibleArchetypes: ["serpent"], locomotion: ["serpentine"], faceClearance: 26, bodyWidth: .85, maturity: maturity(1.28) },
  { id: "guardian-beast", compatibleArchetypes: ["guardian"], locomotion: ["biped", "quadruped"], faceClearance: 34, bodyWidth: 1.2, maturity: maturity(1.22) },
  { id: "compatible-hybrid", compatibleArchetypes: ["hybrid"], locomotion: ["biped", "quadruped", "flying", "serpentine"], faceClearance: 30, bodyWidth: 1.04, maturity: maturity(1.33) }
] as const;

export function heartboundTemplate(id: HeartboundTemplateId) {
  return heartboundTemplates.find((entry) => entry.id === id)!;
}
