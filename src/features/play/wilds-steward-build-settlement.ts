import { canonicalPortableCardJson } from "./portable-card";
import type { WildsLivingOperationPlanV1 } from "./wilds-living-operation";
import { createWildsStewardPhiAward, type WildsStewardPhiAwardV1 } from "./wilds-steward-construction";
import { admitWildsEmission, previewWildsEmission, type WildsWorldEmissionProofV1 } from "./wilds-world-emission";

/** Useful construction may finish even when no lawful reward is available. */
export function settleWildsBuild(input: { operation: WildsLivingOperationPlanV1; currentEmission: WildsWorldEmissionProofV1; actorId: string }): {
  operation: WildsLivingOperationPlanV1; amountPhiMicro: string; emission?: WildsWorldEmissionProofV1; phiAward?: WildsStewardPhiAwardV1;
} {
  const { operation, currentEmission, actorId } = input;
  const preview = previewWildsEmission({ emission: currentEmission, operation, contributionClass: "construction" });
  if (!preview.eligible || preview.amountPhiMicro === "0") return { operation, amountPhiMicro: "0" };
  const emission = admitWildsEmission({ emission: currentEmission, operation, contributionClass: "construction", preview });
  const phiAward = createWildsStewardPhiAward({ ownerReceizId: actorId, operation, currentEmission, nextEmission: emission, amountPhiMicro: preview.amountPhiMicro });
  return { operation, emission, amountPhiMicro: preview.amountPhiMicro, phiAward };
}
export function verifyWildsBuildSettlement(command: { operation?: unknown; emission?: unknown; amountPhiMicro?: unknown; phiAward?: unknown }, expected: ReturnType<typeof settleWildsBuild>) {
  for (const key of ["operation", "emission", "amountPhiMicro", "phiAward"] as const) {
    if (canonicalPortableCardJson(command[key] ?? null) !== canonicalPortableCardJson(expected[key] ?? null)) throw new Error("wilds_world_steward_economy_mismatch");
  }
}
