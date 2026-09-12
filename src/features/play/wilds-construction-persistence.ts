import { createWildsExactProofCache } from "./wilds-exact-proof-cache";
import { admitWildsBurrows, type WildsBurrowV1 } from "./wilds-burrow";
import { sameWildzPlayerCoordinate } from "../../lib/receiz/wildz-player-coordinate";
import { verifyWildsConstructionProject, verifyWildsConstructionChunk, validConstructionHead, type WildsConstructionProjectV1, type WildsConstructionChunkV1 } from "./wilds-construction-project";
import { adjustWildsConstructionComponent, verifyWildsConstructionComponent, verifyWildsMaterialContribution, verifyWildsWorkContribution, type WildsConstructionComponentV1, type WildsConstructionMaterialContributionV1, type WildsConstructionWorkContributionV1 } from "./wilds-construction-component";

type Source = WildsConstructionProjectV1 | WildsConstructionChunkV1 | WildsConstructionComponentV1 | WildsConstructionMaterialContributionV1 | WildsConstructionWorkContributionV1;
export type WildsConstructionPersistence = {
  burrows?: Record<string,WildsBurrowV1>;
  constructionProjects: Record<string, WildsConstructionProjectV1>;
  constructionChunks: Record<string, WildsConstructionChunkV1>;
  constructionComponents: Record<string, WildsConstructionComponentV1>;
  constructionMaterialContributions: Record<string, WildsConstructionMaterialContributionV1>;
  constructionWorkContributions: Record<string, WildsConstructionWorkContributionV1>;
  /** Exact alternate and ancestor sources, indexed by their original head. Never resealed. */
  constructionRecoverySources?: Record<string, Source>;
  constructionCommandReceipts: Record<string, Readonly<{ commandDigest: string; eventPayloadDigest: string; actorId: string; kind: string }>>;
};
const keys = ["constructionProjects", "constructionChunks", "constructionComponents", "constructionMaterialContributions", "constructionWorkContributions"] as const;
type Key = typeof keys[number];
// Reuse only exact proof bytes; nested mutations and worker clones are checked safely.
const proofCache = createWildsExactProofCache();
const descriptors = {
  constructionProjects: ["projectId", proofCache.guard(verifyWildsConstructionProject)],
  constructionChunks: ["chunkId", proofCache.guard(verifyWildsConstructionChunk)],
  constructionComponents: ["componentId", proofCache.guard(verifyWildsConstructionComponent)],
  constructionMaterialContributions: ["contributionId", proofCache.guard(verifyWildsMaterialContribution)],
  constructionWorkContributions: ["contributionId", proofCache.guard(verifyWildsWorkContribution)]
} as const;
const entries = (value: unknown): [string, unknown][] => value && typeof value === "object" && !Array.isArray(value) ? Object.entries(value) : [];
const idOf = (value: Source, key: Key): string => (value as unknown as Record<string, string>)[descriptors[key][0]];
const sameOwner = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase() || sameWildzPlayerCoordinate(a, b);
export function emptyWildsConstructionPersistence(): WildsConstructionPersistence {
  return { burrows: {}, constructionProjects: {}, constructionChunks: {}, constructionComponents: {}, constructionMaterialContributions: {}, constructionWorkContributions: {}, constructionRecoverySources: {}, constructionCommandReceipts: {} };
}
function sources(input: Partial<WildsConstructionPersistence>, key: Key): Source[] {
  const verify = descriptors[key][1];
  const result = new Map<string, Source>();
  for (const [id, value] of entries(input[key])) if (verify(value) && idOf(value, key) === id) result.set(value.head, value);
  for (const [head, value] of entries(input.constructionRecoverySources)) if (verify(value) && value.head === head) result.set(head, value);
  return [...result.values()];
}
/** Parent links are necessary, but an append-only page must also retain every exact reference. */
function successor(child: Source, parent: Source, key: Key): boolean {
  if (!("revision" in child) || !("revision" in parent) || child.parentHead !== parent.head
    || child.revision !== parent.revision + 1 || child.kaiUPulse < parent.kaiUPulse || idOf(child, key) !== idOf(parent, key)) return false;
  if ("ownerReceizId" in child && "ownerReceizId" in parent && child.ownerReceizId !== parent.ownerReceizId) return false;
  if (key === "constructionComponents") {
    const c = child as WildsConstructionComponentV1, p = parent as WildsConstructionComponentV1;
    try {
      return adjustWildsConstructionComponent({component:p,placement:c.placement,evidence:c.evidence,commandId:c.adjustmentCommandId!,kaiUPulse:c.kaiUPulse}).head === c.head;
    } catch { return false; }
  }
  if (key === "constructionChunks") {
    const c = child as WildsConstructionChunkV1, p = parent as WildsConstructionChunkV1;
    return c.projectId === p.projectId && c.regionId === p.regionId && c.page === p.page
      && (!p.nextChunkId || p.nextChunkId === c.nextChunkId)
      && p.references.every(ref => c.references.some(next => next.componentId === ref.componentId && (next.componentHead === ref.componentHead ? JSON.stringify(next.priorComponentHeads ?? []) === JSON.stringify(ref.priorComponentHeads ?? []) : JSON.stringify(next.priorComponentHeads) === JSON.stringify([...(ref.priorComponentHeads ?? []),ref.componentHead]))));
  }
  return true;
}
function descendant(child: Source, ancestor: Source, all: Map<string, Source>, key: Key): boolean {
  let cursor = child;
  const seen = new Set<string>();
  while ("parentHead" in cursor && cursor.parentHead && !seen.has(cursor.head)) {
    seen.add(cursor.head);
    const parent = all.get(cursor.parentHead);
    if (!parent || !successor(cursor, parent, key)) return false;
    if (parent.head === ancestor.head) return true;
    cursor = parent;
  }
  return false;
}
/** Compatible histories converge; ambiguous branches retain the existing active head and every alternative. */
export function mergeWildsConstructionPersistence(left: Partial<WildsConstructionPersistence>, right: Partial<WildsConstructionPersistence>): WildsConstructionPersistence {
  const result = emptyWildsConstructionPersistence();
  const recovery: Record<string, Source> = {};
  for (const key of keys) {
    const leftSources = sources(left, key), rightSources = sources(right, key);
    const all = new Map([...leftSources, ...rightSources].map(source => [source.head, source]));
    const selected: Record<string, Source> = {};
    // Canonical sources first; recovery must never silently replace a divergent active source.
    for (const input of [left, right]) for (const [id, value] of entries(input[key])) {
      if (!descriptors[key][1](value) || idOf(value, key) !== id) continue;
      const current = selected[id];
      if (!current || descendant(value, current, all, key)) selected[id] = value;
    }
    for (const source of all.values()) {
      const id = idOf(source, key), current = selected[id];
      if (!current || descendant(source, current, all, key)) selected[id] = source;
    }
    for (const source of all.values()) if (selected[idOf(source, key)]?.head !== source.head) recovery[source.head] = source;
    Object.assign(result[key], Object.fromEntries(Object.entries(selected).sort(([a], [b]) => a.localeCompare(b))));
  }
  result.burrows = admitWildsBurrows({...right.burrows,...left.burrows});
  result.constructionRecoverySources = Object.fromEntries(Object.entries(recovery).sort(([a], [b]) => a.localeCompare(b)));
  for (const input of [left, right]) for (const [id, receipt] of entries(input.constructionCommandReceipts)) {
    if (!receipt || typeof receipt !== "object") continue;
    const r = receipt as WildsConstructionPersistence["constructionCommandReceipts"][string];
    if (validConstructionHead(r.commandDigest) && validConstructionHead(r.eventPayloadDigest) && typeof r.actorId === "string" && typeof r.kind === "string"
      && r.kind.startsWith("construction.") && !result.constructionCommandReceipts[id]) result.constructionCommandReceipts[id] = r;
  }
  return result;
}
/** Filter after verification, retaining the entire exact history of each owned or contributed-to component. */
export function projectWildsConstructionPersistence(input: Partial<WildsConstructionPersistence>, ownerReceizId?: string): WildsConstructionPersistence {
  const verified = mergeWildsConstructionPersistence({}, input);
  if (!ownerReceizId) return verified;
  const projects = sources(verified, "constructionProjects") as WildsConstructionProjectV1[];
  const components = sources(verified, "constructionComponents") as WildsConstructionComponentV1[];
  const materials = sources(verified, "constructionMaterialContributions") as WildsConstructionMaterialContributionV1[];
  const work = sources(verified, "constructionWorkContributions") as WildsConstructionWorkContributionV1[];
  const ownedProjects = new Set(projects.filter(p => sameOwner(p.ownerReceizId, ownerReceizId)).map(p => p.projectId));
  const addressed = new Set(components.filter(c => sameOwner(c.ownerReceizId, ownerReceizId) && ownedProjects.has(c.projectId)).map(c => c.head));
  for (const proof of materials) if (sameOwner(proof.contributorReceizId, ownerReceizId)) addressed.add(proof.componentHead);
  for (const proof of work) if (sameOwner(proof.worker.receizId, ownerReceizId)) addressed.add(proof.componentHead);
  const keepComponents = components.filter(c => addressed.has(c.head) && projects.some(p => p.projectId === c.projectId && p.ownerReceizId === c.ownerReceizId));
  const componentHeads = new Set(keepComponents.map(c => c.head));
  const projectIds = new Set([...ownedProjects, ...keepComponents.map(c => c.projectId)]);
  const keep = (source: Source, key: Key): boolean => {
    if (key === "constructionProjects") return projectIds.has((source as WildsConstructionProjectV1).projectId);
    if (key === "constructionChunks") return projectIds.has((source as WildsConstructionChunkV1).projectId);
    if (key === "constructionComponents") return componentHeads.has(source.head);
    const c = source as WildsConstructionMaterialContributionV1 | WildsConstructionWorkContributionV1;
    return componentHeads.has(c.componentHead) && keepComponents.some(component => component.head === c.componentHead && component.componentId === c.componentId && component.projectId === c.projectId && c.kaiUPulse >= component.kaiUPulse);
  };
  const result = emptyWildsConstructionPersistence();
  result.burrows = Object.fromEntries(Object.entries(verified.burrows ?? {}).filter(([,p])=>sameOwner(p.ownerReceizId,ownerReceizId)));
  const commandIds = new Set<string>(Object.values(result.burrows).map(p=>p.commandId));
  for (const key of keys) for (const source of sources(verified, key)) if (keep(source, key)) {
    if ("commandId" in source) commandIds.add(source.commandId);
    if ("adjustmentCommandId" in source && source.adjustmentCommandId) commandIds.add(source.adjustmentCommandId);
    if ((verified[key] as Record<string, Source>)[idOf(source, key)]?.head === source.head) Object.assign(result[key], { [idOf(source, key)]: source });
    else result.constructionRecoverySources![source.head] = source;
  }
  for (const [id, receipt] of Object.entries(verified.constructionCommandReceipts)) if (commandIds.has(id)) result.constructionCommandReceipts[id] = receipt;
  return result;
}
/** A derived index, never an owner-authored page or successor. */
export function projectWildsConstructionChunkReferences(input: Partial<WildsConstructionPersistence>, chunkId: string) {
  const components = new Map(sources(input, "constructionComponents").map(c => [c.head, c as WildsConstructionComponentV1]));
  const references = new Map<string, Readonly<{ componentId: string; componentHead: string }>>();
  for (const source of sources(input, "constructionChunks")) {
    const chunk = source as WildsConstructionChunkV1;
    if (chunk.chunkId !== chunkId) continue;
    for (const ref of chunk.references) {
      const component = components.get(ref.componentHead);
      if (component?.componentId === ref.componentId && component.projectId === chunk.projectId && component.regionId === chunk.regionId) references.set(`${ref.componentId}:${ref.componentHead}`, ref);
    }
  }
  return [...references.values()].sort((a, b) => a.componentId.localeCompare(b.componentId) || a.componentHead.localeCompare(b.componentHead));
}
