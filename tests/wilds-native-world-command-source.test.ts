import assert from "node:assert/strict";
import test from "node:test";
import { wildsWorldCommandSource, wildsWorldGroveSource, mergeWildsNativeWorldHistory } from "../src/features/play/wilds-native-world-command-source";
import { WildsWorldService, type WildsWorldCommand } from "../src/features/play/wilds-world-service";
import { checkpointWildsWorld, initialWildsWorldProjection } from "../src/features/play/wilds-world-state";
import { createWildsMaterialHarvest, createWildsStewardTool, createWildsWorkstation, initialWildsHarvestedSourceState } from "../src/features/play/wilds-steward-construction";
import { projectWildsResourceRegion } from "../src/features/play/wilds-resource-authority";
import { projectWildsRegenerativeGrove, previewWildsGroveAction, admitWildsGroveAction } from "../src/features/play/wilds-regenerative-grove";
import { deriveKaiKlokMomentFromUPulse, kaiUPulseToISOString } from "../src/features/play/kai-klok-moment";
import { projectWildsRegionalWeather } from "../src/features/play/wilds-regional-weather";
import { createWildsWorldEmissionGenesis, admitWildsEmissionOutcome } from "../src/features/play/wilds-world-emission";

const owner = "legacy-explorer", kaiUPulse = 2_000_000;
const occurredAt = kaiUPulseToISOString(kaiUPulse), authority = { actorId: owner, canonical: true, uPulse: kaiUPulse, occurredAt, pulse: occurredAt };
function toolFixture() {
  const lots = (kind: "timber" | "stone", count: number) => {
    const source = Array.from({ length: 49 }, (_, index) => projectWildsResourceRegion(index % 7 - 3, Math.floor(index / 7) - 3)).flat().find(source => source.kind === kind)!;
    let current = initialWildsHarvestedSourceState(source);
    return Array.from({ length: count }, (_, index) => {
      const result = createWildsMaterialHarvest({ source, current, ownerReceizId: owner, actorPosition: source.position, kaiUPulse: kaiUPulse - 100 + index });
      current = result.source; return result.lot;
    });
  };
  const timber = lots("timber", 4), stone = lots("stone", 3);
  const workstation = createWildsWorkstation({ ownerReceizId: owner, position: { x: 12, y: 1, z: 18 }, rotationQuarterTurns: 0,
    lots: [...timber.slice(0, 3), ...stone.slice(0, 2)], builder: { creatureSubjectId: "creature:builder", creatureHead: `sha256:${"a".repeat(64)}` }, existingStructures: [], kaiUPulse: kaiUPulse - 10 });
  return createWildsStewardTool({ kind: "steward-axe", ownerReceizId: owner, workstation, lots: [timber[3]!, stone[2]!],
    builder: { creatureSubjectId: "creature:builder", creatureHead: `sha256:${"a".repeat(64)}` }, kaiUPulse: kaiUPulse - 1 });
}

test("existing historical tool actions retain their admitted local source after native activation", () => {
  const tool = toolFixture(), legacy = { ...initialWildsWorldProjection(), stewardTools: { [tool.toolId]: tool } }, native = initialWildsWorldProjection();
  const command: WildsWorldCommand = { type: "tool.steward.equip", toolId: tool.toolId, commandId: "command:legacy:equip" };
  assert.equal(wildsWorldCommandSource(command, native, legacy), "legacy");
  const service = new WildsWorldService({ checkpoint: checkpointWildsWorld(legacy) });
  const admitted = service.execute(command, authority);
  assert.equal(admitted.projection.equippedStewardTools[owner], tool.toolId);
  assert.equal(Object.keys(native.stewardTools).length, 0, "a local action cannot import its tool into native authority");
  assert.equal(wildsWorldCommandSource(command, { ...native, stewardTools: legacy.stewardTools }, legacy), "native");
  assert.equal(wildsWorldCommandSource({ ...command, toolId: "unknown" }, native, legacy), "native");
});

