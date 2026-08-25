import { canonicalPortableCardJson, sha256PortableBasis } from "./portable-card";
import { verifyWildsLivingOperationPlan, type WildsLivingOperationPlanV1 } from "./wilds-living-operation";

export type WildsContributionClass = "ecology" | "construction" | "craft" | "care" | "public" | "experience";

export type WildsWorldEmissionProofV1 = Readonly<{
  schema: "wildz.world-emission-proof.v1";
  epochId: string;
  epochEndsAtKaiUPulse: number;
  policyDigest: string;
  globalRemainingPhiMicro: string;
  regionRemainingPhiMicro: Readonly<Record<string, string>>;
  classRemainingPhiMicro: Readonly<Partial<Record<WildsContributionClass, string>>>;
  consumedOperationIds: readonly string[];
  revision: number;
  parentHead: string | null;
  head: string;
}>;

export type WildsEmissionPreviewV1 = Readonly<{
  eligible: boolean;
  amountPhiMicro: string;
  sourceHead: string;
  reason: "non_regenerative" | "damage_repair_cycle" | "operation_already_consumed" | "epoch_mismatch" | "capacity_unavailable" | null;
  writes: 0;
}>;

const IDENTIFIER = /^[a-z0-9][a-z0-9._:-]{0,159}$/;
const DIGEST = /^(?:sha256:)?[a-f0-9]{64}$/;
const MICRO_PHI = /^(?:0|[1-9][0-9]{0,39})$/;
const MICRO_PHI_PER_CONTRIBUTION = 10_000n;

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

function parseMicroPhi(value: string) {
  if (!MICRO_PHI.test(value)) throw new Error("world_emission_capacity_invalid");
  return BigInt(value);
}

function sortedCapacityRecord<T extends string>(input: Readonly<Record<string, string>>) {
  const entries = Object.entries(input).sort(([left], [right]) => left.localeCompare(right));
  if (entries.length === 0) throw new Error("world_emission_capacity_invalid");
  const output: Partial<Record<T, string>> = {};
  for (const [key, value] of entries) {
    if (!IDENTIFIER.test(key)) throw new Error("world_emission_capacity_invalid");
    output[key as T] = parseMicroPhi(value).toString();
  }
  return output as Record<T, string>;
}

function emissionBasis(proof: Omit<WildsWorldEmissionProofV1, "head">) {
  return canonicalPortableCardJson(proof);
}

function withHead(proof: Omit<WildsWorldEmissionProofV1, "head">): WildsWorldEmissionProofV1 {
  return deepFreeze({ ...proof, head: sha256PortableBasis(emissionBasis(proof)) });
}

function assertEmission(proof: WildsWorldEmissionProofV1) {
  if (!proof || proof.schema !== "wildz.world-emission-proof.v1" || !IDENTIFIER.test(proof.epochId)
    || !Number.isSafeInteger(proof.epochEndsAtKaiUPulse) || proof.epochEndsAtKaiUPulse < 1
    || !DIGEST.test(proof.policyDigest) || !Number.isSafeInteger(proof.revision) || proof.revision < 0
    || (proof.revision === 0 ? proof.parentHead !== null : typeof proof.parentHead !== "string")
    || !Array.isArray(proof.consumedOperationIds)) {
    throw new Error("world_emission_proof_invalid");
  }
  parseMicroPhi(proof.globalRemainingPhiMicro);
  for (const value of Object.values(proof.regionRemainingPhiMicro)) parseMicroPhi(value);
  for (const value of Object.values(proof.classRemainingPhiMicro)) if (value !== undefined) parseMicroPhi(value);
  const { head: _head, ...basis } = proof;
  if (proof.head !== sha256PortableBasis(emissionBasis(basis))) throw new Error("world_emission_head_invalid");
}

export function verifyWildsWorldEmissionProof(proof: WildsWorldEmissionProofV1) {
  try {
    assertEmission(proof);
    return true;
  } catch {
    return false;
  }
}

export function createWildsWorldEmissionGenesis(input: Readonly<{
  epochId: string;
  epochEndsAtKaiUPulse: number;
  globalCapacityPhiMicro: string;
  regionCapacityPhiMicro: Readonly<Record<string, string>>;
  classCapacityPhiMicro: Readonly<Partial<Record<WildsContributionClass, string>>>;
  policyDigest: string;
}>): WildsWorldEmissionProofV1 {
  if (!IDENTIFIER.test(input.epochId) || !Number.isSafeInteger(input.epochEndsAtKaiUPulse)
    || input.epochEndsAtKaiUPulse < 1 || !DIGEST.test(input.policyDigest)) {
    throw new Error("world_emission_genesis_invalid");
  }
  const regions = sortedCapacityRecord<string>(input.regionCapacityPhiMicro);
  const classes = sortedCapacityRecord<WildsContributionClass>(input.classCapacityPhiMicro as Readonly<Record<string, string>>);
  return withHead({
    schema: "wildz.world-emission-proof.v1",
    epochId: input.epochId,
    epochEndsAtKaiUPulse: input.epochEndsAtKaiUPulse,
    policyDigest: input.policyDigest,
    globalRemainingPhiMicro: parseMicroPhi(input.globalCapacityPhiMicro).toString(),
    regionRemainingPhiMicro: regions,
    classRemainingPhiMicro: classes,
    consumedOperationIds: [],
    revision: 0,
    parentHead: null
  });
}

