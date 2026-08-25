import { canonicalPortableCardJson, sha256PortableBasis } from "./portable-card";
import {
  isCanonicalWildsResourceSource,
  projectWildsResourceAvailability,
  type WildsResourceSource,
  type WildsResourceWorkFamily
} from "./wilds-resource-authority";
import { compileWildsLivingOperation, verifyWildsLivingOperationPlan, type WildsLivingOperationPlanV1 } from "./wilds-living-operation";
import { verifyWildsWorldEmissionProof, wildsEmissionRegionRemaining, type WildsWorldEmissionProofV1 } from "./wilds-world-emission";
import { WILDS_EMISSION_REGION_SIZE } from "./wilds-grove-genesis";
import { sampleWildsTerrain, type WildsTerrainSurface } from "./wilds-terrain-authority";

export type WildsBuildMaterialKind = "timber" | "stone";

export type WildsHarvestedSourceStateV1 = Readonly<{
  schema: "wildz.harvested-source-state.v1";
  sourceId: string;
  harvestedCapacity: number;
  lastHarvestKaiPulse: string;
  revision: number;
  parentHead: string | null;
  head: string;
}>;

export type WildsMaterialLotV1 = Readonly<{
  schema: "wildz.material-lot.v1";
  lotId: string;
  kind: WildsBuildMaterialKind;
  quantity: 1;
  quality: 1 | 2 | 3 | 4 | 5;
  ownerReceizId: string;
  source: Readonly<{
    sourceId: string;
    sourceHead: string;
    admittedSourceHead: string;
    kaiUPulse: number;
  }>;
  contributors: Readonly<{ explorerReceizId: string; creatureSubjectId: string; creatureHead: string }>;
  authority: "source-proof-object";
  head: string;
}>;

type WildsStructureBaseV1 = Readonly<{
  schema: "wildz.structure.v1";
  ownerReceizId: string;
  position: Readonly<{ x: number; y: number; z: number }>;
  rotationQuarterTurns: 0 | 1 | 2 | 3;
  stage: "complete";
  consumedLotIds: readonly string[];
  consumedLotHeads: readonly string[];
  materialContributorReceizIds?: readonly string[];
  builder: Readonly<{ creatureSubjectId: string; creatureHead: string }>;
  kaiUPulse: number;
  authority: "source-proof-objects";
  head: string;
}>;

export type WildsTrailShelterV1 = WildsStructureBaseV1 & Readonly<{
  structureId: string;
  blueprint: "trail-shelter";
  materials: Readonly<{ timber: 2; stone: 1 }>;
}>;

export type WildsBridgePhysicalEvidenceV1 = Readonly<{
  centerSurface: "shallow-water" | "deep-water";
  start: Readonly<{ x: number; y: number; z: number; surface: WildsTerrainSurface }>;
  end: Readonly<{ x: number; y: number; z: number; surface: WildsTerrainSurface }>;
  deckY: number;
  halfWidth: 1.5;
  halfLength: 4;
}>;

export type WildsTrailBridgeV1 = WildsStructureBaseV1 & Readonly<{
  structureId: string;
  blueprint: "trail-bridge";
  materials: Readonly<{ timber: 4; stone: 2 }>;
  physical: WildsBridgePhysicalEvidenceV1;
}>;

export type WildsStewardWorkbenchV1 = WildsStructureBaseV1 & Readonly<{
  structureId: string;
  blueprint: "steward-workbench";
  materials: Readonly<{ timber: 3; stone: 2 }>;
}>;

export type WildsTrailCacheV1 = WildsStructureBaseV1 & Readonly<{
  structureId: string;
  blueprint: "trail-cache";
  materials: Readonly<{ timber: 2; stone: 2 }>;
}>;

export type WildsStructureV1 = WildsTrailShelterV1 | WildsTrailBridgeV1 | WildsStewardWorkbenchV1 | WildsTrailCacheV1;

export type WildsStewardToolKind = "steward-axe" | "quarry-pick";

export type WildsStewardToolV1 = Readonly<{
  schema: "wildz.steward-tool.v1";
  toolId: string;
  kind: WildsStewardToolKind;
  capability: "lumber" | "quarry";
  ownerReceizId: string;
  workstationId: string;
  workstationHead: string;
  consumedLotIds: readonly string[];
  consumedLotHeads: readonly string[];
  builder: Readonly<{ creatureSubjectId: string; creatureHead: string }>;
  durability: Readonly<{ remaining: number; capacity: 24 }>;
  revision: number;
  parentHead: string | null;
  kaiUPulse: number;
  authority: "source-proof-objects";
  head: string;
}>;

export type WildsStewardPhiAwardV1 = Readonly<{
  schema: "wildz.steward-phi-award.v1";
  awardId: string;
  ownerReceizId: string;
  amountPhiMicro: string;
  operationId: string;
  operationPlanDigest: string;
  sourceEmissionHead: string;
  admittedEmissionHead: string;
  rail: "settlement";
  authority: "source-proof-objects";
  head: string;
}>;

const ID = /^[a-z0-9][a-z0-9._:-]{0,179}$/i;
const HEAD = /^sha256:[a-f0-9]{64}$/;

function freeze<T>(value: T): T {
  if (Array.isArray(value)) {
    for (const child of value) freeze(child);
    return Object.freeze(value);
  }
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) freeze(child);
  }
  return value;
}

function digest(value: unknown) {
  return sha256PortableBasis(canonicalPortableCardJson(value));
}

function validKai(value: number) {
  return Number.isSafeInteger(value) && value >= 0;
}

function regionId(x: number, z: number) {
  return `region:${Math.floor(x / WILDS_EMISSION_REGION_SIZE)}:${Math.floor(z / WILDS_EMISSION_REGION_SIZE)}`;
}

function operationIdentity(kind: string, sourceHead: string) {
  return digest({ schema: "wildz.steward-operation-identity.v1", kind, sourceHead }).replace(/^sha256:/, "");
}

