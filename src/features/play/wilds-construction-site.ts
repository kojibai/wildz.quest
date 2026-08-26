import { canonicalPortableCardJson, sha256PortableBasis } from "./portable-card";
import { projectWildsStewardPlacement, type WildsStewardPlacement } from "./wilds-steward-craft";
import {
  createWildsTrailBridge,
  createWildsTrailShelter,
  verifyWildsMaterialLot,
  verifyWildsStructure,
  type WildsMaterialLotV1,
  type WildsStructureV1
} from "./wilds-steward-construction";
import { sampleWildsTerrain } from "./wilds-terrain-authority";

export type WildsConstructionBlueprint = "trail-shelter" | "trail-bridge";
export type WildsConstructionSiteStage = "placed" | "materials-ready" | "complete";

export type WildsConstructionSiteContributionV1 = Readonly<{
  lotId: string;
  lotHead: string;
  kind: "timber" | "stone";
  ownerReceizId: string;
  contributedAtKaiUPulse: number;
}>;

export type WildsConstructionSiteV1 = Readonly<{
  schema: "wildz.construction-site.v1";
  siteId: string;
  blueprint: WildsConstructionBlueprint;
  placedByReceizId: string;
  position: Readonly<{ x: number; y: number; z: number }>;
  rotationQuarterTurns: 0 | 1;
  materialsRequired: Readonly<{ timber: number; stone: number }>;
  contributedLots: readonly WildsConstructionSiteContributionV1[];
  contributorReceizIds: readonly string[];
  workRequired: 1;
  workCompleted: 0 | 1;
  stage: WildsConstructionSiteStage;
  revision: number;
  parentHead: string | null;
  kaiUPulse: number;
  terminalStructureId: string | null;
  terminalStructureHead: string | null;
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

function required(blueprint: WildsConstructionBlueprint) {
  return blueprint === "trail-shelter" ? { timber: 2, stone: 1 } : { timber: 4, stone: 2 };
}

function siteBasis(site: Omit<WildsConstructionSiteV1, "head">) {
  return site;
}

function sealSite(site: Omit<WildsConstructionSiteV1, "head">): WildsConstructionSiteV1 {
  return freeze({ ...site, head: digest(siteBasis(site)) });
}

function materialCounts(contributions: readonly WildsConstructionSiteContributionV1[]) {
  return {
    timber: contributions.filter((entry) => entry.kind === "timber").length,
    stone: contributions.filter((entry) => entry.kind === "stone").length
  };
}

function validContribution(value: unknown): value is WildsConstructionSiteContributionV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const entry = value as Partial<WildsConstructionSiteContributionV1>;
  return /^wildz:material:(?:timber|stone):[a-f0-9]{64}$/.test(entry.lotId ?? "")
    && HEAD.test(entry.lotHead ?? "") && (entry.kind === "timber" || entry.kind === "stone")
    && ID.test(entry.ownerReceizId ?? "") && Number.isSafeInteger(entry.contributedAtKaiUPulse)
    && (entry.contributedAtKaiUPulse ?? -1) >= 0;
}

export function verifyWildsConstructionSite(value: unknown): value is WildsConstructionSiteV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const site = value as Partial<WildsConstructionSiteV1>;
  if (site.schema !== "wildz.construction-site.v1" || (site.blueprint !== "trail-shelter" && site.blueprint !== "trail-bridge")
    || !new RegExp(`^wildz:construction-site:${site.blueprint}:[a-f0-9]{64}$`).test(site.siteId ?? "")
    || !ID.test(site.placedByReceizId ?? "") || !site.position
    || ![site.position.x, site.position.y, site.position.z].every((part) => Number.isFinite(part))
    || (site.rotationQuarterTurns !== 0 && site.rotationQuarterTurns !== 1)
    || !site.materialsRequired || canonicalPortableCardJson(site.materialsRequired) !== canonicalPortableCardJson(required(site.blueprint))
    || !Array.isArray(site.contributedLots) || site.contributedLots.some((entry) => !validContribution(entry))
    || canonicalPortableCardJson(site.contributedLots.map((entry) => entry.lotId)) !== canonicalPortableCardJson(site.contributedLots.map((entry) => entry.lotId).sort())
    || new Set(site.contributedLots.map((entry) => entry.lotId)).size !== site.contributedLots.length
    || !Array.isArray(site.contributorReceizIds) || site.contributorReceizIds.some((id) => !ID.test(id))
    || canonicalPortableCardJson(site.contributorReceizIds) !== canonicalPortableCardJson([...new Set(site.contributorReceizIds)].sort())
    || site.workRequired !== 1 || (site.workCompleted !== 0 && site.workCompleted !== 1)
    || !Number.isSafeInteger(site.revision) || (site.revision ?? -1) < 0
    || (site.parentHead !== null && !HEAD.test(site.parentHead ?? ""))
    || !Number.isSafeInteger(site.kaiUPulse) || (site.kaiUPulse ?? -1) < 0
    || site.authority !== "source-proof-objects" || !HEAD.test(site.head ?? "")) return false;
  const counts = materialCounts(site.contributedLots);
  if (counts.timber > site.materialsRequired.timber || counts.stone > site.materialsRequired.stone) return false;
  const funded = counts.timber === site.materialsRequired.timber && counts.stone === site.materialsRequired.stone;
  if (site.stage === "placed" ? funded || site.workCompleted !== 0 || site.terminalStructureId !== null || site.terminalStructureHead !== null
    : site.stage === "materials-ready" ? !funded || site.workCompleted !== 0 || site.terminalStructureId !== null || site.terminalStructureHead !== null
      : site.stage === "complete" ? !funded || site.workCompleted !== 1 || !site.terminalStructureId || !HEAD.test(site.terminalStructureHead ?? "")
        : true) return false;
  if (site.revision === 0 ? site.parentHead !== null || site.contributedLots.length !== 0 || site.contributorReceizIds.length !== 0 : site.parentHead === null) return false;
  const { head, ...basis } = site as WildsConstructionSiteV1;
  return head === digest(basis);
}

