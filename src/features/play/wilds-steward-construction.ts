import { canonicalPortableCardJson, sha256PortableBasis } from "./portable-card";
import {
  projectWildsResourceAvailability,
  projectWildsResourceRegion,
  type WildsResourceSource,
  type WildsResourceWorkFamily
} from "./wilds-resource-authority";

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

export type WildsStructureV1 = Readonly<{
  schema: "wildz.structure.v1";
  structureId: string;
  blueprint: "trail-shelter";
  ownerReceizId: string;
  position: Readonly<{ x: number; y: number; z: number }>;
  rotationQuarterTurns: 0 | 1 | 2 | 3;
  stage: "complete";
  materials: Readonly<{ timber: 2; stone: 1 }>;
  consumedLotIds: readonly string[];
  consumedLotHeads: readonly string[];
  builder: Readonly<{ creatureSubjectId: string; creatureHead: string }>;
  kaiUPulse: number;
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
  kaiUPulse: number;
}>) {
  const canonicalSource = projectWildsResourceRegion(input.source.regionX, input.source.regionZ)[input.source.slot];
  if (!canonicalSource || canonicalPortableCardJson(canonicalSource) !== canonicalPortableCardJson(input.source)) throw new Error("wilds_steward_source_noncanonical");
  if (input.source.kind !== "timber" && input.source.kind !== "stone") throw new Error("wilds_steward_material_unsupported");
  if (!verifyWildsHarvestedSourceState(input.current) || input.current.sourceId !== input.source.sourceId) throw new Error("wilds_steward_source_head_invalid");
  if (!ID.test(input.ownerReceizId) || !ID.test(input.creature.subjectId) || !HEAD.test(input.creature.head)) throw new Error("wilds_steward_authority_invalid");
  if (!validKai(input.kaiUPulse)) throw new Error("wilds_steward_kai_invalid");
  if (!Number.isFinite(input.actorPosition.x) || !Number.isFinite(input.actorPosition.z)
    || Math.hypot(input.actorPosition.x - input.source.position.x, input.actorPosition.z - input.source.position.z) > 5.5) throw new Error("wilds_steward_source_unreachable");
  if (!input.creature.willing) throw new Error("wilds_steward_creature_unwilling");
  if (!input.creature.workFamilies.includes(input.source.requirements.creature)) throw new Error("wilds_steward_creature_unqualified");
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
    quality: input.source.quality,
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
  return freeze({ source, lot });
}

export function verifyWildsStructure(value: unknown): value is WildsStructureV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const structure = value as Partial<WildsStructureV1>;
  if (structure.schema !== "wildz.structure.v1" || structure.blueprint !== "trail-shelter"
    || !/^wildz:structure:trail-shelter:[a-f0-9]{64}$/.test(structure.structureId ?? "")
    || !ID.test(structure.ownerReceizId ?? "") || structure.stage !== "complete"
    || structure.materials?.timber !== 2 || structure.materials?.stone !== 1
    || structure.authority !== "source-proof-objects" || !HEAD.test(structure.head ?? "")
    || !validKai(structure.kaiUPulse ?? -1) || !structure.position
    || ![structure.position.x, structure.position.y, structure.position.z].every(Number.isFinite)
    || !Number.isSafeInteger(structure.rotationQuarterTurns) || (structure.rotationQuarterTurns ?? -1) < 0 || (structure.rotationQuarterTurns ?? 4) > 3
    || !Array.isArray(structure.consumedLotIds) || structure.consumedLotIds.length !== 3
    || !Array.isArray(structure.consumedLotHeads) || structure.consumedLotHeads.length !== 3
    || !structure.consumedLotHeads.every((head) => HEAD.test(head)) || !structure.builder
    || !ID.test(structure.builder.creatureSubjectId) || !HEAD.test(structure.builder.creatureHead)) return false;
  const { head, ...basis } = structure as WildsStructureV1;
  return head === digest(basis);
}

export function createWildsTrailShelter(input: Readonly<{
  ownerReceizId: string;
  position: Readonly<{ x: number; y: number; z: number }>;
  rotationQuarterTurns: number;
  lots: readonly WildsMaterialLotV1[];
  builder: Readonly<{ creatureSubjectId: string; creatureHead: string }>;
  existingStructures: readonly WildsStructureV1[];
  kaiUPulse: number;
}>): WildsStructureV1 {
  if (!ID.test(input.ownerReceizId) || !validKai(input.kaiUPulse)) throw new Error("wilds_steward_structure_authority_invalid");
  if (!ID.test(input.builder.creatureSubjectId) || !HEAD.test(input.builder.creatureHead)) throw new Error("wilds_steward_builder_invalid");
  if (![input.position.x, input.position.y, input.position.z].every(Number.isFinite)
    || Math.abs(input.position.x) > 500_000_000 || Math.abs(input.position.z) > 500_000_000) throw new Error("wilds_steward_structure_position_invalid");
  if (!Number.isSafeInteger(input.rotationQuarterTurns)) throw new Error("wilds_steward_structure_rotation_invalid");
  const rotationQuarterTurns = (((input.rotationQuarterTurns % 4) + 4) % 4) as 0 | 1 | 2 | 3;
  if (input.lots.some((lot) => !verifyWildsMaterialLot(lot) || lot.ownerReceizId !== input.ownerReceizId)) throw new Error("wilds_steward_material_authority_invalid");
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
    builder: freeze({ ...input.builder }),
    kaiUPulse: input.kaiUPulse,
    authority: "source-proof-objects" as const
  };
  return freeze({ ...basis, head: digest(basis) });
}
