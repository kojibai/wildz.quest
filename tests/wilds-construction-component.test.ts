import assert from "node:assert/strict";
import { it } from "node:test";
import { canonicalPortableCardJson, sha256PortableBasis } from "../src/features/play/portable-card";
import { createWildsConstructionProject } from "../src/features/play/wilds-construction-project";
import { createWildsConstructionComponent, verifyWildsConstructionComponent, createWildsMaterialContribution, verifyWildsMaterialContribution, createWildsWorkContribution, verifyWildsWorkContribution, projectWildsConstructionProgress } from "../src/features/play/wilds-construction-component";
import { createWildsBlueprintPreview, previewWildsBlueprintPlacement } from "../src/features/play/wilds-world-construction";
import type { WildsMaterialLotV1 } from "../src/features/play/wilds-steward-construction";

const digest = (value: unknown) => sha256PortableBasis(canonicalPortableCardJson(value));
function fixture() {
  const project = createWildsConstructionProject({ ownerReceizId: "owner", name: "Meadow", region: { x: 0, z: 0 }, kaiUPulse: 1 });
  const evidence = { sourceBlueprint: createWildsBlueprintPreview("blueprint:test", "wildz.excavation.region.v1:0:0"), pointer: { x: 2, y: 0, z: 2 }, rotationQuarterTurns: 0, heightStep: 0, physical: { terrainY: 0, waterline: null, anchors: [], solids: [] } };
  const placement = previewWildsBlueprintPlacement({ blueprint: evidence.sourceBlueprint, kind: "foundation", ...evidence });
  const input = { project, placement, evidence, ownerReceizId: "owner", kaiUPulse: 2, commandId: "place:1" };
  return { ...input, component: createWildsConstructionComponent(input) };
}
function lot(index: number, kind: WildsMaterialLotV1["kind"] = "stone"): WildsMaterialLotV1 {
  const basis = { schema: "wildz.material-lot.v1" as const, lotId: `wildz:material:${kind}:${index.toString(16).padStart(64, "0")}`, kind, quantity: 1 as const, quality: 1 as const, ownerReceizId: "creator", source: { sourceId: "source:test", sourceHead: `sha256:${"a".repeat(64)}`, admittedSourceHead: `sha256:${"b".repeat(64)}`, kaiUPulse: 1 }, contributors: { explorerReceizId: "creator" }, authority: "source-proof-object" as const };
  return { ...basis, head: digest(basis) };
}
const deposit = (component: ReturnType<typeof fixture>["component"], index: number, kind?: WildsMaterialLotV1["kind"]) => createWildsMaterialContribution({ component, lot: lot(index, kind), custodianReceizId: "owner", contributorReceizId: "owner", commandId: `deposit:${index}`, kaiUPulse: 3 });
const work = (component: ReturnType<typeof fixture>["component"], amount = 1, materials: ReturnType<typeof deposit>[] = []) => createWildsWorkContribution({ component, materials, worker: { kind: "player", receizId: "owner" }, amount, commandId: "work:1", kaiUPulse: 4 });

it("admits frozen zero-material plans only from exact production evidence and canonical recipes", () => {
  const { component, ...input } = fixture();
  assert.equal(verifyWildsConstructionComponent(component), true);
  assert.equal(Object.isFrozen(component.placement.transform), true);
  assert.equal(projectWildsConstructionProgress(component, [], []).stage, "planned");
  assert.throws(() => createWildsConstructionComponent({ ...input, evidence: { ...input.evidence, pointer: { x: 7, y: 0, z: 2 } } }));
  assert.throws(() => createWildsConstructionComponent({ ...input, placement: { ...input.placement, valid: false } }));
  const altered = { ...component, recipe: { ...component.recipe, salvagePercent: 100 } };
  const { head: _, ...basis } = altered;
  assert.equal(verifyWildsConstructionComponent({ ...basis, head: digest(basis) }), false);
});

it("binds custody, command identity, lot head, and exact stable component lineage", () => {
  const { component } = fixture();
  const material = deposit(component, 1);
  assert.equal(material.custodianReceizId, "owner");
  assert.equal(material.lot.ownerReceizId, "creator");
  assert.equal(verifyWildsMaterialContribution(material), true);
  assert.deepEqual(material, deposit(component, 1));
  assert.equal(verifyWildsMaterialContribution({ ...material, quantity: 2 }), false);
  assert.equal(verifyWildsWorkContribution(work(component)), true);
  assert.equal(verifyWildsWorkContribution({ ...work(component), amount: 0 }), false);
  assert.throws(() => createWildsMaterialContribution({ component, lot: { ...lot(1), head: "invalid" }, custodianReceizId: "owner", contributorReceizId: "owner", commandId: "bad", kaiUPulse: 3 }));
  assert.equal(projectWildsConstructionProgress(component, [{ ...material, componentHead: "invalid" }], []).materials.stone.contributed, 0);
});