export function createWildsStewardHarvestOperation(input: Readonly<{
  source: WildsResourceSource;
  currentSource: WildsHarvestedSourceStateV1;
  harvestedSource: WildsHarvestedSourceStateV1;
  lot: WildsMaterialLotV1;
  ownerReceizId: string;
  playerHead: string;
  creatureSubjectId: string;
  creatureHead: string;
  tool?: WildsStewardToolV1 | null;
  nextTool?: WildsStewardToolV1 | null;
  kaiUPulse: number;
}>): WildsLivingOperationPlanV1 {
  if (!verifyWildsHarvestedSourceState(input.currentSource) || !verifyWildsHarvestedSourceState(input.harvestedSource)
    || !verifyWildsMaterialLot(input.lot) || input.currentSource.sourceId !== input.source.sourceId
    || input.harvestedSource.parentHead !== input.currentSource.head || input.harvestedSource.revision !== input.currentSource.revision + 1
    || input.lot.source.sourceHead !== input.currentSource.head || input.lot.source.admittedSourceHead !== input.harvestedSource.head
    || input.lot.ownerReceizId !== input.ownerReceizId || input.lot.contributors.creatureSubjectId !== input.creatureSubjectId
    || input.lot.contributors.creatureHead !== input.creatureHead || input.lot.source.kaiUPulse !== input.kaiUPulse) {
    throw new Error("wilds_steward_operation_source_invalid");
  }
  if (input.tool && (!verifyWildsStewardTool(input.tool) || !input.nextTool || !verifyWildsStewardTool(input.nextTool)
    || input.tool.ownerReceizId !== input.ownerReceizId || input.tool.capability !== input.source.requirements.creature
    || input.nextTool.toolId !== input.tool.toolId || input.nextTool.parentHead !== input.tool.head
    || input.nextTool.revision !== input.tool.revision + 1 || input.nextTool.durability.remaining !== input.tool.durability.remaining - 1)) {
    throw new Error("wilds_steward_operation_tool_invalid");
  }
  if (!input.tool && input.nextTool) throw new Error("wilds_steward_operation_tool_invalid");
  const identity = operationIdentity("harvest", input.lot.head);
  const timber = input.lot.kind === "timber";
  return compileWildsLivingOperation({
    operationId: `steward:harvest:${identity}`,
    category: "construction",
    intention: {
      kind: `steward.harvest-${input.lot.kind}`,
      regionId: regionId(input.source.position.x, input.source.position.z),
      featureId: input.source.sourceId,
      sourceHead: input.currentSource.head,
      admittedSourceHead: input.harvestedSource.head,
      outputLotHead: input.lot.head,
      ...(input.tool ? { toolId: input.tool.toolId, toolSourceHead: input.tool.head, toolAdmittedHead: input.nextTool!.head } : {})
    },
    participants: [
      { id: input.ownerReceizId, kind: "player", expectedHead: input.playerHead, role: "steward" },
      { id: input.creatureSubjectId, kind: "creature", expectedHead: input.creatureHead, role: timber ? "lumber-partner" : "quarry-partner" }
    ],
    stages: [{ id: "stage:cooperative-harvest", profession: timber ? "lumber" : "quarry", participantIds: [input.ownerReceizId, input.creatureSubjectId] }],
    consequences: {
      usefulOutput: input.tool ? 3 : 2,
      ecologicalRenewal: timber ? 1 : 0,
      publicBenefit: 0,
      cooperation: 2,
      durability: input.tool ? 1 : 0,
      extraction: timber ? 1 : 2,
      damage: 0,
      waste: 0,
      restorationDebt: 0
    },
    kaiUPulse: input.kaiUPulse,
    expiresAtKaiUPulse: input.kaiUPulse + 1_000_000,
    semanticIdempotencyKey: `steward:harvest:${identity}`
  });
}

export function createWildsStewardStructureOperation(input: Readonly<{
  structure: WildsStructureV1;
  lots: readonly WildsMaterialLotV1[];
  ownerReceizId: string;
  actorReceizId?: string;
  playerHead: string;
}>): WildsLivingOperationPlanV1 {
  const expectedLotCount = input.structure.consumedLotIds.length;
  const materialOwners = input.structure.materialContributorReceizIds ?? [input.structure.ownerReceizId];
  const actorReceizId = input.actorReceizId ?? input.ownerReceizId;
  if (!verifyWildsStructure(input.structure) || input.structure.ownerReceizId !== input.ownerReceizId
    || input.lots.length !== expectedLotCount || input.lots.some((lot) => !verifyWildsMaterialLot(lot) || !materialOwners.includes(lot.ownerReceizId))
    || canonicalPortableCardJson(input.structure.consumedLotHeads) !== canonicalPortableCardJson([...input.lots].sort((a, b) => a.lotId.localeCompare(b.lotId)).map((lot) => lot.head))) {
    throw new Error("wilds_steward_structure_operation_source_invalid");
  }
  const bridge = input.structure.blueprint === "trail-bridge";
  const identity = operationIdentity(input.structure.blueprint, input.structure.head);
  const playerIds = [...new Set([actorReceizId, input.ownerReceizId, ...materialOwners])].sort();
  const participantIds = [...playerIds, input.structure.builder.creatureSubjectId];
  return compileWildsLivingOperation({
    operationId: `steward:build:${identity}`,
    category: "construction",
    intention: {
      kind: `steward.build-${input.structure.blueprint}`,
      regionId: regionId(input.structure.position.x, input.structure.position.z),
      featureId: input.structure.structureId,
      structureHead: input.structure.head,
      consumedLotHeads: input.structure.consumedLotHeads
    },
    participants: [
      ...playerIds.map((id) => ({ id, kind: "player" as const, expectedHead: id === actorReceizId ? input.playerHead : sha256PortableBasis(id), role: id === actorReceizId ? "steward" : id === input.ownerReceizId ? "site-steward" : "material-contributor" })),
      { id: input.structure.builder.creatureSubjectId, kind: "creature", expectedHead: input.structure.builder.creatureHead, role: "building-partner" }
    ],
    stages: bridge
      ? [
          { id: "stage:survey", profession: "survey", participantIds },
          { id: "stage:haul", profession: "haul", participantIds },
          { id: "stage:stabilize", profession: "stabilize", participantIds },
          { id: "stage:finish", profession: "finish", participantIds }
        ]
      : [{ id: "stage:cooperative-build", profession: "build", participantIds }],
    consequences: bridge
      ? { usefulOutput: 5, ecologicalRenewal: 0, publicBenefit: 5, cooperation: 3, durability: 7, extraction: 6, damage: 0, waste: 0, restorationDebt: 0 }
      : { usefulOutput: 3, ecologicalRenewal: 0, publicBenefit: 2, cooperation: 2, durability: 4, extraction: 3, damage: 0, waste: 0, restorationDebt: 0 },
    kaiUPulse: input.structure.kaiUPulse,
    expiresAtKaiUPulse: input.structure.kaiUPulse + 1_000_000,
    semanticIdempotencyKey: `steward:build:${identity}`
  });
}