export function createWildsConstructionSite(input: Readonly<{
  blueprint: WildsConstructionBlueprint;
  placedByReceizId: string;
  actorPosition: Readonly<{ x: number; z: number }>;
  position: Readonly<{ x: number; z: number }>;
  rotationQuarterTurns: number;
  existingStructures: readonly WildsStructureV1[];
  existingSites: readonly WildsConstructionSiteV1[];
  kaiUPulse: number;
}>): WildsConstructionSiteV1 {
  if (!ID.test(input.placedByReceizId) || !Number.isSafeInteger(input.kaiUPulse) || input.kaiUPulse < 0) throw new Error("wilds_construction_site_authority_invalid");
  const placement: WildsStewardPlacement = projectWildsStewardPlacement({ actorPosition: input.actorPosition, blueprintId: input.blueprint, point: input.position });
  if (!placement.valid) throw new Error("wilds_construction_site_placement_invalid");
  if (placement.rotationQuarterTurns !== (((input.rotationQuarterTurns % 2) + 2) % 2)) throw new Error("wilds_construction_site_rotation_invalid");
  const separation = input.blueprint === "trail-bridge" ? 9.25 : 7.25;
  if (input.existingStructures.some((structure) => Math.hypot(structure.position.x - input.position.x, structure.position.z - input.position.z) < separation)
    || input.existingSites.some((site) => site.stage !== "complete" && Math.hypot(site.position.x - input.position.x, site.position.z - input.position.z) < separation)) {
    throw new Error("wilds_construction_site_overlap");
  }
  const terrain = sampleWildsTerrain(input.position.x, input.position.z);
  const identityBasis = {
    schema: "wildz.construction-site-identity.v1",
    blueprint: input.blueprint,
    placedByReceizId: input.placedByReceizId,
    position: { x: input.position.x, y: terrain.elevation, z: input.position.z },
    rotationQuarterTurns: placement.rotationQuarterTurns,
    kaiUPulse: input.kaiUPulse
  };
  const identity = digest(identityBasis).replace(/^sha256:/, "");
  return sealSite({
    schema: "wildz.construction-site.v1",
    siteId: `wildz:construction-site:${input.blueprint}:${identity}`,
    blueprint: input.blueprint,
    placedByReceizId: input.placedByReceizId,
    position: freeze(identityBasis.position),
    rotationQuarterTurns: placement.rotationQuarterTurns,
    materialsRequired: freeze(required(input.blueprint)),
    contributedLots: freeze([]),
    contributorReceizIds: freeze([]),
    workRequired: 1,
    workCompleted: 0,
    stage: "placed",
    revision: 0,
    parentHead: null,
    kaiUPulse: input.kaiUPulse,
    terminalStructureId: null,
    terminalStructureHead: null,
    authority: "source-proof-objects"
  });
}

