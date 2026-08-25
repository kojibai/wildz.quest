import { canonicalPortableCardJson, sha256PortableBasis } from "./portable-card";
import { reverifyWildsCreatureMandate, type WildsCreatureMandateV1 } from "./wilds-creature-mandate";
import type { WildsBlueprintPreview, WildsConstructionKind } from "./wilds-world-construction";
import { projectWildsResourceRegion, type WildsResourceKind, type WildsResourceSource } from "./wilds-resource-authority";

// Pure work planning only. Receiz mandate/job execution is intentionally absent
// until the v122 authority contracts are available.

export type WildsWorkProfession = "lumber" | "quarry" | "mine" | "haul" | "burrow" | "shape" | "masonry" | "stabilize" | "underwater-build" | "illuminate" | "survey" | "rescue" | "finish";

export type WildsCreatureWorkPlan = Readonly<{
  schema: "wildz.creature-work-plan-preview.v1";
  planDigest: string;
  blueprintDigest: string;
  valid: boolean;
  reasons: readonly string[];
  stages: readonly Readonly<{
    stageId: string;
    index: number;
    pieceId: string;
    profession: WildsWorkProfession;
    creatureSubjectId: string;
    materialKind: WildsResourceKind;
  }>[];
  pieceRequirements: readonly Readonly<{ pieceId: string; materialKind: WildsResourceKind; capacity: number }>[];
  assignments: readonly Readonly<{ creatureSubjectId: string; creatureHead: string; professions: readonly WildsWorkProfession[] }>[];
  mandates: readonly WildsCreatureMandateV1[];
  allocations: Readonly<{
    resources: readonly Readonly<{ source: WildsResourceSource; sourceHead: string; capacity: number }>[];
    tools: readonly Readonly<{ subjectId: string; head: string; professions: readonly WildsWorkProfession[] }>[];
  }>;
  bounds: Readonly<{ regionX: number; regionZ: number; maxActions: number; expiresAtKaiPulse: string }>;
  physical: false;
  offlineExecution: false;
  execute: "blocked-receiz-v122";
  writes: 0;
}>;

function freeze<T>(value: T): T {
  if (Array.isArray(value)) {
    for (const entry of value) freeze(entry);
    return Object.freeze(value);
  }
  if (value && typeof value === "object") {
    for (const entry of Object.values(value as Record<string, unknown>)) freeze(entry);
    return Object.freeze(value);
  }
  return value;
}

const PIECE_STAGES = Object.freeze({
  foundation: ["survey", "haul", "shape", "stabilize", "finish"],
  room: ["survey", "haul", "masonry", "stabilize", "finish"],
  roof: ["haul", "shape", "stabilize", "finish"],
  door: ["shape", "finish"],
  stair: ["shape", "stabilize", "finish"],
  bridge: ["survey", "haul", "shape", "stabilize", "rescue", "finish"],
  storage: ["haul", "shape", "finish"],
  workshop: ["haul", "masonry", "finish"],
  habitat: ["survey", "shape", "finish"],
  light: ["illuminate", "finish"],
  water: ["survey", "underwater-build", "stabilize", "rescue", "finish"]
} satisfies Record<WildsConstructionKind, readonly WildsWorkProfession[]>);
const TOOL_PROFESSIONS = new Set<WildsWorkProfession>(["lumber", "quarry", "mine", "burrow", "shape", "masonry", "underwater-build", "illuminate"]);
const PIECE_MATERIALS = Object.freeze({
  foundation: { materialKind: "buried", capacity: 3 },
  room: { materialKind: "timber", capacity: 4 },
  roof: { materialKind: "timber", capacity: 3 },
  door: { materialKind: "timber", capacity: 2 },
  stair: { materialKind: "buried", capacity: 2 },
  bridge: { materialKind: "timber", capacity: 4 },
  storage: { materialKind: "timber", capacity: 2 },
  workshop: { materialKind: "buried", capacity: 3 },
  habitat: { materialKind: "fiber", capacity: 3 },
  light: { materialKind: "ore", capacity: 1 },
  water: { materialKind: "aquatic", capacity: 2 }
} satisfies Record<WildsConstructionKind, Readonly<{ materialKind: WildsResourceKind; capacity: number }>>);
const MIN_REGION = -3_906_250;
const MAX_REGION = 3_906_249;

function digest(value: unknown) {
  return sha256PortableBasis(canonicalPortableCardJson(value));
}