export function createWildsStewardToolOperation(input: Readonly<{
  tool: WildsStewardToolV1;
  lots: readonly WildsMaterialLotV1[];
  workstation: WildsStewardWorkbenchV1;
  ownerReceizId: string;
  playerHead: string;
}>): WildsLivingOperationPlanV1 {
  const orderedLots = [...input.lots].sort((left, right) => left.lotId.localeCompare(right.lotId));
  if (!verifyWildsStewardTool(input.tool) || input.tool.revision !== 0 || input.tool.ownerReceizId !== input.ownerReceizId
    || !verifyWildsStructure(input.workstation) || input.workstation.blueprint !== "steward-workbench"
    || input.tool.workstationId !== input.workstation.structureId || input.tool.workstationHead !== input.workstation.head
    || canonicalPortableCardJson(input.tool.consumedLotHeads) !== canonicalPortableCardJson(orderedLots.map((lot) => lot.head))
    || orderedLots.some((lot) => !verifyWildsMaterialLot(lot) || lot.ownerReceizId !== input.ownerReceizId)) {
    throw new Error("wilds_steward_tool_operation_source_invalid");
  }
  const participantIds = [input.ownerReceizId, input.tool.builder.creatureSubjectId];
  const identity = operationIdentity(input.tool.kind, input.tool.head);
  return compileWildsLivingOperation({
    operationId: `steward:craft:${identity}`,
    category: "construction",
    intention: {
      kind: `steward.craft-${input.tool.kind}`,
      regionId: regionId(input.workstation.position.x, input.workstation.position.z),
      featureId: input.tool.toolId,
      toolHead: input.tool.head,
      workstationHead: input.workstation.head,
      consumedLotHeads: input.tool.consumedLotHeads
    },
    participants: [
      { id: input.ownerReceizId, kind: "player", expectedHead: input.playerHead, role: "steward" },
      { id: input.tool.builder.creatureSubjectId, kind: "creature", expectedHead: input.tool.builder.creatureHead, role: "crafting-partner" }
    ],
    stages: [
      { id: "stage:shape", profession: "craft", participantIds },
      { id: "stage:balance", profession: "finish", participantIds }
    ],
    consequences: { usefulOutput: input.tool.kind === "quarry-pick" ? 4 : 3, ecologicalRenewal: 0, publicBenefit: 1, cooperation: 2,
      durability: 5, extraction: input.tool.consumedLotIds.length, damage: 0, waste: 0, restorationDebt: 0 },
    kaiUPulse: input.tool.kaiUPulse,
    expiresAtKaiUPulse: input.tool.kaiUPulse + 1_000_000,
    semanticIdempotencyKey: `steward:craft:${identity}`
  });
}

export function createWildsStewardPhiAward(input: Readonly<{
  ownerReceizId: string;
  operation: WildsLivingOperationPlanV1;
  currentEmission: WildsWorldEmissionProofV1;
  nextEmission: WildsWorldEmissionProofV1;
  amountPhiMicro: string;
}>): WildsStewardPhiAwardV1 {
  if (!ID.test(input.ownerReceizId) || !verifyWildsLivingOperationPlan(input.operation).ok
    || !verifyWildsWorldEmissionProof(input.currentEmission) || !verifyWildsWorldEmissionProof(input.nextEmission)
    || input.nextEmission.parentHead !== input.currentEmission.head || input.nextEmission.revision !== input.currentEmission.revision + 1
    || !input.nextEmission.consumedOperationIds.includes(input.operation.operationId)
    || !input.operation.participants.some((participant) => participant.kind === "player" && participant.id === input.ownerReceizId)
    || !/^[1-9][0-9]{0,39}$/.test(input.amountPhiMicro)) throw new Error("wilds_steward_phi_award_invalid");
  const amount = BigInt(input.amountPhiMicro);
  const region = String(input.operation.intention.regionId ?? "");
  const globalDelta = BigInt(input.currentEmission.globalRemainingPhiMicro) - BigInt(input.nextEmission.globalRemainingPhiMicro);
  const regionDelta = BigInt(wildsEmissionRegionRemaining(input.currentEmission, region)) - BigInt(wildsEmissionRegionRemaining(input.nextEmission, region));
  const classDelta = BigInt(input.currentEmission.classRemainingPhiMicro.construction ?? "-1") - BigInt(input.nextEmission.classRemainingPhiMicro.construction ?? "-1");
  if (globalDelta !== amount || regionDelta !== amount || classDelta !== amount) throw new Error("wilds_steward_phi_conservation_invalid");
  const identity = digest({ schema: "wildz.steward-phi-award-identity.v1", operationPlanDigest: input.operation.planDigest, admittedEmissionHead: input.nextEmission.head }).replace(/^sha256:/, "");
  const basis = {
    schema: "wildz.steward-phi-award.v1" as const,
    awardId: `wildz:steward-phi:${identity}`,
    ownerReceizId: input.ownerReceizId,
    amountPhiMicro: amount.toString(),
    operationId: input.operation.operationId,
    operationPlanDigest: input.operation.planDigest,
    sourceEmissionHead: input.currentEmission.head,
    admittedEmissionHead: input.nextEmission.head,
    rail: "settlement" as const,
    authority: "source-proof-objects" as const
  };
  return freeze({ ...basis, head: digest(basis) });
}

export function verifyWildsStewardPhiAward(value: unknown): value is WildsStewardPhiAwardV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const award = value as Partial<WildsStewardPhiAwardV1>;
  if (award.schema !== "wildz.steward-phi-award.v1" || !/^wildz:steward-phi:[a-f0-9]{64}$/.test(award.awardId ?? "")
    || !ID.test(award.ownerReceizId ?? "") || !/^[1-9][0-9]{0,39}$/.test(award.amountPhiMicro ?? "")
    || !ID.test(award.operationId ?? "") || !HEAD.test(award.operationPlanDigest ?? "")
    || !HEAD.test(award.sourceEmissionHead ?? "") || !HEAD.test(award.admittedEmissionHead ?? "")
    || award.rail !== "settlement" || award.authority !== "source-proof-objects" || !HEAD.test(award.head ?? "")) return false;
  const { head, ...basis } = award as WildsStewardPhiAwardV1;
  return head === digest(basis);
}

