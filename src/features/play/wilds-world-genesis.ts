import { deriveKaiKlokMoment } from "./kai-klok-moment";
import { projectWildsGroveGenesis } from "./wilds-grove-genesis";
import {
  verifyWildsWorldEmissionProof,
  WILDS_REGION_EMISSION_CAPACITY_PHI_MICRO,
  type WildsWorldEmissionProofV1
} from "./wilds-world-emission";

export const WILDS_WORLD_GENESIS_PULSE = "2026-07-15T00:00:00.000Z";

let sourceGenesis: ReturnType<typeof projectWildsGroveGenesis> | null = null;

/** Living-source law, derived once and independent of network projection. */
export function wildsWorldSourceGenesis() {
  return sourceGenesis ??= projectWildsGroveGenesis(deriveKaiKlokMoment({
    occurredAt: WILDS_WORLD_GENESIS_PULSE,
    authority: "world"
  }));
}

export function wildsWorldSourceEmission(projection?: Readonly<{ worldEmission?: WildsWorldEmissionProofV1 | null }> | null) {
  const source = wildsWorldSourceGenesis().emission;
  const candidate = projection?.worldEmission;
  if (!candidate || !verifyWildsWorldEmissionProof(candidate)
    || candidate.revision !== candidate.consumedOperationIds.length
    || new Set(candidate.consumedOperationIds).size !== candidate.consumedOperationIds.length
    || candidate.consumedOperationIds.some((id, index, ids) => index > 0 && ids[index - 1]! >= id)
    || BigInt(candidate.globalRemainingPhiMicro) > BigInt(source.globalRemainingPhiMicro)) return source;
  for (const [regionId, remaining] of Object.entries(candidate.regionRemainingPhiMicro)) {
    const sourceCapacity = source.regionRemainingPhiMicro[regionId] ?? WILDS_REGION_EMISSION_CAPACITY_PHI_MICRO;
    if (BigInt(remaining) > BigInt(sourceCapacity)) return source;
  }
  for (const [contributionClass, remaining] of Object.entries(candidate.classRemainingPhiMicro)) {
    const sourceCapacity = source.classRemainingPhiMicro[contributionClass as keyof typeof source.classRemainingPhiMicro];
    if (sourceCapacity === undefined || BigInt(remaining) > BigInt(sourceCapacity)) return source;
  }
  return candidate;
}
