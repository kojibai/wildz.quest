import { regionForPosition } from "./multiplayer-core";
import { wildsConstructionRecipe, type WildsConstructionRecipe, type WildsConstructionStage } from "./wilds-construction-recipes";
import { verifyWildsProductionPlacement, type WildsBlueprintPlacement, type WildsProductionPlacementEvidence } from "./wilds-world-construction";
import { verifyWildsMaterialLot, type WildsMaterialLotV1, type WildsBuildMaterialKind } from "./wilds-steward-construction";
import { constructionProofDigest, sealConstructionProof, freezeConstructionProof, validConstructionHead, validConstructionId, validConstructionKai, validConstructionRegion, validConstructionSeal, verifyWildsConstructionProject, wildsConstructionRegionId, type WildsConstructionProjectV1, type WildsConstructionRegion } from "./wilds-construction-project";

export type WildsConstructionComponentV1 = Readonly<{
  schema: "wildz.construction-component.v1"; componentId: string; projectId: string; projectHead: string;
  ownerReceizId: string; region: WildsConstructionRegion; regionId: string;
  kind: WildsBlueprintPlacement["kind"]; variant: "default"; customization: Readonly<Record<string, never>>;
  placement: WildsBlueprintPlacement; evidence: WildsProductionPlacementEvidence;
  transform: WildsBlueprintPlacement["transform"]; anchors: WildsBlueprintPlacement["anchors"];
  stageGeometryDigest: string; functionId: string | null; recipe: WildsConstructionRecipe;
  commandId: string; revision: 0; parentHead: null; kaiUPulse: number; authority: "source-proof-object"; head: string;
}>;
export type WildsConstructionWorker =
  | Readonly<{ kind: "player"; receizId: string }>
  | Readonly<{ kind: "creature"; receizId: string; creatureSubjectId: string; creatureHead: string }>;