export function sumWildsStewardPhiAwards(awards: readonly WildsStewardPhiAwardV1[], ownerReceizId: string) {
  const seen = new Set<string>();
  let total = 0n;
  for (const award of awards) {
    if (!verifyWildsStewardPhiAward(award)) throw new Error("wilds_steward_phi_award_invalid");
    if (seen.has(award.awardId)) throw new Error("wilds_steward_phi_award_duplicate");
    seen.add(award.awardId);
    if (award.ownerReceizId === ownerReceizId) total += BigInt(award.amountPhiMicro);
  }
  return total.toString();
}

function sourceStateBasis(state: Omit<WildsHarvestedSourceStateV1, "head">) {
  return state;
}

export function verifyWildsHarvestedSourceState(value: unknown): value is WildsHarvestedSourceStateV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const state = value as Partial<WildsHarvestedSourceStateV1>;
  if (state.schema !== "wildz.harvested-source-state.v1" || !state.sourceId || !ID.test(state.sourceId)
    || !Number.isSafeInteger(state.harvestedCapacity) || (state.harvestedCapacity ?? -1) < 0
    || !/^(?:0|[1-9]\d{0,77})$/.test(state.lastHarvestKaiPulse ?? "")
    || !Number.isSafeInteger(state.revision) || (state.revision ?? -1) < 0
    || (state.parentHead !== null && !HEAD.test(state.parentHead ?? ""))
    || !HEAD.test(state.head ?? "")) return false;
  const { head, ...basis } = state as WildsHarvestedSourceStateV1;
  return head === digest(basis);
}

export function initialWildsHarvestedSourceState(source: WildsResourceSource): WildsHarvestedSourceStateV1 {
  const basis = {
    schema: "wildz.harvested-source-state.v1" as const,
    sourceId: source.sourceId,
    harvestedCapacity: 0,
    lastHarvestKaiPulse: "0",
    revision: 0,
    parentHead: null
  };
  return freeze({ ...basis, head: digest(sourceStateBasis(basis)) });
}

export function projectWildsCreatureWorkFamilies(element: string): readonly WildsResourceWorkFamily[] {
  if (element === "Stone" || element === "Ember") return freeze(["quarry"]);
  if (element === "Grove" || element === "Prism" || element === "Spark" || element === "Tide") return freeze(["lumber"]);
  return freeze([]);
}

export function verifyWildsMaterialLot(value: unknown): value is WildsMaterialLotV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const lot = value as Partial<WildsMaterialLotV1>;
  if (lot.schema !== "wildz.material-lot.v1" || (lot.kind !== "timber" && lot.kind !== "stone") || lot.quantity !== 1
    || !Number.isSafeInteger(lot.quality) || (lot.quality ?? 0) < 1 || (lot.quality ?? 0) > 5
    || !ID.test(lot.ownerReceizId ?? "") || !/^wildz:material:(?:timber|stone):[a-f0-9]{64}$/.test(lot.lotId ?? "")
    || lot.authority !== "source-proof-object" || !HEAD.test(lot.head ?? "") || !lot.source || !lot.contributors) return false;
  if (!ID.test(lot.source.sourceId) || !HEAD.test(lot.source.sourceHead) || !HEAD.test(lot.source.admittedSourceHead)
    || !validKai(lot.source.kaiUPulse) || lot.contributors.explorerReceizId !== lot.ownerReceizId
    || !ID.test(lot.contributors.creatureSubjectId) || !HEAD.test(lot.contributors.creatureHead)) return false;
  const { head, ...basis } = lot as WildsMaterialLotV1;
  return head === digest(basis);
}

export function createWildsMaterialHarvest(input: Readonly<{
  source: WildsResourceSource;
  current: WildsHarvestedSourceStateV1;
  ownerReceizId: string;
  actorPosition: Readonly<{ x: number; z: number }>;
  creature: Readonly<{ subjectId: string; head: string; workFamilies: readonly string[]; willing: boolean }>;
  tool?: WildsStewardToolV1 | null;
  kaiUPulse: number;
}>) {
  if (!isCanonicalWildsResourceSource(input.source)) throw new Error("wilds_steward_source_noncanonical");
  if (input.source.kind !== "timber" && input.source.kind !== "stone") throw new Error("wilds_steward_material_unsupported");
  if (!verifyWildsHarvestedSourceState(input.current) || input.current.sourceId !== input.source.sourceId) throw new Error("wilds_steward_source_head_invalid");
  if (!ID.test(input.ownerReceizId) || !ID.test(input.creature.subjectId) || !HEAD.test(input.creature.head)) throw new Error("wilds_steward_authority_invalid");
  if (!validKai(input.kaiUPulse)) throw new Error("wilds_steward_kai_invalid");
  if (!Number.isFinite(input.actorPosition.x) || !Number.isFinite(input.actorPosition.z)
    || Math.hypot(input.actorPosition.x - input.source.position.x, input.actorPosition.z - input.source.position.z) > 5.5) throw new Error("wilds_steward_source_unreachable");
  if (!input.creature.willing) throw new Error("wilds_steward_creature_unwilling");
  if (!input.creature.workFamilies.includes(input.source.requirements.creature)) throw new Error("wilds_steward_creature_unqualified");
  if (input.tool && (!verifyWildsStewardTool(input.tool) || input.tool.ownerReceizId !== input.ownerReceizId
    || input.tool.capability !== input.source.requirements.creature || input.tool.durability.remaining < 1)) {
    throw new Error("wilds_steward_tool_invalid");
  }
  const availability = projectWildsResourceAvailability(input.source, {
    admittedHarvestedCapacity: input.current.harvestedCapacity,
    lastHarvestKaiPulse: input.current.lastHarvestKaiPulse,
    currentKaiPulse: String(input.kaiUPulse)
  });
  if (availability.availableCapacity < 1) throw new Error("wilds_steward_source_exhausted");
  const sourceBasis = {
    schema: "wildz.harvested-source-state.v1" as const,
    sourceId: input.source.sourceId,
    harvestedCapacity: input.source.capacity - availability.availableCapacity + 1,
    lastHarvestKaiPulse: String(input.kaiUPulse),
    revision: input.current.revision + 1,
    parentHead: input.current.head
  };
  const source = freeze({ ...sourceBasis, head: digest(sourceStateBasis(sourceBasis)) });
  const lotIdentity = digest({
    schema: "wildz.material-lot-identity.v1",
    ownerReceizId: input.ownerReceizId,
    sourceId: input.source.sourceId,
    sourceHead: input.current.head,
    admittedSourceHead: source.head,
    creatureHead: input.creature.head,
    kaiUPulse: input.kaiUPulse
  }).replace(/^sha256:/, "");
  const lotBasis = {
    schema: "wildz.material-lot.v1" as const,
    lotId: `wildz:material:${input.source.kind}:${lotIdentity}`,
    kind: input.source.kind,
    quantity: 1 as const,
    quality: Math.min(5, input.source.quality + (input.tool ? 1 : 0)) as 1 | 2 | 3 | 4 | 5,
    ownerReceizId: input.ownerReceizId,
    source: {
      sourceId: input.source.sourceId,
      sourceHead: input.current.head,
      admittedSourceHead: source.head,
      kaiUPulse: input.kaiUPulse
    },
    contributors: {
      explorerReceizId: input.ownerReceizId,
      creatureSubjectId: input.creature.subjectId,
      creatureHead: input.creature.head
    },
    authority: "source-proof-object" as const
  };
  const lot = freeze({ ...lotBasis, head: digest(lotBasis) });
  const tool = input.tool ? reviseWildsStewardToolAfterUse(input.tool, { capability: input.source.requirements.creature as "lumber" | "quarry", kaiUPulse: input.kaiUPulse }) : null;
  return freeze({ source, lot, tool });
}