export function compileWildsCreatureWorkPlan(input: Readonly<{
  blueprint: WildsBlueprintPreview;
  assignments: readonly Readonly<{ creatureSubjectId: string; creatureHead: string; professions: readonly WildsWorkProfession[] }>[];
  allocations: Readonly<{
    resources: readonly Readonly<{ source: WildsResourceSource; sourceHead: string; capacity: number }>[];
    tools: readonly Readonly<{ subjectId: string; head: string; professions: readonly WildsWorkProfession[] }>[];
  }>;
  bounds: Readonly<{ regionX: number; regionZ: number; maxActions: number; expiresAtKaiPulse: string }>;
  mandates?: readonly WildsCreatureMandateV1[];
}>): WildsCreatureWorkPlan {
  if (!Number.isSafeInteger(input.bounds.maxActions) || input.bounds.maxActions < 1 || input.bounds.maxActions > 128) throw new Error("wilds_work_action_budget_invalid");
  if (!Number.isSafeInteger(input.bounds.regionX) || !Number.isSafeInteger(input.bounds.regionZ)
    || input.bounds.regionX < MIN_REGION || input.bounds.regionX > MAX_REGION
    || input.bounds.regionZ < MIN_REGION || input.bounds.regionZ > MAX_REGION) throw new Error("wilds_work_region_invalid");
  if (!/^(?:0|[1-9]\d{0,77})$/.test(input.bounds.expiresAtKaiPulse)) throw new Error("wilds_work_expiry_invalid");
  if (input.blueprint.pieces.length > 64 || input.assignments.length > 16 || input.allocations.resources.length > 64 || input.allocations.tools.length > 32) throw new Error("wilds_work_plan_bounds_exceeded");
  const reasons: string[] = [];
  if (input.blueprint.pieces.length === 0) reasons.push("blueprint-empty");
  if (input.blueprint.pieces.some((piece) => Math.floor(piece.geometry.center.x / 128) !== input.bounds.regionX || Math.floor(piece.geometry.center.z / 128) !== input.bounds.regionZ)) reasons.push("piece-outside-region");
  const resourceKinds = new Set<WildsResourceKind>(["timber", "stone", "ore", "fiber", "aquatic", "buried"]);
  const canonicalResource = (resource: (typeof input.allocations.resources)[number]) => {
    const source = resource.source;
    if (!source || !Number.isSafeInteger(source.regionX) || !Number.isSafeInteger(source.regionZ) || !Number.isSafeInteger(source.slot)) return false;
    try {
      const canonical = projectWildsResourceRegion(source.regionX, source.regionZ)[source.slot];
      return canonical !== undefined && canonicalPortableCardJson(canonical) === canonicalPortableCardJson(source);
    } catch {
      return false;
    }
  };
  if (input.allocations.resources.length === 0 || input.allocations.resources.some((resource) => !resource.sourceHead || !canonicalResource(resource) || !Number.isSafeInteger(resource.capacity) || resource.capacity <= 0 || resource.capacity > resource.source.capacity)) reasons.push("resource-allocation-required");
  if (input.assignments.some((assignment) => !assignment.creatureSubjectId || !assignment.creatureHead || assignment.professions.length === 0)) reasons.push("assignment-invalid");
  const mandates = input.mandates ? [...input.mandates] : [];
  if (mandates.length > 0) {
    if (mandates.length !== input.assignments.length) reasons.push("mandate-assignment-mismatch");
    const workExpiry = Number(input.bounds.expiresAtKaiPulse);
    for (const assignment of input.assignments) {
      const mandate = mandates.find((candidate) => candidate.creatureSubjectId === assignment.creatureSubjectId);
      if (!mandate) {
        reasons.push("mandate-assignment-mismatch");
        continue;
      }
      if (mandate.creatureHead !== assignment.creatureHead) reasons.push("mandate-creature-head-mismatch");
      const verification = reverifyWildsCreatureMandate(mandate, {
        creatureHead: assignment.creatureHead,
        kaiUPulse: workExpiry,
        revokedMandateIds: []
      });
      if (!verification.ok && !verification.errors.includes("mandate_creature_head_stale")) reasons.push("mandate-invalid");
      if (mandate.region.x !== input.bounds.regionX || mandate.region.z !== input.bounds.regionZ) reasons.push("mandate-region-mismatch");
      if (mandate.maxActions < input.bounds.maxActions) reasons.push("mandate-action-budget-exceeded");
      if (mandate.expiresAtKaiUPulse < workExpiry) reasons.push("mandate-expiry-exceeded");
      if (assignment.professions.some((profession) => !mandate.professions.includes(profession))) reasons.push("mandate-profession-mismatch");
      if (input.allocations.resources.some((resource) => !mandate.allowedResourceIds.includes(resource.source.sourceId))) reasons.push("mandate-resource-mismatch");
    }
  }
  const pieceRequirements = freeze(input.blueprint.pieces.map((piece) => freeze({ pieceId: piece.placementId, ...PIECE_MATERIALS[piece.kind] })));
  const desired = input.blueprint.pieces.flatMap((piece) => PIECE_STAGES[piece.kind].map((profession) => ({ pieceId: piece.placementId, profession, materialKind: PIECE_MATERIALS[piece.kind].materialKind })));
  const participantIds = [
    ...input.assignments.map((assignment) => assignment.creatureSubjectId),
    ...input.allocations.resources.map((resource) => resource.source.sourceId),
    ...input.allocations.tools.map((tool) => tool.subjectId)
  ];
  if (new Set(participantIds).size !== participantIds.length) reasons.push("participant-duplicate");
  const materialCapacity = (kind: WildsResourceKind) => input.allocations.resources.reduce((total, resource) => total + (resource.source.kind === kind && canonicalResource(resource) && Number.isSafeInteger(resource.capacity) && resource.capacity > 0 ? resource.capacity : 0), 0);
  if ([...resourceKinds].some((kind) => materialCapacity(kind) < pieceRequirements.filter((requirement) => requirement.materialKind === kind).reduce((total, requirement) => total + requirement.capacity, 0))) reasons.push("resource-budget-insufficient");
  if (input.allocations.tools.some((tool) => !tool.subjectId || !tool.head || tool.professions.length === 0)
    || desired.some((stage) => TOOL_PROFESSIONS.has(stage.profession) && !input.allocations.tools.some((tool) => tool.professions.includes(stage.profession)))) reasons.push("tool-allocation-required");
  if (desired.length > input.bounds.maxActions) reasons.push("action-budget-exceeded");
  const assigned = (profession: WildsWorkProfession) => input.assignments.find((assignment) => assignment.professions.includes(profession));
  if (desired.some((stage) => !assigned(stage.profession))) reasons.push("profession-unassigned");
  const valid = reasons.length === 0;
  const blueprintDigest = digest(input.blueprint);
  const stages = valid ? freeze(desired.map((stage, index) => {
    const creature = assigned(stage.profession)!;
    return freeze({
      stageId: `work:${digest({ blueprintDigest, pieceId: stage.pieceId, profession: stage.profession, index, creatureSubjectId: creature.creatureSubjectId }).slice(0, 24)}`,
      index,
      pieceId: stage.pieceId,
      profession: stage.profession,
      creatureSubjectId: creature.creatureSubjectId,
      materialKind: stage.materialKind
    });
  })) : freeze([]);
  const basis = {
    schema: "wildz.creature-work-plan-preview.v1",
    blueprintDigest,
    assignments: input.assignments,
    mandates,
    allocations: input.allocations,
    bounds: input.bounds,
    stages,
    pieceRequirements
  };
  return freeze({
    schema: "wildz.creature-work-plan-preview.v1",
    planDigest: digest(basis),
    blueprintDigest,
    valid,
    reasons,
    stages,
    pieceRequirements,
    assignments: input.assignments.map((assignment) => ({ ...assignment, professions: [...assignment.professions] })),
    mandates,
    allocations: {
      resources: input.allocations.resources.map((resource) => ({ source: resource.source, sourceHead: resource.sourceHead, capacity: resource.capacity })),
      tools: input.allocations.tools.map((tool) => ({ ...tool, professions: [...tool.professions] }))
    },
    bounds: { ...input.bounds },
    physical: false,
    offlineExecution: false,
    execute: "blocked-receiz-v122",
    writes: 0
  });
}

export function projectWildsCreatureWorkProgress(plan: WildsCreatureWorkPlan, completedStageIds: readonly string[]) {
  if (!plan.valid) throw new Error("wilds_work_plan_invalid");
  if (completedStageIds.length > plan.stages.length) throw new Error("wilds_work_progress_order_invalid");
  for (let index = 0; index < completedStageIds.length; index += 1) {
    if (completedStageIds[index] !== plan.stages[index]?.stageId) throw new Error("wilds_work_progress_order_invalid");
  }
  return freeze({
    schema: "wildz.creature-work-progress-preview.v1" as const,
    planDigest: plan.planDigest,
    completedStageIds: [...completedStageIds],
    nextStageId: plan.stages[completedStageIds.length]?.stageId ?? null,
    complete: completedStageIds.length === plan.stages.length,
    physical: false as const,
    offlineExecution: false as const,
    writes: 0 as const
  });
}