type ContributionBase = Readonly<{
  contributionId: string; commandId: string; projectId: string; componentId: string; componentHead: string;
  kaiUPulse: number; authority: "source-proof-object"; head: string;
}>;
export type WildsConstructionMaterialContributionV1 = ContributionBase & Readonly<{
  schema: "wildz.construction-material-contribution.v1"; lot: WildsMaterialLotV1;
  lotId: string; lotHead: string; kind: WildsBuildMaterialKind; quantity: 1;
  custodianReceizId: string; contributorReceizId: string;
}>;
export type WildsConstructionContributionReference = Readonly<{ contributionId: string; contributionHead: string }>;
export type WildsConstructionWorkAllocation = Readonly<{ stage: Exclude<WildsConstructionStage, "planned">; materials: readonly WildsConstructionContributionReference[] }>;
export type WildsConstructionWorkContributionV1 = ContributionBase & Readonly<{
  schema: "wildz.construction-work-contribution.v1"; worker: WildsConstructionWorker; amount: number;
  stageAllocations: readonly WildsConstructionWorkAllocation[]; priorWork: readonly WildsConstructionContributionReference[];
}>;
export type WildsConstructionAllocatedLot = Readonly<{
  contributionId: string; contributionHead: string; lotId: string; lotHead: string; kind: WildsBuildMaterialKind; quantity: 1;
  custodianReceizId: string; contributorReceizId: string;
}>;
type QuantityProgress = Readonly<{ required: number; contributed: number; remaining: number }>;
export type WildsConstructionStageProgress = Readonly<{
  stage: Exclude<WildsConstructionStage, "planned">; materials: Readonly<Record<WildsBuildMaterialKind, QuantityProgress>>;
  work: QuantityProgress; materialsComplete: boolean; complete: boolean; allocatedLots: readonly WildsConstructionAllocatedLot[]; embeddedLotIds: readonly string[];
}>;
export type WildsConstructionProgress = Readonly<{
  componentId: string; componentHead: string; stage: WildsConstructionStage; percentage: number;
  materials: Readonly<Record<WildsBuildMaterialKind, QuantityProgress>>; work: QuantityProgress;
  stages: readonly WildsConstructionStageProgress[]; allocatedLotIds: readonly string[]; embeddedLotIds: readonly string[]; unusedLotIds: readonly string[];
  contributorReceizIds: readonly string[]; appliedWorkContributionIds: readonly string[]; appliedWork: readonly WildsConstructionContributionReference[]; allocationConflicts: readonly string[]; invalidWorkContributionIds: readonly string[];
}>;
const equal = (a: unknown, b: unknown): boolean => constructionProofDigest(a) === constructionProofDigest(b);
const kinds = ["hay", "timber", "stone"] as const;
const quantityProgress = (required: number, contributed: number): QuantityProgress => ({ required, contributed, remaining: Math.max(0, required - contributed) });
const geometryDigest = (placement: WildsBlueprintPlacement, recipe: WildsConstructionRecipe) => constructionProofDigest({ kind: placement.kind, variant: "default", customization: {}, transform: placement.transform, geometry: placement.geometry, collisionSolids: placement.collisionSolids, interior: placement.interior, anchors: placement.anchors, recipe });
function componentId(projectId: string, ownerReceizId: string, commandId: string): string {
  return `wildz:construction-component:${constructionProofDigest({ projectId, ownerReceizId, commandId }).slice(7)}`;
}
export function verifyWildsConstructionComponent(value: unknown): value is WildsConstructionComponentV1 {
  try {
    const c = value as WildsConstructionComponentV1;
    if (!c || c.schema !== "wildz.construction-component.v1" || !validConstructionId(c.projectId) || !validConstructionHead(c.projectHead)
      || !validConstructionId(c.ownerReceizId) || !validConstructionId(c.commandId) || !validConstructionRegion(c.region)
      || c.componentId !== componentId(c.projectId, c.ownerReceizId, c.commandId) || c.regionId !== wildsConstructionRegionId(c.region)
      || c.variant !== "default" || !c.customization || Object.keys(c.customization).length !== 0 || c.revision !== 0 || c.parentHead !== null
      || c.authority !== "source-proof-object" || !validConstructionKai(c.kaiUPulse) || !validConstructionSeal(c)
      || !verifyWildsProductionPlacement(c.placement, c.evidence)) return false;
    const recipe = wildsConstructionRecipe(c.kind);
    return c.kind === c.placement.kind && c.placement.worldId === c.regionId && equal(c.region, regionForPosition(c.placement.transform.position))
      && equal(c.transform, c.placement.transform) && equal(c.anchors, c.placement.anchors) && equal(c.recipe, recipe)
      && c.functionId === recipe.functionId && c.stageGeometryDigest === geometryDigest(c.placement, recipe);
  } catch { return false; }
}
export function createWildsConstructionComponent(input: Readonly<{
  project: WildsConstructionProjectV1; placement: WildsBlueprintPlacement; evidence: WildsProductionPlacementEvidence;
  ownerReceizId: string; kaiUPulse: number; commandId?: string;
}>): WildsConstructionComponentV1 {
  if (!verifyWildsConstructionProject(input.project) || input.ownerReceizId !== input.project.ownerReceizId || !verifyWildsProductionPlacement(input.placement, input.evidence)) throw new Error("wilds_construction_component_invalid");
  const region = regionForPosition(input.placement.transform.position);
  if (!equal(region, input.project.region)) throw new Error("wilds_construction_component_region_invalid");
  const recipe = wildsConstructionRecipe(input.placement.kind);
  const commandId = input.commandId ?? `place:${input.placement.placementId}:${input.kaiUPulse}`;
  const component = sealConstructionProof({ schema: "wildz.construction-component.v1" as const,
    componentId: componentId(input.project.projectId, input.ownerReceizId, commandId), projectId: input.project.projectId, projectHead: input.project.head,
    ownerReceizId: input.ownerReceizId, region, regionId: wildsConstructionRegionId(region), kind: input.placement.kind, variant: "default" as const, customization: {},
    placement: input.placement, evidence: input.evidence, transform: input.placement.transform, anchors: input.placement.anchors,
    stageGeometryDigest: geometryDigest(input.placement, recipe), recipe, functionId: recipe.functionId,
    commandId, revision: 0 as const, parentHead: null, kaiUPulse: input.kaiUPulse, authority: "source-proof-object" as const });
  if (!verifyWildsConstructionComponent(component)) throw new Error("wilds_construction_component_invalid");
  return component;
}
function materialId(c: Omit<WildsConstructionMaterialContributionV1, "head" | "contributionId">): string {
  return `wildz:construction-material:${constructionProofDigest({ componentId: c.componentId, componentHead: c.componentHead, contributorReceizId: c.contributorReceizId, commandId: c.commandId, lotId: c.lotId }).slice(7)}`;
}
function workId(c: Omit<WildsConstructionWorkContributionV1, "head" | "contributionId">): string {
  return `wildz:construction-work:${constructionProofDigest({ componentId: c.componentId, componentHead: c.componentHead, worker: c.worker, commandId: c.commandId }).slice(7)}`;
}
function validContribution(c: ContributionBase): boolean {
  return validConstructionId(c.commandId) && validConstructionId(c.projectId) && validConstructionId(c.componentId)
    && validConstructionHead(c.componentHead) && validConstructionKai(c.kaiUPulse) && c.authority === "source-proof-object" && validConstructionSeal(c);
}
export function verifyWildsMaterialContribution(value: unknown): value is WildsConstructionMaterialContributionV1 {
  try {
    const c = value as WildsConstructionMaterialContributionV1;
    return !!c && c.schema === "wildz.construction-material-contribution.v1" && validContribution(c) && verifyWildsMaterialLot(c.lot)
      && c.lotId === c.lot.lotId && c.lotHead === c.lot.head && c.kind === c.lot.kind && c.quantity === c.lot.quantity
      && validConstructionId(c.custodianReceizId) && validConstructionId(c.contributorReceizId) && c.contributionId === materialId(c);
  } catch { return false; }
}
export function createWildsMaterialContribution(input: Readonly<{
  component: WildsConstructionComponentV1; lot: WildsMaterialLotV1; custodianReceizId: string; contributorReceizId: string; commandId: string; kaiUPulse: number;
}>): WildsConstructionMaterialContributionV1 {
  if (!verifyWildsConstructionComponent(input.component) || !verifyWildsMaterialLot(input.lot) || input.kaiUPulse < input.component.kaiUPulse) throw new Error("wilds_construction_material_invalid");
  const basis = { schema: "wildz.construction-material-contribution.v1" as const, projectId: input.component.projectId, componentId: input.component.componentId, componentHead: input.component.head,
    commandId: input.commandId, lot: input.lot, lotId: input.lot.lotId, lotHead: input.lot.head, kind: input.lot.kind, quantity: input.lot.quantity,
    custodianReceizId: input.custodianReceizId, contributorReceizId: input.contributorReceizId, kaiUPulse: input.kaiUPulse, authority: "source-proof-object" as const };
  const contribution = sealConstructionProof({ ...basis, contributionId: materialId(basis) });
  if (!verifyWildsMaterialContribution(contribution)) throw new Error("wilds_construction_material_invalid");
  return contribution;
}
export function verifyWildsWorkContribution(value: unknown): value is WildsConstructionWorkContributionV1 {
  try {
    const c = value as WildsConstructionWorkContributionV1;
    if (!c || c.schema !== "wildz.construction-work-contribution.v1" || !validContribution(c) || !Number.isSafeInteger(c.amount) || c.amount <= 0 || !c.worker || !validConstructionId(c.worker.receizId)) return false;
    const worker = c.worker;
    if (worker.kind === "player") {
      if (Object.keys(worker).length !== 2) return false;
    } else if (worker.kind === "creature") {
      if (Object.keys(worker).length !== 4 || !validConstructionId(worker.creatureSubjectId) || !validConstructionHead(worker.creatureHead)) return false;
    } else return false;
    const validReferences = (refs: readonly WildsConstructionContributionReference[]) => Array.isArray(refs) && refs.length <= 64
      && refs.every((ref, i) => validConstructionId(ref.contributionId) && validConstructionHead(ref.contributionHead) && (i === 0 || refs[i - 1].contributionId < ref.contributionId));
    return Array.isArray(c.stageAllocations) && c.stageAllocations.length <= 3
      && c.stageAllocations.every((allocation, i) => ["framed", "functional", "finished"].includes(allocation.stage) && validReferences(allocation.materials)
        && (i === 0 || ["framed", "functional", "finished"].indexOf(c.stageAllocations[i - 1].stage) < ["framed", "functional", "finished"].indexOf(allocation.stage)))
      && validReferences(c.priorWork) && c.priorWork.every((ref) => ref.contributionId !== c.contributionId) && c.contributionId === workId(c);
  } catch { return false; }
}
/** A sealed helper identity is evidence only. Admission must independently verify permission and a creature mandate. */
export function createWildsWorkContribution(input: Readonly<{
  component: WildsConstructionComponentV1; materials?: readonly WildsConstructionMaterialContributionV1[]; work?: readonly WildsConstructionWorkContributionV1[];
  worker: WildsConstructionWorker; amount: number; commandId: string; kaiUPulse: number;
}>): WildsConstructionWorkContributionV1 {
  if (!verifyWildsConstructionComponent(input.component) || input.kaiUPulse < input.component.kaiUPulse) throw new Error("wilds_construction_work_invalid");
  const materials = input.materials ?? [];
  const work = input.work ?? [];
  const progress = projectWildsConstructionProgress(input.component, materials, work);
  if (progress.allocationConflicts.length || progress.invalidWorkContributionIds.length) throw new Error("wilds_construction_work_history_invalid");
  const byId = (a: WildsConstructionContributionReference, b: WildsConstructionContributionReference) => a.contributionId < b.contributionId ? -1 : 1;
  const stageAllocations = progress.stages.filter((stage) => stage.materialsComplete).map((stage) => ({ stage: stage.stage,
    materials: stage.allocatedLots.map((lot) => ({ contributionId: lot.contributionId, contributionHead: lot.contributionHead })).sort(byId) }));
  const priorWork = progress.appliedWork;
  if ([...priorWork, ...stageAllocations.flatMap((allocation) => allocation.materials)].some((ref) => {
    const proof = [...work, ...materials].find((proof) => proof.contributionId === ref.contributionId && proof.head === ref.contributionHead);
    return !proof || proof.kaiUPulse > input.kaiUPulse;
  })) throw new Error("wilds_construction_work_future_evidence");
  const basis = { schema: "wildz.construction-work-contribution.v1" as const, projectId: input.component.projectId, componentId: input.component.componentId, componentHead: input.component.head,
    commandId: input.commandId, worker: input.worker, amount: input.amount, stageAllocations, priorWork, kaiUPulse: input.kaiUPulse, authority: "source-proof-object" as const };
  const contribution = sealConstructionProof({ ...basis, contributionId: workId(basis) });
  if (!verifyWildsWorkContribution(contribution)) throw new Error("wilds_construction_work_invalid");
  return contribution;
}