function verifyStructureBase(structure: Partial<WildsStructureV1>, expectedLots: number) {
  return structure.schema === "wildz.structure.v1"
    && ID.test(structure.ownerReceizId ?? "") && structure.stage === "complete"
    && structure.authority === "source-proof-objects" && HEAD.test(structure.head ?? "")
    && validKai(structure.kaiUPulse ?? -1) && Boolean(structure.position)
    && [structure.position?.x, structure.position?.y, structure.position?.z].every((value) => typeof value === "number" && Number.isFinite(value))
    && Number.isSafeInteger(structure.rotationQuarterTurns) && (structure.rotationQuarterTurns ?? -1) >= 0 && (structure.rotationQuarterTurns ?? 4) <= 3
    && Array.isArray(structure.consumedLotIds) && structure.consumedLotIds.length === expectedLots
    && new Set(structure.consumedLotIds).size === expectedLots
    && Array.isArray(structure.consumedLotHeads) && structure.consumedLotHeads.length === expectedLots
    && structure.consumedLotHeads.every((head) => HEAD.test(head)) && Boolean(structure.builder)
    && (structure.materialContributorReceizIds === undefined || (Array.isArray(structure.materialContributorReceizIds)
      && structure.materialContributorReceizIds.length > 0
      && structure.materialContributorReceizIds.every((id) => ID.test(id))
      && canonicalPortableCardJson(structure.materialContributorReceizIds) === canonicalPortableCardJson([...new Set(structure.materialContributorReceizIds)].sort())))
    && ID.test(structure.builder?.creatureSubjectId ?? "") && HEAD.test(structure.builder?.creatureHead ?? "");
}

function waterSurface(surface: WildsTerrainSurface) {
  return surface === "shallow-water" || surface === "deep-water";
}

function verifyBridgePhysical(value: unknown): value is WildsBridgePhysicalEvidenceV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const physical = value as Partial<WildsBridgePhysicalEvidenceV1>;
  return (physical.centerSurface === "shallow-water" || physical.centerSurface === "deep-water")
    && physical.halfWidth === 1.5 && physical.halfLength === 4 && typeof physical.deckY === "number" && Number.isFinite(physical.deckY)
    && Boolean(physical.start) && Boolean(physical.end)
    && [physical.start?.x, physical.start?.y, physical.start?.z, physical.end?.x, physical.end?.y, physical.end?.z]
      .every((candidate) => typeof candidate === "number" && Number.isFinite(candidate))
    && typeof physical.start?.surface === "string" && typeof physical.end?.surface === "string"
    && !waterSurface(physical.start.surface) && !waterSurface(physical.end.surface)
    && Math.abs(physical.start.y - physical.end.y) <= 1.250001
    && physical.deckY >= Math.max(physical.start.y, physical.end.y);
}

export function verifyWildsStructure(value: unknown): value is WildsStructureV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const structure = value as Partial<WildsStructureV1>;
  const shelter = structure.blueprint === "trail-shelter";
  const bridge = structure.blueprint === "trail-bridge";
  const workstation = structure.blueprint === "steward-workbench";
  const cache = structure.blueprint === "trail-cache";
  const expectedLots = shelter ? 3 : bridge ? 6 : workstation ? 5 : cache ? 4 : 0;
  if ((!shelter && !bridge && !workstation && !cache) || !verifyStructureBase(structure, expectedLots)
    || !new RegExp(`^wildz:structure:${structure.blueprint}:[a-f0-9]{64}$`).test(structure.structureId ?? "")
    || (shelter && (structure.materials?.timber !== 2 || structure.materials?.stone !== 1))
    || (workstation && (structure.materials?.timber !== 3 || structure.materials?.stone !== 2))
    || (cache && (structure.materials?.timber !== 2 || structure.materials?.stone !== 2))
    || (bridge && (structure.materials?.timber !== 4 || structure.materials?.stone !== 2
      || !verifyBridgePhysical((structure as Partial<WildsTrailBridgeV1>).physical)))) return false;
  const { head, ...basis } = structure as WildsStructureV1;
  return head === digest(basis);
}

