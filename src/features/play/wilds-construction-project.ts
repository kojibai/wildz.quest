import { canonicalPortableCardJson, sha256PortableBasis } from "./portable-card";

export const WILDS_CONSTRUCTION_CHUNK_REFERENCE_LIMIT = 64;
export type WildsConstructionAccess = "private" | "invited" | "public";
export type WildsConstructionPermissions = Readonly<{ plan: boolean; contribute: boolean; work: boolean; renovate: boolean; remove: boolean }>;
export type WildsConstructionRegion = Readonly<{ x: number; z: number }>;
type CausalProof = Readonly<{ revision: number; parentHead: string | null; kaiUPulse: number; authority: "source-proof-object"; head: string }>;
export type WildsConstructionProjectV1 = CausalProof & Readonly<{
  schema: "wildz.construction-project.v1"; projectId: string; ownerReceizId: string; name: string;
  access: WildsConstructionAccess; permissions: WildsConstructionPermissions; styleDefaults: Readonly<Record<string, never>>;
  region: WildsConstructionRegion; firstChunkId: string | null; commandId: string;
}>;
export type WildsConstructionChunkV1 = CausalProof & Readonly<{
  schema: "wildz.construction-chunk.v1"; chunkId: string; projectId: string; region: WildsConstructionRegion; regionId: string;
  page: number; references: readonly Readonly<{ componentId: string; componentHead: string; priorComponentHeads?: readonly string[] }>[]; nextChunkId: string | null;
}>;