function operationRegion(operation: WildsLivingOperationPlanV1) {
  const regionId = operation.intention.regionId;
  if (typeof regionId !== "string" || !IDENTIFIER.test(regionId)) throw new Error("world_emission_region_invalid");
  return regionId;
}

function previewReason(
  emission: WildsWorldEmissionProofV1,
  operation: WildsLivingOperationPlanV1,
  netContribution: number
): WildsEmissionPreviewV1["reason"] {
  if (emission.consumedOperationIds.includes(operation.operationId)) return "operation_already_consumed";
  if (operation.kaiUPulse > emission.epochEndsAtKaiUPulse) return "epoch_mismatch";
  if (operation.consequences.damage > 0 && operation.consequences.ecologicalRenewal > 0) return "damage_repair_cycle";
  if (netContribution <= 0) return "non_regenerative";
  return null;
}

export function previewWildsEmission(input: Readonly<{
  emission: WildsWorldEmissionProofV1;
  operation: WildsLivingOperationPlanV1;
  contributionClass: WildsContributionClass;
}>): WildsEmissionPreviewV1 {
  assertEmission(input.emission);
  if (!verifyWildsLivingOperationPlan(input.operation).ok) throw new Error("world_emission_operation_invalid");
  const regionId = operationRegion(input.operation);
  const regionCapacity = input.emission.regionRemainingPhiMicro[regionId];
  const classCapacity = input.emission.classRemainingPhiMicro[input.contributionClass];
  if (regionCapacity === undefined || classCapacity === undefined) throw new Error("world_emission_capacity_missing");

  const hasNecessaryCooperation = input.operation.participants.length >= 2
    && input.operation.stages.some((stage) => new Set(stage.participantIds).size >= 2);
  const netContribution = input.operation.netContribution
    - (hasNecessaryCooperation ? 0 : input.operation.consequences.cooperation);
  const reason = previewReason(input.emission, input.operation, netContribution);
  if (reason) return Object.freeze({
    eligible: false,
    amountPhiMicro: "0",
    sourceHead: input.emission.head,
    reason,
    writes: 0
  });

  const requested = BigInt(netContribution) * MICRO_PHI_PER_CONTRIBUTION;
  const amount = [
    requested,
    parseMicroPhi(input.emission.globalRemainingPhiMicro),
    parseMicroPhi(regionCapacity),
    parseMicroPhi(classCapacity)
  ].reduce((lowest, value) => value < lowest ? value : lowest);
  return Object.freeze({
    eligible: amount > 0n,
    amountPhiMicro: amount.toString(),
    sourceHead: input.emission.head,
    reason: amount > 0n ? null : "capacity_unavailable",
    writes: 0
  });
}

export function admitWildsEmission(input: Readonly<{
  emission: WildsWorldEmissionProofV1;
  operation: WildsLivingOperationPlanV1;
  contributionClass: WildsContributionClass;
  preview: WildsEmissionPreviewV1;
}>): WildsWorldEmissionProofV1 {
  const expected = previewWildsEmission(input);
  if (canonicalPortableCardJson(input.preview) !== canonicalPortableCardJson(expected)
    || !expected.eligible || expected.amountPhiMicro === "0") {
    throw new Error("world_emission_preview_mismatch");
  }
  const regionId = operationRegion(input.operation);
  const amount = parseMicroPhi(expected.amountPhiMicro);
  const regionRemainingPhiMicro = {
    ...input.emission.regionRemainingPhiMicro,
    [regionId]: (parseMicroPhi(input.emission.regionRemainingPhiMicro[regionId]!) - amount).toString()
  };
  const classRemainingPhiMicro = {
    ...input.emission.classRemainingPhiMicro,
    [input.contributionClass]: (parseMicroPhi(input.emission.classRemainingPhiMicro[input.contributionClass]!) - amount).toString()
  };
  return withHead({
    schema: "wildz.world-emission-proof.v1",
    epochId: input.emission.epochId,
    epochEndsAtKaiUPulse: input.emission.epochEndsAtKaiUPulse,
    policyDigest: input.emission.policyDigest,
    globalRemainingPhiMicro: (parseMicroPhi(input.emission.globalRemainingPhiMicro) - amount).toString(),
    regionRemainingPhiMicro,
    classRemainingPhiMicro,
    consumedOperationIds: [...input.emission.consumedOperationIds, input.operation.operationId].sort(),
    revision: input.emission.revision + 1,
    parentHead: input.emission.head
  });
}
