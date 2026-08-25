import { canonicalPortableCardJson, sha256PortableBasis } from "./portable-card";

export type WildsLivingOperationCategory =
  | "ecology"
  | "construction"
  | "excavation"
  | "craft"
  | "care"
  | "trade"
  | "experience";

export type WildsLivingParticipantKind = "player" | "creature" | "world" | "structure";

export type WildsContributionVectorV1 = {
  usefulOutput: number;
  ecologicalRenewal: number;
  publicBenefit: number;
  cooperation: number;
  durability: number;
  extraction: number;
  damage: number;
  waste: number;
  restorationDebt: number;
};

export type WildsLivingOperationParticipantV1 = {
  id: string;
  kind: WildsLivingParticipantKind;
  expectedHead: string;
  role: string;
};

export type WildsLivingOperationStageV1 = {
  id: string;
  profession: string;
  participantIds: string[];
};

export type WildsLivingOperationInputV1 = {
  operationId: string;
  category: WildsLivingOperationCategory;
  intention: Readonly<Record<string, unknown>>;
  participants: WildsLivingOperationParticipantV1[];
  stages: WildsLivingOperationStageV1[];
  consequences: WildsContributionVectorV1;
  kaiUPulse: number;
  expiresAtKaiUPulse: number;
  semanticIdempotencyKey: string;
};

export type WildsLivingOperationPlanV1 = Readonly<{
  schema: "wildz.living-operation-plan.v1";
  operationId: string;
  category: WildsLivingOperationCategory;
  intention: Readonly<Record<string, unknown>>;
  participants: readonly Readonly<WildsLivingOperationParticipantV1>[];
  stages: readonly Readonly<WildsLivingOperationStageV1>[];
  consequences: Readonly<WildsContributionVectorV1>;
  netContribution: number;
  kaiUPulse: number;
  expiresAtKaiUPulse: number;
  semanticIdempotencyKey: string;
  authority: "source-proof-objects";
  writes: 0;
  planDigest: string;
}>;

const CATEGORIES = new Set<WildsLivingOperationCategory>([
  "ecology", "construction", "excavation", "craft", "care", "trade", "experience"
]);
const PARTICIPANT_KINDS = new Set<WildsLivingParticipantKind>(["player", "creature", "world", "structure"]);
const IDENTIFIER = /^[a-z0-9][a-z0-9._:-]{0,159}$/;
const HEAD = /^(?:sha256:)?[a-f0-9]{64}$/;
const CONTRIBUTION_KEYS = Object.freeze([
  "usefulOutput",
  "ecologicalRenewal",
  "publicBenefit",
  "cooperation",
  "durability",
  "extraction",
  "damage",
  "waste",
  "restorationDebt"
] as const);

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

function jsonClone<T>(value: T): T {
  try {
    const encoded = canonicalPortableCardJson(value);
    if (encoded === undefined) throw new Error("living_operation_json_invalid");
    return JSON.parse(encoded) as T;
  } catch {
    throw new Error("living_operation_json_invalid");
  }
}

function validIdentifier(value: unknown) {
  return typeof value === "string" && IDENTIFIER.test(value);
}

function validateConsequences(value: WildsContributionVectorV1) {
  if (!value || typeof value !== "object"
    || Object.keys(value).length !== CONTRIBUTION_KEYS.length
    || !CONTRIBUTION_KEYS.every((key) => Number.isSafeInteger(value[key]) && value[key] >= 0 && value[key] <= 1_000_000)) {
    throw new Error("living_operation_contribution_invalid");
  }
}

function planBasis(plan: Omit<WildsLivingOperationPlanV1, "planDigest">) {
  return canonicalPortableCardJson(plan);
}