export function projectWildsConstructionProgress(component: WildsConstructionComponentV1, materials: readonly WildsConstructionMaterialContributionV1[], work: readonly WildsConstructionWorkContributionV1[]): WildsConstructionProgress {
  if (!verifyWildsConstructionComponent(component)) throw new Error("wilds_construction_component_invalid");
  const sameLineage = (proof: ContributionBase) => proof.projectId === component.projectId && proof.componentId === component.componentId && proof.componentHead === component.head && proof.kaiUPulse >= component.kaiUPulse;
  // Head is a deterministic tie-breaker for conflicting copies of one contribution ID.
  const sorted = <T extends ContributionBase>(proofs: readonly T[]) => [...proofs].sort((a, b) => a.contributionId < b.contributionId ? -1 : a.contributionId > b.contributionId ? 1 : a.head < b.head ? -1 : a.head > b.head ? 1 : 0);
  const validMaterials = sorted(materials.filter((proof) => verifyWildsMaterialContribution(proof) && sameLineage(proof)));
  const materialByHead = new Map(validMaterials.map((proof) => [proof.head, proof]));
  const materialIds = new Set<string>();
  const lotIds = new Set<string>();
  const acceptedMaterials = validMaterials.filter((proof) => {
    if (materialIds.has(proof.contributionId) || lotIds.has(proof.lotId)) return false;
    materialIds.add(proof.contributionId); lotIds.add(proof.lotId); return true;
  });
  const workIds = new Set<string>();
  const acceptedWork = sorted(work.filter((proof) => verifyWildsWorkContribution(proof) && sameLineage(proof))).filter((proof) => {
    if (workIds.has(proof.contributionId)) return false;
    workIds.add(proof.contributionId); return true;
  });
  const recipe = wildsConstructionRecipe(component.kind);
  const requiredWork = recipe.stages.reduce((sum, stage) => sum + stage.work, 0);
  const committed = new Map<string, WildsConstructionMaterialContributionV1[]>();
  const stageWork = new Map<string, number>();
  const processed = new Set<string>();
  const applied = new Set<string>();
  const conflicts = new Set<string>();
  const invalidWork = new Set<string>();
  const workById = new Map(acceptedWork.map((proof) => [proof.contributionId, proof]));
  let pending = [...acceptedWork];
  // Topological admission of observed prior work, with contribution ID ordering for concurrent peers.
  while (pending.length) {
    let advanced = false;
    const next: typeof pending = [];
    for (const proof of pending) {
      if (proof.priorWork.some((ref) => {
        const parent = workById.get(ref.contributionId);
        return !parent || parent.head !== ref.contributionHead || parent.kaiUPulse > proof.kaiUPulse || invalidWork.has(parent.contributionId) || conflicts.has(parent.contributionId);
      })) { invalidWork.add(proof.contributionId); advanced = true; continue; }
      if (proof.priorWork.some((ref) => !processed.has(ref.contributionId))) { next.push(proof); continue; }
      advanced = true;
      const allocations = new Map<string, WildsConstructionMaterialContributionV1[]>();
      const snapshotLots = new Set<string>();
      let invalid = false;
      for (const allocation of proof.stageAllocations) {
        const cost = recipe.stages.find((stage) => stage.stage === allocation.stage)!;
        const lots: WildsConstructionMaterialContributionV1[] = [];
        for (const ref of allocation.materials) {
          const material = materialByHead.get(ref.contributionHead);
          if (!material || material.contributionId !== ref.contributionId || material.kaiUPulse > proof.kaiUPulse || snapshotLots.has(material.lotId)) { invalid = true; break; }
          snapshotLots.add(material.lotId); lots.push(material);
        }
        if (kinds.some((kind) => lots.filter((lot) => lot.kind === kind).reduce((sum, lot) => sum + lot.quantity, 0) !== cost.materials[kind])) invalid = true;
        allocations.set(allocation.stage, lots);
      }
      if (invalid || proof.priorWork.some((ref) => !applied.has(ref.contributionId))) { invalidWork.add(proof.contributionId); continue; }
      // A conflicting remote allocation is observable, never silently consumed twice.
      // Reducer admission must reject any new conflict before changing lifecycle maps.
      const sameLots = (a: WildsConstructionMaterialContributionV1[], b: WildsConstructionMaterialContributionV1[]) => equal(a.map((lot) => [lot.lotId, lot.lotHead]).sort(), b.map((lot) => [lot.lotId, lot.lotHead]).sort());
      if ([...allocations].some(([stage, lots]) => committed.has(stage) && !sameLots(committed.get(stage)!, lots))
        || [...allocations].some(([stage, lots]) => [...committed].some(([other, current]) => other !== stage && lots.some((lot) => current.some((used) => used.lotId === lot.lotId))))) {
        conflicts.add(proof.contributionId); continue;
      }
      let remaining = Math.min(requiredWork, proof.amount);
      let credited = 0;
      for (const cost of recipe.stages) {
        const current = stageWork.get(cost.stage) ?? 0;
        if (current === cost.work) continue;
        const lots = allocations.get(cost.stage);
        if (!lots || remaining === 0) break;
        const increment = Math.min(cost.work - current, remaining);
        committed.set(cost.stage, committed.get(cost.stage) ?? lots);
        stageWork.set(cost.stage, current + increment);
        credited += increment; remaining -= increment;
        if (current + increment < cost.work) break;
      }
      processed.add(proof.contributionId);
      if (credited > 0) applied.add(proof.contributionId);
    }
    if (!advanced) { next.forEach((proof) => invalidWork.add(proof.contributionId)); break; }
    pending = next;
  }
  const usedLots = new Set([...committed.values()].flatMap((lots) => lots.map((lot) => lot.lotId)));
  const assigned = (proof: WildsConstructionMaterialContributionV1): WildsConstructionAllocatedLot => ({ contributionId: proof.contributionId, contributionHead: proof.head, lotId: proof.lotId, lotHead: proof.lotHead, kind: proof.kind, quantity: proof.quantity, custodianReceizId: proof.custodianReceizId, contributorReceizId: proof.contributorReceizId });
  let reached: WildsConstructionStage = "planned";
  const stages: WildsConstructionStageProgress[] = recipe.stages.map((cost) => {
    const allocatedLots = (committed.get(cost.stage) ?? []).map(assigned);
    const stageMaterials = {} as Record<WildsBuildMaterialKind, QuantityProgress>;
    for (const kind of kinds) {
      let contributed = allocatedLots.filter((lot) => lot.kind === kind).reduce((sum, lot) => sum + lot.quantity, 0);
      for (const proof of acceptedMaterials) {
        if (contributed >= cost.materials[kind]) break;
        if (proof.kind !== kind || usedLots.has(proof.lotId)) continue;
        usedLots.add(proof.lotId); contributed += proof.quantity; allocatedLots.push(assigned(proof));
      }
      stageMaterials[kind] = quantityProgress(cost.materials[kind], contributed);
    }
    const materialsComplete = kinds.every((kind) => stageMaterials[kind].remaining === 0);
    const contributedWork = stageWork.get(cost.stage) ?? 0;
    const complete = materialsComplete && contributedWork === cost.work;
    if (complete) reached = cost.stage;
    return { stage: cost.stage, materials: stageMaterials, work: quantityProgress(cost.work, contributedWork), materialsComplete, complete, allocatedLots, embeddedLotIds: complete ? allocatedLots.map((lot) => lot.lotId) : [] };
  });
  const totals = {} as Record<WildsBuildMaterialKind, QuantityProgress>;
  for (const kind of kinds) totals[kind] = quantityProgress(stages.reduce((sum, stage) => sum + stage.materials[kind].required, 0), stages.reduce((sum, stage) => sum + stage.materials[kind].contributed, 0));
  const totalWork = quantityProgress(requiredWork, stages.reduce((sum, stage) => sum + stage.work.contributed, 0));
  const unitsRequired = requiredWork + kinds.reduce((sum, kind) => sum + totals[kind].required, 0);
  const unitsContributed = totalWork.contributed + kinds.reduce((sum, kind) => sum + totals[kind].contributed, 0);
  return freezeConstructionProof({ componentId: component.componentId, componentHead: component.head, stage: reached,
    percentage: Math.floor(100 * unitsContributed / unitsRequired), materials: totals, work: totalWork, stages,
    allocatedLotIds: stages.flatMap((stage) => stage.allocatedLots.map((lot) => lot.lotId)), embeddedLotIds: stages.flatMap((stage) => stage.embeddedLotIds),
    unusedLotIds: acceptedMaterials.filter((proof) => !usedLots.has(proof.lotId)).map((proof) => proof.lotId),
    contributorReceizIds: [...new Set([...acceptedMaterials.map((proof) => proof.contributorReceizId), ...acceptedWork.filter((proof) => applied.has(proof.contributionId)).map((proof) => proof.worker.receizId)])].sort(),
    appliedWorkContributionIds: [...applied].sort(), appliedWork: [...applied].sort().map((id) => ({ contributionId: id, contributionHead: workById.get(id)!.head })), allocationConflicts: [...conflicts].sort(), invalidWorkContributionIds: [...invalidWork].sort() });
}