function createGroundStewardStructure(input: Readonly<{
  blueprint: "steward-workbench" | "trail-cache";
  materials: Readonly<{ timber: number; stone: number }>;
  ownerReceizId: string;
  position: Readonly<{ x: number; y: number; z: number }>;
  rotationQuarterTurns: number;
  lots: readonly WildsMaterialLotV1[];
  builder: Readonly<{ creatureSubjectId: string; creatureHead: string }>;
  existingStructures: readonly WildsStructureV1[];
  kaiUPulse: number;
}>): WildsStewardWorkbenchV1 | WildsTrailCacheV1 {
  if (!ID.test(input.ownerReceizId) || !validKai(input.kaiUPulse)) throw new Error("wilds_steward_structure_authority_invalid");
  if (!ID.test(input.builder.creatureSubjectId) || !HEAD.test(input.builder.creatureHead)) throw new Error("wilds_steward_builder_invalid");
  if (![input.position.x, input.position.y, input.position.z].every(Number.isFinite)) throw new Error("wilds_steward_structure_position_invalid");
  if (!Number.isSafeInteger(input.rotationQuarterTurns)) throw new Error("wilds_steward_structure_rotation_invalid");
  if (input.lots.some((lot) => !verifyWildsMaterialLot(lot) || lot.ownerReceizId !== input.ownerReceizId)) throw new Error("wilds_steward_material_authority_invalid");
  if (new Set(input.lots.map((lot) => lot.lotId)).size !== input.lots.length) throw new Error("wilds_steward_material_duplicate");
  const timber = input.lots.filter((lot) => lot.kind === "timber").length;
  const stone = input.lots.filter((lot) => lot.kind === "stone").length;
  if (input.lots.length !== input.materials.timber + input.materials.stone || timber !== input.materials.timber || stone !== input.materials.stone) {
    throw new Error("wilds_steward_materials_insufficient");
  }
  if (input.existingStructures.some((structure) => Math.hypot(structure.position.x - input.position.x, structure.position.z - input.position.z) < 7.25)) {
    throw new Error("wilds_steward_structure_overlap");
  }
  const rotationQuarterTurns = (((input.rotationQuarterTurns % 4) + 4) % 4) as 0 | 1 | 2 | 3;
  const orderedLots = [...input.lots].sort((left, right) => left.lotId.localeCompare(right.lotId));
  const identity = digest({ schema: "wildz.structure-identity.v1", blueprint: input.blueprint, ownerReceizId: input.ownerReceizId,
    position: input.position, rotationQuarterTurns, consumedLotHeads: orderedLots.map((lot) => lot.head) }).replace(/^sha256:/, "");
  const basis = {
    schema: "wildz.structure.v1" as const,
    structureId: `wildz:structure:${input.blueprint}:${identity}`,
    blueprint: input.blueprint,
    ownerReceizId: input.ownerReceizId,
    position: freeze({ ...input.position }),
    rotationQuarterTurns,
    stage: "complete" as const,
    materials: freeze({ ...input.materials }),
    consumedLotIds: freeze(orderedLots.map((lot) => lot.lotId)),
    consumedLotHeads: freeze(orderedLots.map((lot) => lot.head)),
    builder: freeze({ ...input.builder }),
    kaiUPulse: input.kaiUPulse,
    authority: "source-proof-objects" as const
  };
  return freeze({ ...basis, head: digest(basis) }) as WildsStewardWorkbenchV1 | WildsTrailCacheV1;
}

export function createWildsWorkstation(input: Omit<Parameters<typeof createGroundStewardStructure>[0], "blueprint" | "materials">): WildsStewardWorkbenchV1 {
  return createGroundStewardStructure({ ...input, blueprint: "steward-workbench", materials: { timber: 3, stone: 2 } }) as WildsStewardWorkbenchV1;
}

export function createWildsTrailCache(input: Omit<Parameters<typeof createGroundStewardStructure>[0], "blueprint" | "materials">): WildsTrailCacheV1 {
  return createGroundStewardStructure({ ...input, blueprint: "trail-cache", materials: { timber: 2, stone: 2 } }) as WildsTrailCacheV1;
}

export function verifyWildsStewardTool(value: unknown): value is WildsStewardToolV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const tool = value as Partial<WildsStewardToolV1>;
  const capability = tool.kind === "steward-axe" ? "lumber" : tool.kind === "quarry-pick" ? "quarry" : null;
  if (!capability || tool.schema !== "wildz.steward-tool.v1" || tool.capability !== capability
    || !new RegExp(`^wildz:tool:${tool.kind}:[a-f0-9]{64}$`).test(tool.toolId ?? "")
    || !ID.test(tool.ownerReceizId ?? "") || !/^wildz:structure:steward-workbench:[a-f0-9]{64}$/.test(tool.workstationId ?? "")
    || !HEAD.test(tool.workstationHead ?? "") || !Array.isArray(tool.consumedLotIds) || !Array.isArray(tool.consumedLotHeads)
    || tool.consumedLotIds.length !== (tool.kind === "steward-axe" ? 2 : 3) || tool.consumedLotHeads.length !== tool.consumedLotIds.length
    || new Set(tool.consumedLotIds).size !== tool.consumedLotIds.length || !tool.consumedLotHeads.every((head) => HEAD.test(head))
    || !tool.builder || !ID.test(tool.builder.creatureSubjectId) || !HEAD.test(tool.builder.creatureHead)
    || tool.durability?.capacity !== 24 || !Number.isSafeInteger(tool.durability?.remaining) || (tool.durability?.remaining ?? -1) < 0 || (tool.durability?.remaining ?? 25) > 24
    || !Number.isSafeInteger(tool.revision) || (tool.revision ?? -1) < 0 || (tool.parentHead !== null && !HEAD.test(tool.parentHead ?? ""))
    || !validKai(tool.kaiUPulse ?? -1) || tool.authority !== "source-proof-objects" || !HEAD.test(tool.head ?? "")) return false;
  if (tool.revision === 0 ? tool.parentHead !== null || tool.durability.remaining !== 24 : tool.parentHead === null) return false;
  const { head, ...basis } = tool as WildsStewardToolV1;
  return head === digest(basis);
}