export const constructionProofDigest = (value: unknown): string => sha256PortableBasis(canonicalPortableCardJson(value));
export function freezeConstructionProof<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) freezeConstructionProof(child);
    Object.freeze(value);
  }
  return value;
}
export function sealConstructionProof<T extends object>(basis: T): T & Readonly<{ head: string }> {
  // Do not freeze caller-owned evidence when creating an immutable proof.
  const copy = JSON.parse(canonicalPortableCardJson(basis)) as T;
  return freezeConstructionProof({ ...copy, head: constructionProofDigest(copy) });
}
export const validConstructionId = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 512 && value.trim() === value;
export const validConstructionHead = (value: unknown): value is string => typeof value === "string" && /^sha256:[a-f0-9]{64}$/.test(value);
export const validConstructionKai = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
export const validConstructionRegion = (value: WildsConstructionRegion): boolean => !!value && Number.isSafeInteger(value.x) && Number.isSafeInteger(value.z);
export const wildsConstructionRegionId = (region: WildsConstructionRegion): string => `wildz.excavation.region.v1:${region.x}:${region.z}`;
export function validConstructionSeal(value: object & { head: string }): boolean {
  const { head, ...basis } = value;
  return validConstructionHead(head) && head === constructionProofDigest(basis);
}
function validCausal(value: CausalProof): boolean {
  return value.authority === "source-proof-object" && validConstructionKai(value.kaiUPulse) && Number.isSafeInteger(value.revision) && value.revision >= 0
    && (value.revision === 0 ? value.parentHead === null : validConstructionHead(value.parentHead)) && validConstructionSeal(value);
}
const permissionKeys = ["plan", "contribute", "work", "renovate", "remove"] as const;
const DEFAULT_PERMISSIONS: WildsConstructionPermissions = Object.freeze({ plan: false, contribute: true, work: true, renovate: false, remove: false });
export function verifyWildsConstructionProject(value: unknown): value is WildsConstructionProjectV1 {
  try {
    const p = value as WildsConstructionProjectV1;
    return !!p && p.schema === "wildz.construction-project.v1" && validConstructionId(p.projectId) && validConstructionId(p.ownerReceizId)
      && validConstructionId(p.name) && validConstructionId(p.commandId)
      && p.projectId === `wildz:construction-project:${constructionProofDigest({ owner: p.ownerReceizId, commandId: p.commandId }).slice(7)}` && ["private", "invited", "public"].includes(p.access)
      && !!p.permissions && Object.keys(p.permissions).length === 5 && permissionKeys.every((key) => typeof p.permissions[key] === "boolean")
      && !!p.styleDefaults && Object.keys(p.styleDefaults).length === 0 && validConstructionRegion(p.region)
      && (p.firstChunkId === null || p.firstChunkId === chunkId(p.projectId, p.region, 0)) && validCausal(p);
  } catch { return false; }
}
export function createWildsConstructionProject(input: Readonly<{ ownerReceizId: string; name: string; region: WildsConstructionRegion; kaiUPulse: number; commandId?: string; access?: WildsConstructionAccess; permissions?: WildsConstructionPermissions }>): WildsConstructionProjectV1 {
  const commandId = input.commandId ?? `project:${constructionProofDigest({ owner: input.ownerReceizId, name: input.name, region: input.region, kaiUPulse: input.kaiUPulse })}`;
  const project = sealConstructionProof({ schema: "wildz.construction-project.v1" as const, projectId: `wildz:construction-project:${constructionProofDigest({ owner: input.ownerReceizId, commandId }).slice(7)}`, ownerReceizId: input.ownerReceizId,
    name: input.name, region: input.region, access: input.access ?? "private", permissions: input.permissions ?? DEFAULT_PERMISSIONS,
    styleDefaults: {}, firstChunkId: null, commandId, revision: 0, parentHead: null, kaiUPulse: input.kaiUPulse, authority: "source-proof-object" as const });
  if (!verifyWildsConstructionProject(project)) throw new Error("wilds_construction_project_invalid");
  return project;
}
export function canWildsConstructionProject(project: WildsConstructionProjectV1, actorReceizId: string, operation: keyof WildsConstructionPermissions): boolean {
  if (!verifyWildsConstructionProject(project) || !validConstructionId(actorReceizId) || !permissionKeys.includes(operation)) return false;
  return actorReceizId === project.ownerReceizId || (project.access === "public" && project.permissions[operation]);
}
function chunkId(projectId: string, region: WildsConstructionRegion, page: number): string {
  return `wildz:construction-chunk:${constructionProofDigest({ projectId, region, page }).slice(7)}`;
}
export function verifyWildsConstructionChunk(value: unknown): value is WildsConstructionChunkV1 {
  try {
    const c = value as WildsConstructionChunkV1;
    return !!c && c.schema === "wildz.construction-chunk.v1" && validConstructionId(c.projectId) && validConstructionRegion(c.region)
      && c.regionId === wildsConstructionRegionId(c.region) && Number.isSafeInteger(c.page) && c.page >= 0
      && c.chunkId === chunkId(c.projectId, c.region, c.page) && Array.isArray(c.references) && c.references.length <= WILDS_CONSTRUCTION_CHUNK_REFERENCE_LIMIT
      && c.references.every((ref, i) => validConstructionId(ref.componentId) && validConstructionHead(ref.componentHead) && (ref.priorComponentHeads === undefined || (Array.isArray(ref.priorComponentHeads) && ref.priorComponentHeads.every(validConstructionHead) && new Set(ref.priorComponentHeads).size === ref.priorComponentHeads.length && !ref.priorComponentHeads.includes(ref.componentHead))) && (i === 0 || c.references[i - 1].componentId < ref.componentId))
      && (c.nextChunkId === null || (c.references.length === WILDS_CONSTRUCTION_CHUNK_REFERENCE_LIMIT && c.nextChunkId === chunkId(c.projectId, c.region, c.page + 1))) && validCausal(c);
  } catch { return false; }
}
export function createWildsConstructionChunk(input: Readonly<{ project: WildsConstructionProjectV1; region?: WildsConstructionRegion; page?: number; kaiUPulse: number }>): WildsConstructionChunkV1 {
  if (!verifyWildsConstructionProject(input.project)) throw new Error("wilds_construction_project_invalid");
  const region = input.region ?? input.project.region;
  const page = input.page ?? 0;
  const chunk = sealConstructionProof({ schema: "wildz.construction-chunk.v1" as const, chunkId: chunkId(input.project.projectId, region, page), projectId: input.project.projectId, region,
    regionId: wildsConstructionRegionId(region), page, references: [], nextChunkId: null, revision: 0, parentHead: null, kaiUPulse: input.kaiUPulse, authority: "source-proof-object" as const });
  if (!verifyWildsConstructionChunk(chunk)) throw new Error("wilds_construction_chunk_invalid");
  return chunk;
}
export function appendWildsConstructionProjectChunk(input: Readonly<{ project: WildsConstructionProjectV1; chunk: WildsConstructionChunkV1; kaiUPulse: number }>): WildsConstructionProjectV1 {
  const { project, chunk } = input;
  if (!verifyWildsConstructionProject(project) || !verifyWildsConstructionChunk(chunk) || chunk.projectId !== project.projectId || chunk.page !== 0 || constructionProofDigest(chunk.region) !== constructionProofDigest(project.region) || !validConstructionKai(input.kaiUPulse) || input.kaiUPulse < project.kaiUPulse) throw new Error("wilds_construction_project_chunk_invalid");
  if (project.firstChunkId === chunk.chunkId) return project;
  if (project.firstChunkId !== null) throw new Error("wilds_construction_project_chunk_conflict");
  const { head, ...basis } = project;
  return sealConstructionProof({ ...basis, firstChunkId: chunk.chunkId, revision: project.revision + 1, parentHead: head, kaiUPulse: input.kaiUPulse });
}
export function appendWildsConstructionChunkReference(input: Readonly<{ chunk: WildsConstructionChunkV1; component: Readonly<{ componentId: string; head: string; projectId: string; region: WildsConstructionRegion }>; kaiUPulse: number }>): Readonly<{ chunk: WildsConstructionChunkV1; continuation?: WildsConstructionChunkV1 }> {
  const { chunk, component } = input;
  if (!verifyWildsConstructionChunk(chunk) || !validConstructionId(component.componentId) || !validConstructionHead(component.head) || component.projectId !== chunk.projectId || constructionProofDigest(component.region) !== constructionProofDigest(chunk.region) || !validConstructionKai(input.kaiUPulse) || input.kaiUPulse < chunk.kaiUPulse) throw new Error("wilds_construction_chunk_reference_invalid");
  const existing = chunk.references.find((ref) => ref.componentId === component.componentId);
  if (existing) {
    if (existing.componentHead !== component.head) throw new Error("wilds_construction_chunk_reference_conflict");
    return freezeConstructionProof({ chunk });
  }
  const reference = { componentId: component.componentId, componentHead: component.head };
  const { head, ...basis } = chunk;
  if (chunk.references.length < WILDS_CONSTRUCTION_CHUNK_REFERENCE_LIMIT) return freezeConstructionProof({ chunk: sealConstructionProof({ ...basis, references: [...chunk.references, reference].sort((a, b) => a.componentId < b.componentId ? -1 : 1), revision: chunk.revision + 1, parentHead: head, kaiUPulse: input.kaiUPulse }) });
  // A caller must resolve an existing next page from admitted state. Never replace it with an empty page.
  if (chunk.nextChunkId !== null) throw new Error("wilds_construction_chunk_follow_continuation");
  const nextChunkId = chunkId(chunk.projectId, chunk.region, chunk.page + 1);
  return freezeConstructionProof({
    chunk: sealConstructionProof({ ...basis, nextChunkId, revision: chunk.revision + 1, parentHead: head, kaiUPulse: input.kaiUPulse }),
    continuation: sealConstructionProof({ ...basis, chunkId: nextChunkId, page: chunk.page + 1, references: [reference], nextChunkId: null, revision: 0, parentHead: null, kaiUPulse: input.kaiUPulse })
  });
}

export function reviseWildsConstructionChunkReference(chunk: WildsConstructionChunkV1, previous: {componentId: string; head: string}, next: {componentId: string; head: string}, kaiUPulse: number): WildsConstructionChunkV1 {
  if (!verifyWildsConstructionChunk(chunk) || previous.componentId !== next.componentId || !validConstructionHead(previous.head) || !validConstructionHead(next.head) || previous.head === next.head || !validConstructionKai(kaiUPulse) || kaiUPulse < chunk.kaiUPulse
    || !chunk.references.some(ref => ref.componentId === previous.componentId && ref.componentHead === previous.head)) throw new Error("wilds_construction_chunk_reference_conflict");
  const { head, ...basis } = chunk;
  return sealConstructionProof({...basis, revision: chunk.revision + 1, parentHead: head, kaiUPulse,
    references: chunk.references.map(ref => ref.componentId === previous.componentId
      ? {...ref, componentHead: next.head, priorComponentHeads: [...(ref.priorComponentHeads ?? []), previous.head]} : ref)});
}