test("a historical Grove action retains its exact Grove and emission ancestry", () => {
  const moment = deriveKaiKlokMomentFromUPulse({ uPulse: kaiUPulse, authority: "world" });
  const weather = projectWildsRegionalWeather({ moment, region: { x: 0, z: 0 }, biome: "grove", elevation: 0.2, waterProximity: 0.5, ecologyHead: "b".repeat(64) });
  const grove = projectWildsRegenerativeGrove({ regionId: "region:legacy", regionHead: "c".repeat(64), position: { x: 8, z: 9 }, moment, weather });
  const emission = createWildsWorldEmissionGenesis({ epochId: "epoch:legacy", epochEndsAtKaiUPulse: kaiUPulse + 100_000_000,
    globalCapacityPhiMicro: "10000000", regionCapacityPhiMicro: { "region:legacy": "10000000" }, classCapacityPhiMicro: { ecology: "10000000" }, policyDigest: "d".repeat(64) });
  const service = new WildsWorldService();
  service.execute({ type: "grove.observe", grove, emission, commandId: "command:legacy:discover" }, authority);
  const legacy = service.snapshot(), native = initialWildsWorldProjection();
  assert.equal(wildsWorldGroveSource(grove.groveId, native, legacy)?.worldEmission?.head, emission.head);
  const preview = previewWildsGroveAction({ grove, action: "observe", actor: { id: owner, head: "e".repeat(64) }, weather, moment, emission });
  assert.equal(preview.valid, true);
  const next = admitWildsGroveAction({ grove, preview }), nextEmission = admitWildsEmissionOutcome({ emission, operation: preview.operation, contributionClass: "ecology", preview: preview.emission });
  const command: WildsWorldCommand = { type: "grove.act", operation: preview.operation, grove: next, emission: nextEmission, amountPhiMicro: preview.emission.amountPhiMicro, commandId: "command:legacy:observe" };
  assert.equal(wildsWorldCommandSource(command, native, legacy), "legacy");
  assert.equal(service.execute(command, authority).projection.groves[grove.groveId].head, next.head);
  const actualNative = { ...native, groves: { [grove.groveId]: next }, worldEmission: nextEmission };
  assert.equal(wildsWorldCommandSource(command, actualNative, legacy), "native");
  assert.equal(wildsWorldGroveSource(grove.groveId, actualNative, legacy), actualNative);
});

test("native consumed or reserved members and mixed commands never route through historical gameplay", () => {
  const lot = toolFixture().consumedLotIds[0]!, initial = initialWildsWorldProjection();
  const legacy = { ...initial, materialLots: { [lot]: {} as never }, constructionComponents: { component: {} as never } };
  const native = { ...initial, materialLots: legacy.materialLots, consumedMaterialLots: { [lot]: "native:already-used" } };
  const command: WildsWorldCommand = { type: "construction.component.deposit", componentId: "component", componentHead: "f".repeat(64), lotIds: [lot], actorPosition: { x: 0, z: 0 }, commandId: "command:mixed" };
  assert.equal(wildsWorldCommandSource(command, native, legacy), "native");
  assert.equal(wildsWorldCommandSource({ type: "creation.construct" } as never, native, legacy), "native");
  assert.equal(wildsWorldCommandSource({ type: "resource.package.create" } as never, native, legacy), "native");
  assert.equal(wildsWorldCommandSource({ type: "resource.package.native-adopt", packageId: "old" } as never, native, { ...legacy, resourcePackages: { old: {} as never } }), "native");
  assert.equal(wildsWorldCommandSource(command, null, legacy), "native");
});

test("history display preserves custody and lifecycle alongside old holdings, with accepted native data overriding", () => {
  const initial = initialWildsWorldProjection(), oldCustody = { ownerReceizId: "other", subjectId: "old", subjectHead: "a", receiptId: "old", transferId: "old" };
  const legacy = { ...initial, materialLots: { old: {} as never, shared: {} as never }, materialCustody: { old: oldCustody, shared: oldCustody },
    reservedMaterialLots: { old: "legacy:package", shared: "legacy:stale" }, resourceLots: { honey: {} as never }, resourceCustody: { honey: oldCustody }, reservedResourceLots: { honey: "legacy:package" },
    consumedFoodItems: { food: "legacy:eaten" }, foodCustody: { food: { ownerReceizId: "other", packageId: "legacy", receiptId: "old" } } };
  const custody = { ...oldCustody, ownerReceizId: owner, receiptId: "native" };
  const native = { ...initial, materialLots: { shared: {} as never }, materialCustody: { shared: custody }, consumedMaterialLots: { shared: "native:consumed" } };
  const shown = mergeWildsNativeWorldHistory(legacy, native);
  assert.equal(shown.materialCustody.old, oldCustody); assert.equal(shown.materialCustody.shared, custody);
  assert.equal(shown.reservedMaterialLots.old, "legacy:package"); assert.equal(shown.reservedMaterialLots.shared, undefined);
  assert.equal(shown.consumedMaterialLots.shared, "native:consumed"); assert.equal(shown.resourceCustody.honey, oldCustody);
  assert.equal(shown.reservedResourceLots?.honey, "legacy:package"); assert.equal(shown.consumedFoodItems?.food, "legacy:eaten");
  assert.equal(native.resourceLots.honey, undefined, "displayed history never enters accepted source custody");
});