export function createWildsStewardTool(input: Readonly<{
  kind: WildsStewardToolKind;
  ownerReceizId: string;
  workstation: WildsStewardWorkbenchV1;
  lots: readonly WildsMaterialLotV1[];
  builder: Readonly<{ creatureSubjectId: string; creatureHead: string }>;
  kaiUPulse: number;
}>): WildsStewardToolV1 {
  if (!verifyWildsStructure(input.workstation) || input.workstation.blueprint !== "steward-workbench"
    || input.workstation.ownerReceizId !== input.ownerReceizId) throw new Error("wilds_steward_tool_workstation_invalid");
  if (!ID.test(input.ownerReceizId) || !ID.test(input.builder.creatureSubjectId) || !HEAD.test(input.builder.creatureHead) || !validKai(input.kaiUPulse)) {
    throw new Error("wilds_steward_tool_authority_invalid");
  }
  const expected = input.kind === "steward-axe" ? { timber: 1, stone: 1 } : { timber: 1, stone: 2 };
  if (input.lots.some((lot) => !verifyWildsMaterialLot(lot) || lot.ownerReceizId !== input.ownerReceizId)
    || new Set(input.lots.map((lot) => lot.lotId)).size !== input.lots.length
    || input.lots.filter((lot) => lot.kind === "timber").length !== expected.timber
    || input.lots.filter((lot) => lot.kind === "stone").length !== expected.stone
    || input.lots.length !== expected.timber + expected.stone) throw new Error("wilds_steward_tool_material_invalid");
  const orderedLots = [...input.lots].sort((left, right) => left.lotId.localeCompare(right.lotId));
  const identity = digest({ schema: "wildz.steward-tool-identity.v1", kind: input.kind, ownerReceizId: input.ownerReceizId,
    workstationHead: input.workstation.head, consumedLotHeads: orderedLots.map((lot) => lot.head) }).replace(/^sha256:/, "");
  const basis = {
    schema: "wildz.steward-tool.v1" as const,
    toolId: `wildz:tool:${input.kind}:${identity}`,
    kind: input.kind,
    capability: input.kind === "steward-axe" ? "lumber" as const : "quarry" as const,
    ownerReceizId: input.ownerReceizId,
    workstationId: input.workstation.structureId,
    workstationHead: input.workstation.head,
    consumedLotIds: freeze(orderedLots.map((lot) => lot.lotId)),
    consumedLotHeads: freeze(orderedLots.map((lot) => lot.head)),
    builder: freeze({ ...input.builder }),
    durability: freeze({ remaining: 24, capacity: 24 as const }),
    revision: 0,
    parentHead: null,
    kaiUPulse: input.kaiUPulse,
    authority: "source-proof-objects" as const
  };
  return freeze({ ...basis, head: digest(basis) });
}

export function reviseWildsStewardToolAfterUse(tool: WildsStewardToolV1, input: Readonly<{ capability: "lumber" | "quarry"; kaiUPulse: number }>): WildsStewardToolV1 {
  if (!verifyWildsStewardTool(tool)) throw new Error("wilds_steward_tool_invalid");
  if (tool.capability !== input.capability) throw new Error("wilds_steward_tool_capability_invalid");
  if (tool.durability.remaining < 1) throw new Error("wilds_steward_tool_depleted");
  if (!validKai(input.kaiUPulse) || input.kaiUPulse < tool.kaiUPulse) throw new Error("wilds_steward_tool_kai_invalid");
  const { head: parentHead, ...prior } = tool;
  const basis = { ...prior, durability: freeze({ remaining: tool.durability.remaining - 1, capacity: 24 as const }), revision: tool.revision + 1, parentHead, kaiUPulse: input.kaiUPulse };
  return freeze({ ...basis, head: digest(basis) });
}

export function createWildsTrailShelter(input: Readonly<{
  ownerReceizId: string;
  position: Readonly<{ x: number; y: number; z: number }>;
  rotationQuarterTurns: number;
  lots: readonly WildsMaterialLotV1[];
  builder: Readonly<{ creatureSubjectId: string; creatureHead: string }>;
  existingStructures: readonly WildsStructureV1[];
  materialContributorReceizIds?: readonly string[];
  kaiUPulse: number;
}>): WildsStructureV1 {
  if (!ID.test(input.ownerReceizId) || !validKai(input.kaiUPulse)) throw new Error("wilds_steward_structure_authority_invalid");
  if (!ID.test(input.builder.creatureSubjectId) || !HEAD.test(input.builder.creatureHead)) throw new Error("wilds_steward_builder_invalid");
  if (![input.position.x, input.position.y, input.position.z].every(Number.isFinite)
    || Math.abs(input.position.x) > 500_000_000 || Math.abs(input.position.z) > 500_000_000) throw new Error("wilds_steward_structure_position_invalid");
  if (!Number.isSafeInteger(input.rotationQuarterTurns)) throw new Error("wilds_steward_structure_rotation_invalid");
  const rotationQuarterTurns = (((input.rotationQuarterTurns % 4) + 4) % 4) as 0 | 1 | 2 | 3;
  const materialContributorReceizIds = [...new Set(input.materialContributorReceizIds ?? [input.ownerReceizId])].sort();
  if (!materialContributorReceizIds.includes(input.ownerReceizId) || materialContributorReceizIds.some((id) => !ID.test(id))
    || input.lots.some((lot) => !verifyWildsMaterialLot(lot) || !materialContributorReceizIds.includes(lot.ownerReceizId))) throw new Error("wilds_steward_material_authority_invalid");
  if (new Set(input.lots.map((lot) => lot.lotId)).size !== input.lots.length) throw new Error("wilds_steward_material_duplicate");
  const timber = input.lots.filter((lot) => lot.kind === "timber");
  const stone = input.lots.filter((lot) => lot.kind === "stone");
  if (input.lots.length !== 3 || timber.length !== 2 || stone.length !== 1) throw new Error("wilds_steward_materials_insufficient");
  if (input.existingStructures.some((structure) => Math.hypot(structure.position.x - input.position.x, structure.position.z - input.position.z) < 7.25)) {
    throw new Error("wilds_steward_structure_overlap");
  }
  const orderedLots = [...input.lots].sort((left, right) => left.lotId.localeCompare(right.lotId));
  const identity = digest({
    schema: "wildz.structure-identity.v1",
    blueprint: "trail-shelter",
    ownerReceizId: input.ownerReceizId,
    position: input.position,
    consumedLotHeads: orderedLots.map((lot) => lot.head)
  }).replace(/^sha256:/, "");
  const basis = {
    schema: "wildz.structure.v1" as const,
    structureId: `wildz:structure:trail-shelter:${identity}`,
    blueprint: "trail-shelter" as const,
    ownerReceizId: input.ownerReceizId,
    position: freeze({ ...input.position }),
    rotationQuarterTurns,
    stage: "complete" as const,
    materials: freeze({ timber: 2 as const, stone: 1 as const }),
    consumedLotIds: freeze(orderedLots.map((lot) => lot.lotId)),
    consumedLotHeads: freeze(orderedLots.map((lot) => lot.head)),
    ...(input.materialContributorReceizIds ? { materialContributorReceizIds: freeze(materialContributorReceizIds) } : {}),
    builder: freeze({ ...input.builder }),
    kaiUPulse: input.kaiUPulse,
    authority: "source-proof-objects" as const
  };
  return freeze({ ...basis, head: digest(basis) });
}

