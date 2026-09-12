import { canonicalPortableCardJson, sha256PortableBasis } from "./portable-card";
import { verifyWildsConstructionComponent, verifyWildsWorkContribution, type WildsConstructionComponentV1, type WildsConstructionWorkContributionV1 } from "./wilds-construction-component";
import { WILDS_EMISSION_REGION_SIZE } from "./wilds-grove-genesis";
import { compileWildsLivingOperation } from "./wilds-living-operation";
import { settleWildsBuild } from "./wilds-steward-build-settlement";
import type { WildsWorldEmissionProofV1 } from "./wilds-world-emission";

export const WILDS_CONSTRUCTION_WORK_REWARD_POLICY = "wildz.construction-work-reward.v1";

/** One useful, material-backed work step earns Φ0.01 under the existing emission rate.
 * The world reducer must validate stage progress and material custody before admission.
 * A separate policy marker keeps historical, unrewarded construction events replayable.
 */
export function settleWildsConstructionWork(input: {
  component: WildsConstructionComponentV1;
  contribution: WildsConstructionWorkContributionV1;
  currentEmission: WildsWorldEmissionProofV1;
}) {
  const { component, contribution, currentEmission } = input;
  if (!verifyWildsConstructionComponent(component) || !verifyWildsWorkContribution(contribution)
    || contribution.componentId !== component.componentId || contribution.componentHead !== component.head
    || contribution.worker.kind !== "player" || contribution.amount !== 1) {
    throw new Error("wilds_construction_reward_source_invalid");
  }
  const actorId = contribution.worker.receizId;
  const identity = sha256PortableBasis(canonicalPortableCardJson({ policy: WILDS_CONSTRUCTION_WORK_REWARD_POLICY, contributionHead: contribution.head })).replace(/^sha256:/, "");
  const operationId = `construction:work:${identity}`;
  const operation = compileWildsLivingOperation({
    operationId, category: "construction",
    intention: { kind: "construction.component-work", regionId: `region:${Math.floor(component.transform.position.x / WILDS_EMISSION_REGION_SIZE)}:${Math.floor(component.transform.position.z / WILDS_EMISSION_REGION_SIZE)}`,
      componentId: component.componentId, componentHead: component.head, contributionHead: contribution.head, rewardPolicy: WILDS_CONSTRUCTION_WORK_REWARD_POLICY },
    participants: [{ id: actorId, kind: "player", expectedHead: contribution.head, role: "builder" }],
    stages: [{ id: "stage:build", profession: "build", participantIds: [actorId] }],
    consequences: { usefulOutput: 1, ecologicalRenewal: 0, publicBenefit: 0, cooperation: 0, durability: 0, extraction: 0, damage: 0, waste: 0, restorationDebt: 0 },
    kaiUPulse: contribution.kaiUPulse, expiresAtKaiUPulse: contribution.kaiUPulse + 1_000_000,
    semanticIdempotencyKey: operationId
  });
  return { rewardPolicy: WILDS_CONSTRUCTION_WORK_REWARD_POLICY, ...settleWildsBuild({ operation, currentEmission, actorId }) };
}