export function contributeWildsConstructionSite(input: Readonly<{
  site: WildsConstructionSiteV1;
  expectedSiteHead?: string;
  contributorReceizId: string;
  lots: readonly WildsMaterialLotV1[];
  lotCustodians?: Readonly<Record<string, string>>;
  kaiUPulse: number;
}>): WildsConstructionSiteV1 {
  if (!verifyWildsConstructionSite(input.site)) throw new Error("wilds_construction_site_invalid");
  if (input.site.stage === "complete") throw new Error("wilds_construction_site_terminal");
  if (input.expectedSiteHead && input.expectedSiteHead !== input.site.head) throw new Error("wilds_construction_site_stale");
  if (!ID.test(input.contributorReceizId) || !Number.isSafeInteger(input.kaiUPulse) || input.kaiUPulse < input.site.kaiUPulse) throw new Error("wilds_construction_contributor_invalid");
  if (input.lots.length < 1 || input.lots.some((lot) => !verifyWildsMaterialLot(lot) || (input.lotCustodians?.[lot.lotId] ?? lot.ownerReceizId) !== input.contributorReceizId)
    || new Set(input.lots.map((lot) => lot.lotId)).size !== input.lots.length
    || input.lots.some((lot) => input.site.contributedLots.some((entry) => entry.lotId === lot.lotId))) throw new Error("wilds_construction_material_invalid");
  const additions = input.lots.map((lot) => ({ lotId: lot.lotId, lotHead: lot.head, kind: lot.kind, ownerReceizId: input.lotCustodians?.[lot.lotId] ?? lot.ownerReceizId, contributedAtKaiUPulse: input.kaiUPulse } as const));
  const contributedLots = [...input.site.contributedLots, ...additions].sort((left, right) => left.lotId.localeCompare(right.lotId));
  const counts = materialCounts(contributedLots);
  if (counts.timber > input.site.materialsRequired.timber || counts.stone > input.site.materialsRequired.stone) throw new Error("wilds_construction_materials_exceed");
  const stage = counts.timber === input.site.materialsRequired.timber && counts.stone === input.site.materialsRequired.stone ? "materials-ready" as const : "placed" as const;
  const { head: parentHead, ...prior } = input.site;
  return sealSite({ ...prior, contributedLots: freeze(contributedLots), contributorReceizIds: freeze([...new Set([...input.site.contributorReceizIds, input.contributorReceizId])].sort()), stage, revision: input.site.revision + 1, parentHead, kaiUPulse: input.kaiUPulse });
}

export function completeWildsConstructionSite(input: Readonly<{
  site: WildsConstructionSiteV1;
  expectedSiteHead?: string;
  lots: readonly WildsMaterialLotV1[];
  workerReceizId: string;
  creature: Readonly<{ subjectId: string; head: string }>;
  existingStructures: readonly WildsStructureV1[];
  kaiUPulse: number;
}>): Readonly<{ site: WildsConstructionSiteV1; structure: WildsStructureV1 }> {
  if (!verifyWildsConstructionSite(input.site)) throw new Error("wilds_construction_site_invalid");
  if (input.site.stage === "complete") throw new Error("wilds_construction_site_terminal");
  if (input.expectedSiteHead && input.expectedSiteHead !== input.site.head) throw new Error("wilds_construction_site_stale");
  if (input.site.stage !== "materials-ready") throw new Error("wilds_construction_materials_incomplete");
  if (!ID.test(input.workerReceizId) || !ID.test(input.creature.subjectId) || !HEAD.test(input.creature.head)
    || !Number.isSafeInteger(input.kaiUPulse) || input.kaiUPulse < input.site.kaiUPulse) throw new Error("wilds_construction_worker_invalid");
  const orderedLots = [...input.lots].sort((left, right) => left.lotId.localeCompare(right.lotId));
  if (canonicalPortableCardJson(orderedLots.map((lot) => ({ lotId: lot.lotId, lotHead: lot.head, kind: lot.kind, ownerReceizId: input.site.contributedLots.find((entry) => entry.lotId === lot.lotId)?.ownerReceizId })))
    !== canonicalPortableCardJson(input.site.contributedLots.map(({ lotId, lotHead, kind, ownerReceizId }) => ({ lotId, lotHead, kind, ownerReceizId })))) {
    throw new Error("wilds_construction_material_lineage_invalid");
  }
  const materialContributorReceizIds = [...new Set([input.site.placedByReceizId, ...input.site.contributorReceizIds, ...orderedLots.map((lot) => lot.ownerReceizId)])].sort();
  const common = {
    ownerReceizId: input.site.placedByReceizId,
    rotationQuarterTurns: input.site.rotationQuarterTurns,
    lots: orderedLots,
    builder: { creatureSubjectId: input.creature.subjectId, creatureHead: input.creature.head },
    existingStructures: input.existingStructures,
    materialContributorReceizIds,
    kaiUPulse: input.kaiUPulse
  };
  const structure = input.site.blueprint === "trail-shelter"
    ? createWildsTrailShelter({ ...common, position: input.site.position })
    : createWildsTrailBridge({ ...common, position: input.site.position });
  if (!verifyWildsStructure(structure)) throw new Error("wilds_construction_structure_invalid");
  const { head: parentHead, ...prior } = input.site;
  const site = sealSite({ ...prior, stage: "complete", workCompleted: 1, revision: input.site.revision + 1, parentHead, kaiUPulse: input.kaiUPulse, terminalStructureId: structure.structureId, terminalStructureHead: structure.head });
  return freeze({ site, structure });
}