function bridgeAxis(rotationQuarterTurns: 0 | 1 | 2 | 3) {
  return rotationQuarterTurns % 2 === 0 ? { x: 0, z: 4 } : { x: 4, z: 0 };
}

function bridgeTerrainEvidence(position: Readonly<{ x: number; z: number }>, rotationQuarterTurns: 0 | 1 | 2 | 3) {
  const axis = bridgeAxis(rotationQuarterTurns);
  const center = sampleWildsTerrain(position.x, position.z);
  const start = sampleWildsTerrain(position.x - axis.x, position.z - axis.z);
  const end = sampleWildsTerrain(position.x + axis.x, position.z + axis.z);
  return { axis, center, start, end };
}

export function selectWildsTrailBridgeRotation(position: Readonly<{ x: number; z: number }>): 0 | 1 | null {
  if (![position.x, position.z].every(Number.isFinite)) return null;
  for (const rotationQuarterTurns of [0, 1] as const) {
    const terrain = bridgeTerrainEvidence(position, rotationQuarterTurns);
    if (waterSurface(terrain.center.surface) && !waterSurface(terrain.start.surface) && !waterSurface(terrain.end.surface)
      && Math.abs(terrain.start.elevation - terrain.end.elevation) <= 1.25) return rotationQuarterTurns;
  }
  return null;
}

export function createWildsTrailBridge(input: Readonly<{
  ownerReceizId: string;
  position: Readonly<{ x: number; z: number }>;
  rotationQuarterTurns: number;
  lots: readonly WildsMaterialLotV1[];
  builder: Readonly<{ creatureSubjectId: string; creatureHead: string }>;
  existingStructures: readonly WildsStructureV1[];
  materialContributorReceizIds?: readonly string[];
  kaiUPulse: number;
}>): WildsTrailBridgeV1 {
  if (!ID.test(input.ownerReceizId) || !validKai(input.kaiUPulse)) throw new Error("wilds_steward_structure_authority_invalid");
  if (!ID.test(input.builder.creatureSubjectId) || !HEAD.test(input.builder.creatureHead)) throw new Error("wilds_steward_builder_invalid");
  if (![input.position.x, input.position.z].every(Number.isFinite)
    || Math.abs(input.position.x) > 500_000_000 || Math.abs(input.position.z) > 500_000_000) throw new Error("wilds_steward_structure_position_invalid");
  if (!Number.isSafeInteger(input.rotationQuarterTurns)) throw new Error("wilds_steward_structure_rotation_invalid");
  const rotationQuarterTurns = (((input.rotationQuarterTurns % 4) + 4) % 4) as 0 | 1 | 2 | 3;
  const materialContributorReceizIds = [...new Set(input.materialContributorReceizIds ?? [input.ownerReceizId])].sort();
  if (!materialContributorReceizIds.includes(input.ownerReceizId) || materialContributorReceizIds.some((id) => !ID.test(id))
    || input.lots.some((lot) => !verifyWildsMaterialLot(lot) || !materialContributorReceizIds.includes(lot.ownerReceizId))) throw new Error("wilds_steward_material_authority_invalid");
  if (new Set(input.lots.map((lot) => lot.lotId)).size !== input.lots.length) throw new Error("wilds_steward_material_duplicate");
  const timber = input.lots.filter((lot) => lot.kind === "timber");
  const stone = input.lots.filter((lot) => lot.kind === "stone");
  if (input.lots.length !== 6 || timber.length !== 4 || stone.length !== 2) throw new Error("wilds_steward_materials_insufficient");

  const { axis, center, start: startTerrain, end: endTerrain } = bridgeTerrainEvidence(input.position, rotationQuarterTurns);
  if (!waterSurface(center.surface)) throw new Error("wilds_steward_bridge_water_required");
  if (waterSurface(startTerrain.surface) || waterSurface(endTerrain.surface)) throw new Error("wilds_steward_bridge_bank_required");
  if (Math.abs(startTerrain.elevation - endTerrain.elevation) > 1.25) throw new Error("wilds_steward_bridge_grade_invalid");
  if (input.existingStructures.some((structure) => Math.hypot(structure.position.x - input.position.x, structure.position.z - input.position.z) < 9.25)) {
    throw new Error("wilds_steward_structure_overlap");
  }
  const deckY = Math.round((Math.max(startTerrain.elevation, endTerrain.elevation) + .18) * 1_000_000) / 1_000_000;
  const physical = freeze({
    centerSurface: center.surface as "shallow-water" | "deep-water",
    start: freeze({ x: input.position.x - axis.x, y: startTerrain.elevation, z: input.position.z - axis.z, surface: startTerrain.surface }),
    end: freeze({ x: input.position.x + axis.x, y: endTerrain.elevation, z: input.position.z + axis.z, surface: endTerrain.surface }),
    deckY,
    halfWidth: 1.5 as const,
    halfLength: 4 as const
  });
  const orderedLots = [...input.lots].sort((left, right) => left.lotId.localeCompare(right.lotId));
  const identity = digest({
    schema: "wildz.structure-identity.v1",
    blueprint: "trail-bridge",
    ownerReceizId: input.ownerReceizId,
    position: { x: input.position.x, y: deckY, z: input.position.z },
    rotationQuarterTurns,
    physical,
    consumedLotHeads: orderedLots.map((lot) => lot.head)
  }).replace(/^sha256:/, "");
  const basis = {
    schema: "wildz.structure.v1" as const,
    structureId: `wildz:structure:trail-bridge:${identity}`,
    blueprint: "trail-bridge" as const,
    ownerReceizId: input.ownerReceizId,
    position: freeze({ x: input.position.x, y: deckY, z: input.position.z }),
    rotationQuarterTurns,
    stage: "complete" as const,
    materials: freeze({ timber: 4 as const, stone: 2 as const }),
    consumedLotIds: freeze(orderedLots.map((lot) => lot.lotId)),
    consumedLotHeads: freeze(orderedLots.map((lot) => lot.head)),
    ...(input.materialContributorReceizIds ? { materialContributorReceizIds: freeze(materialContributorReceizIds) } : {}),
    builder: freeze({ ...input.builder }),
    physical,
    kaiUPulse: input.kaiUPulse,
    authority: "source-proof-objects" as const
  };
  return freeze({ ...basis, head: digest(basis) });
}