it("allocates exact lots once in stage order and gates work behind complete materials", () => {
  const { component } = fixture();
  const first = deposit(component, 1);
  const duplicateLot = createWildsMaterialContribution({ component, lot: lot(1), custodianReceizId: "owner", contributorReceizId: "owner", commandId: "duplicate-lot", kaiUPulse: 3 });
  assert.equal(projectWildsConstructionProgress(component, [first, first, duplicateLot], [work(component)]).stage, "planned");
  assert.equal(projectWildsConstructionProgress(component, [first], [work(component)]).work.contributed, 0);
  const materials = [first, deposit(component, 2), deposit(component, 3), deposit(component, 4, "timber"), deposit(component, 5, "hay"), deposit(component, 6)];
  const partial = projectWildsConstructionProgress(component, materials, [work(component, 1, materials)]);
  assert.equal(partial.stage, "framed");
  assert.equal(partial.stages[0].allocatedLots.length, 2);
  assert.equal(partial.embeddedLotIds.length, 2);
  assert.equal(partial.unusedLotIds.length, 1);
  const completed = projectWildsConstructionProgress(component, materials, [work(component, 3, materials), work(component, 3, materials)]);
  assert.equal(completed.stage, "finished");
  assert.equal(completed.percentage, 100);
  assert.equal(new Set(completed.embeddedLotIds).size, 5);
  assert.deepEqual(completed, projectWildsConstructionProgress(component, [...materials].reverse(), [work(component, 3, materials)]));
});

it("seals distinct helper work evidence without conferring project permission", () => {
  const { component } = fixture();
  const materials = [deposit(component, 1), deposit(component, 2), deposit(component, 3), deposit(component, 4, "timber")];
  const helper = (id: string) => createWildsWorkContribution({ component, materials, worker: { kind: "creature", receizId: "guest", creatureSubjectId: id, creatureHead: `sha256:${"a".repeat(64)}` }, amount: 1, commandId: `work:${id}`, kaiUPulse: 4 });
  const helpers = [helper("creature:one"), helper("creature:two")];
  assert.equal(helpers.every(verifyWildsWorkContribution), true);
  const progress = projectWildsConstructionProgress(component, [deposit(component, 1), deposit(component, 2), deposit(component, 3), deposit(component, 4, "timber")], helpers);
  assert.equal(progress.stage, "functional");
  assert.equal(progress.work.contributed, 2);
});

it("freezes worked stage allocation against later earlier-sorting deposits", () => {
  const { component } = fixture();
  const deposits = [deposit(component, 11), deposit(component, 12)];
  const firstWork = createWildsWorkContribution({ component, materials: deposits, worker: { kind: "player", receizId: "owner" }, amount: 1, commandId: "first-work", kaiUPulse: 4 });
  const before = projectWildsConstructionProgress(component, deposits, [firstWork]);
  const candidates = Array.from({ length: 30 }, (_, i) => deposit(component, 30 + i));
  const earlier = candidates.find((candidate) => candidate.contributionId < deposits.map((p) => p.contributionId).sort()[0]);
  assert.ok(earlier);
  const after = projectWildsConstructionProgress(component, [...deposits, earlier], [firstWork]);
  assert.deepEqual(after.embeddedLotIds, before.embeddedLotIds);
  assert.equal(after.stages[1].allocatedLots[0].lotId, earlier.lotId);
  const missing = projectWildsConstructionProgress(component, [deposits[0]], [firstWork]);
  assert.equal(missing.work.contributed, 0);
  assert.deepEqual(missing.invalidWorkContributionIds, [firstWork.contributionId]);
});

it("never banks unfunded work and preserves partial-stage allocation across causal work proofs", () => {
  const { component } = fixture();
  const unfunded = work(component);
  const deposits = [deposit(component, 1), deposit(component, 2), deposit(component, 3), deposit(component, 4, "timber")];
  assert.equal(projectWildsConstructionProgress(component, deposits, [unfunded]).work.contributed, 0);
  const first = createWildsWorkContribution({ component, materials: deposits, worker: { kind: "player", receizId: "owner" }, amount: 1, commandId: "causal:first", kaiUPulse: 4 });
  const second = createWildsWorkContribution({ component, materials: deposits, work: [first], worker: { kind: "player", receizId: "owner" }, amount: 1, commandId: "causal:second", kaiUPulse: 5 });
  assert.deepEqual(second.priorWork, [{ contributionId: first.contributionId, contributionHead: first.head }]);
  assert.equal(projectWildsConstructionProgress(component, deposits, [second, first]).stage, "functional");
  assert.equal(projectWildsConstructionProgress(component, deposits, [second]).work.contributed, 0);
});

it("detects incompatible concurrent allocation commitments and preserves alternate lots", () => {
  const { component } = fixture();
  const firstLots = [deposit(component, 1), deposit(component, 2)];
  const secondLots = [deposit(component, 3), deposit(component, 4)];
  const makeWork = (materials: typeof firstLots, commandId: string) => createWildsWorkContribution({ component, materials, worker: { kind: "player", receizId: "owner" }, amount: 1, commandId, kaiUPulse: 4 });
  const proofs = [makeWork(firstLots, "one"), makeWork(secondLots, "two")];
  const progress = projectWildsConstructionProgress(component, [...firstLots, ...secondLots], proofs);
  assert.equal(progress.allocationConflicts.length, 1);
  assert.equal(progress.embeddedLotIds.length, 2);
  assert.equal(progress.work.contributed, 1);
  assert.deepEqual(progress, projectWildsConstructionProgress(component, [...secondLots, ...firstLots], [...proofs].reverse()));
});

it("constructs identical work evidence for reordered duplicate material command variants", () => {
  const { component } = fixture();
  const first = deposit(component, 1);
  const { head: _, ...basis } = { ...first, kaiUPulse: 4 };
  const alternate = { ...basis, head: digest(basis) };
  assert.equal(verifyWildsMaterialContribution(alternate), true);
  const second = deposit(component, 2);
  const make = (materials: typeof first[]) => createWildsWorkContribution({ component, materials, worker: { kind: "player", receizId: "owner" }, amount: 1, commandId: "stable-evidence", kaiUPulse: 5 });
  assert.deepEqual(make([first, alternate, second]), make([alternate, first, second]));
});