export function compileWildsLivingOperation(input: WildsLivingOperationInputV1): WildsLivingOperationPlanV1 {
  if (!input || typeof input !== "object" || !validIdentifier(input.operationId)) {
    throw new Error("living_operation_id_invalid");
  }
  if (!CATEGORIES.has(input.category)) throw new Error("living_operation_category_invalid");
  if (!validIdentifier(input.semanticIdempotencyKey)) throw new Error("living_operation_idempotency_invalid");
  if (!Number.isSafeInteger(input.kaiUPulse) || input.kaiUPulse < 0
    || !Number.isSafeInteger(input.expiresAtKaiUPulse)
    || input.expiresAtKaiUPulse <= input.kaiUPulse) {
    throw new Error("living_operation_expiry_invalid");
  }
  if (!input.intention || typeof input.intention !== "object" || Array.isArray(input.intention)
    || !validIdentifier(input.intention.kind)) {
    throw new Error("living_operation_intention_invalid");
  }
  if (!Array.isArray(input.participants) || input.participants.length < 1 || input.participants.length > 32) {
    throw new Error("living_operation_participants_invalid");
  }

  const participantIds = new Set<string>();
  const participants = input.participants.map((participant) => {
    if (!participant || !validIdentifier(participant.id) || !PARTICIPANT_KINDS.has(participant.kind)
      || !HEAD.test(participant.expectedHead) || !validIdentifier(participant.role)) {
      throw new Error("living_operation_participant_invalid");
    }
    if (participantIds.has(participant.id)) throw new Error("living_operation_participant_duplicate");
    participantIds.add(participant.id);
    return { ...participant };
  }).sort((left, right) => left.id.localeCompare(right.id));

  if (!Array.isArray(input.stages) || input.stages.length < 1 || input.stages.length > 64) {
    throw new Error("living_operation_stages_invalid");
  }
  const stageIds = new Set<string>();
  const stages = input.stages.map((stage) => {
    if (!stage || !validIdentifier(stage.id) || !validIdentifier(stage.profession)
      || !Array.isArray(stage.participantIds) || stage.participantIds.length < 1) {
      throw new Error("living_operation_stage_invalid");
    }
    if (stageIds.has(stage.id)) throw new Error("living_operation_stage_duplicate");
    stageIds.add(stage.id);
    const sortedParticipantIds = [...stage.participantIds].sort((left, right) => left.localeCompare(right));
    if (new Set(sortedParticipantIds).size !== sortedParticipantIds.length) {
      throw new Error("living_operation_stage_participant_duplicate");
    }
    if (sortedParticipantIds.some((participantId) => !participantIds.has(participantId))) {
      throw new Error("living_operation_stage_participant_missing");
    }
    return { id: stage.id, profession: stage.profession, participantIds: sortedParticipantIds };
  }).sort((left, right) => left.id.localeCompare(right.id));

  validateConsequences(input.consequences);
  const consequences = { ...input.consequences };
  const netContribution = consequences.usefulOutput
    + consequences.ecologicalRenewal
    + consequences.publicBenefit
    + consequences.cooperation
    + consequences.durability
    - consequences.extraction
    - consequences.damage
    - consequences.waste
    - consequences.restorationDebt;
  if (!Number.isSafeInteger(netContribution)) throw new Error("living_operation_contribution_invalid");

  const basis: Omit<WildsLivingOperationPlanV1, "planDigest"> = {
    schema: "wildz.living-operation-plan.v1",
    operationId: input.operationId,
    category: input.category,
    intention: jsonClone(input.intention),
    participants,
    stages,
    consequences,
    netContribution,
    kaiUPulse: input.kaiUPulse,
    expiresAtKaiUPulse: input.expiresAtKaiUPulse,
    semanticIdempotencyKey: input.semanticIdempotencyKey,
    authority: "source-proof-objects",
    writes: 0
  };
  return deepFreeze({
    ...basis,
    planDigest: sha256PortableBasis(planBasis(basis))
  });
}

export function verifyWildsLivingOperationPlan(value: unknown): Readonly<{ ok: boolean; errors: readonly string[] }> {
  const errors: string[] = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return Object.freeze({ ok: false, errors: Object.freeze(["plan_invalid"]) });
  }
  const candidate = value as Partial<WildsLivingOperationPlanV1>;
  try {
    const rebuilt = compileWildsLivingOperation({
      operationId: candidate.operationId as string,
      category: candidate.category as WildsLivingOperationCategory,
      intention: candidate.intention as Readonly<Record<string, unknown>>,
      participants: jsonClone(candidate.participants) as WildsLivingOperationParticipantV1[],
      stages: jsonClone(candidate.stages) as WildsLivingOperationStageV1[],
      consequences: jsonClone(candidate.consequences) as WildsContributionVectorV1,
      kaiUPulse: candidate.kaiUPulse as number,
      expiresAtKaiUPulse: candidate.expiresAtKaiUPulse as number,
      semanticIdempotencyKey: candidate.semanticIdempotencyKey as string
    });
    if (candidate.schema !== rebuilt.schema) errors.push("plan_schema_invalid");
    if (candidate.authority !== rebuilt.authority) errors.push("plan_authority_invalid");
    if (candidate.writes !== rebuilt.writes) errors.push("plan_writes_invalid");
    if (candidate.netContribution !== rebuilt.netContribution) errors.push("plan_contribution_invalid");
    if (candidate.planDigest !== rebuilt.planDigest) errors.push("plan_digest_invalid");
    if (canonicalPortableCardJson(candidate) !== canonicalPortableCardJson(rebuilt)) errors.push("plan_bytes_invalid");
  } catch {
    errors.push("plan_invalid");
  }
  return Object.freeze({ ok: errors.length === 0, errors: Object.freeze(errors) });
}
