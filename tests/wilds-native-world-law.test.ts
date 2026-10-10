import assert from "node:assert/strict";
import { test } from "node:test";
import { replayWildzNativeWorldLaw, type WildzNativeWorldStep } from "../src/features/play/wildz-native-world-law";
import { WildsWorldService } from "../src/features/play/wilds-world-service";
import { WILDS_WORLD_GENESIS_PULSE } from "../src/features/play/wilds-world-genesis";
import { wildsNourishmentPlantsForTile, wildsNourishmentSourceAt } from "../src/features/play/wilds-nourishment";
import { canonicalPortableCardJson, sha256PortableBasis } from "../src/features/play/portable-card";
import { initialPlayState } from "../src/features/play/game-state";
import { wildsWildAnimalsForTile, projectWildsWildAnimalPosition } from "../src/features/play/wilds-animal-ecology";
import { wildsAnimalHead } from "../src/features/play/wilds-livestock";

test("native world replay starts from empty lawful genesis and cannot import saved balances", () => {
  const replayed = replayWildzNativeWorldLaw([]);
  assert.deepEqual(replayed.record, { checkpoint: new WildsWorldService().checkpoint(), eventTail: [] });
  assert.deepEqual(replayed.nourishment, {});
  assert.throws(() => replayWildzNativeWorldLaw([{ kind: "checkpoint", checkpoint: replayed.record.checkpoint }] as never), /native_world_step_invalid/);
});

test("native system source captures exact ticks and replays the actual grove genesis", () => {
  const input = { pulse: WILDS_WORLD_GENESIS_PULSE, occurredAt: WILDS_WORLD_GENESIS_PULSE, systemActorId: "receiz:pulse" as const };
  const steps: WildzNativeWorldStep[] = [{ kind: "tick", tick: "groves", input }];
  const expected = new WildsWorldService(); expected.tickGroves(input);
  assert.deepEqual(replayWildzNativeWorldLaw(steps).record, { checkpoint: expected.checkpoint(), eventTail: expected.events() });
});

test("native food source derives every actual portion and consumes a shared plant slot once", () => {
  const plant = wildsNourishmentPlantsForTile(-4, -4).find(p => p.foodKind === "orchard-fruit")!;
  const kaiUPulse = 100;
  const gather = { kind: "food.gather" as const, actorId: "explorer", sourceId: plant.sourceId, expectedSourceHead: wildsNourishmentSourceAt(plant, undefined, kaiUPulse).head, kaiUPulse, player: plant.position, spaceId: "wildz.space.outer.v1" };
  const first = replayWildzNativeWorldLaw([gather]);
  assert.equal(Object.keys(first.nourishment.explorer.items).length, 1);
  assert.equal(first.foodSources[plant.sourceId].harvested, 1);
  assert.throws(() => replayWildzNativeWorldLaw([gather, { ...gather, actorId: "other" }]), /native_world_food_gather:stale-source/);
  assert.throws(() => replayWildzNativeWorldLaw([{ ...gather, player: { ...plant.position, x: plant.position.x + 50 } }]), /out-of-reach/);
  const secondHead = wildsNourishmentSourceAt(plant, first.foodSources[plant.sourceId], kaiUPulse).head;
  const second = replayWildzNativeWorldLaw([gather, { ...gather, actorId: "other", expectedSourceHead: secondHead }]);
  assert.equal(Object.keys(second.nourishment.other.items).length, 1);
  assert.equal(second.foodSources[plant.sourceId].harvested, 2);
});

test("every native gathered meal retains exact fuel and original-source evidence for lost-reply recovery", () => {
  const plant = wildsNourishmentPlantsForTile(-4, -4).find(plant => plant.foodKind === "orchard-fruit")!, kaiUPulse = 100;
  const gather: WildzNativeWorldStep = { kind: "food.gather", actorId: "explorer", sourceId: plant.sourceId, expectedSourceHead: wildsNourishmentSourceAt(plant, undefined, kaiUPulse).head, kaiUPulse, player: plant.position, spaceId: "wildz.space.outer.v1" };
  const first = replayWildzNativeWorldLaw([gather]), item = Object.values(first.nourishment.explorer.items)[0]!;
  const consume: WildzNativeWorldStep = { kind: "food.consume", actorId: "explorer", itemId: item.itemId, commandId: "native:consume:lost-reply", kaiUPulse, reserveMicroBreaths: 0 };
  const accepted = replayWildzNativeWorldLaw([gather, consume]);
  assert.deepEqual(accepted.foodConsumptionReceipts[item.itemId], { schema: "wildz.native-food-consumption.v1", ownerReceizId: "explorer", itemId: item.itemId,
    commandId: consume.commandId, kaiUPulse, sourceItemDigest: sha256PortableBasis(canonicalPortableCardJson(item)), fuelMicroBreaths: Math.round(plant.fuelBreaths * 1_000_000) });
  assert.deepEqual(replayWildzNativeWorldLaw(JSON.parse(JSON.stringify([gather, consume]))).foodConsumptionReceipts, accepted.foodConsumptionReceipts);
  assert.deepEqual(first.foodConsumptionReceipts, {});
  assert.throws(() => replayWildzNativeWorldLaw([gather, consume, { ...consume, commandId: "native:consume:duplicate" }]), /already-consumed/);
});

test("a native animal meal has the same recoverable receipt bound to its exact admitted hunt", () => {
  const animal = Array.from({ length: 81 }, (_, index) => wildsWildAnimalsForTile(index % 9 - 4, Math.floor(index / 9) - 4)).flat().find(animal => animal.species === "ground-bird")!, kaiUPulse = 100_000_000;
  const asset = initialPlayState.inventory[0]!, actorId = asset.manifest.ownerReceizId;
  const hunt: WildzNativeWorldStep = { kind: "animal.hunt", actorId, animalId: animal.animalId, expectedAnimalHead: wildsAnimalHead(animal.animalId), kaiUPulse,
    player: projectWildsWildAnimalPosition(animal, kaiUPulse).position, spaceId: "wildz.space.outer.v1", hunter: { kind: "creature", asset, condition: initialPlayState.adventureConditions[asset.id], abilityIndex: 0 } };
  const first = replayWildzNativeWorldLaw([hunt]), item = Object.values(first.nourishment[actorId].items)[0]!;
  const consume: WildzNativeWorldStep = { kind: "food.consume", actorId, itemId: item.itemId, commandId: "native:animal:meal", kaiUPulse, reserveMicroBreaths: 0 };
  const accepted = replayWildzNativeWorldLaw([hunt, consume]), receipt = accepted.foodConsumptionReceipts[item.itemId];
  assert.equal(receipt.sourceItemDigest, sha256PortableBasis(canonicalPortableCardJson(item)));
  assert.equal(receipt.fuelMicroBreaths, accepted.nourishment[actorId].items[item.itemId].consumedFuelMicroBreaths);
  assert.throws(() => replayWildzNativeWorldLaw([consume]), /source_unadmitted/);
});

import { createWildsResourcePackage } from '../src/features/play/wilds-resource-package';
import { withWildsWorldCommandKai } from '../src/features/play/wilds-world-authority';
import { createKaiTemporalRoot } from '../src/features/play/kai-temporal-root';
import { deriveKaiKlokMomentFromUPulse, kaiUPulseToISOString } from '../src/features/play/kai-klok-moment';
test('native food may be packed from its admitted gather history and cannot be eaten while reserved or repacked after use',()=>{
 const plant=wildsNourishmentPlantsForTile(-4,-4).find(p=>p.foodKind==='orchard-fruit')!,kaiUPulse=100;
 const gather={kind:'food.gather' as const,actorId:'explorer',sourceId:plant.sourceId,expectedSourceHead:wildsNourishmentSourceAt(plant,undefined,kaiUPulse).head,kaiUPulse,player:plant.position,spaceId:'wildz.space.outer.v1'};
 const first=replayWildzNativeWorldLaw([gather]),food=first.nourishment.explorer,item=Object.values(food.items)[0]!;
 const pkg=createWildsResourcePackage({ownerReceizId:'explorer',createdKaiUPulse:kaiUPulse,commandId:'native:pack',members:[{kind:'food',id:item.itemId,foodItem:item,nourishment:food}]}),pulse=kaiUPulseToISOString(kaiUPulse);
 const pack={kind:'command' as const,command:withWildsWorldCommandKai({type:'resource.package.create' as const,package:pkg,commandId:'native:pack'},createKaiTemporalRoot(deriveKaiKlokMomentFromUPulse({uPulse:kaiUPulse,authority:'world'}))),authority:{actorId:'explorer',canonical:true,pulse,occurredAt:pulse,uPulse:kaiUPulse}};
 const packed=replayWildzNativeWorldLaw([gather,pack]);assert.equal(packed.record.checkpoint.projection.reservedFoodItems?.[item.itemId],pkg.packageId);
 assert.throws(()=>replayWildzNativeWorldLaw([pack]),/food_source_unadmitted/,'a valid-looking local food proof alone cannot mint native custody');
 const consume={kind:'food.consume' as const,actorId:'explorer',itemId:item.itemId,commandId:'native:meal',kaiUPulse,reserveMicroBreaths:0};
 assert.throws(()=>replayWildzNativeWorldLaw([gather,pack,consume]),/food_unavailable/);
 const eaten=replayWildzNativeWorldLaw([gather,consume]);assert.equal(eaten.nourishment.explorer.items[item.itemId].consumedKaiUPulse,kaiUPulse);
 assert.throws(()=>replayWildzNativeWorldLaw([gather,consume,pack]),/food_source_unadmitted/);
 assert.throws(()=>replayWildzNativeWorldLaw([gather,consume,consume]),/food_consume:already-consumed/);
});


import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

test("installed native host law retains the exact current gameplay source graph and replay", async () => {
  const sdkRoot = dirname(createRequire(import.meta.url).resolve("@receiz/sdk"));
  const { WILDZ_NATIVE_WORLD_LAW_DIGEST, WILDZ_NATIVE_WORLD_LAW_SOURCE: manifest } = await import(pathToFileURL(resolve(sdkRoot, "wildzNativeWorldLawManifest.generated.js")).href);
  const sha = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
  assert.equal(sha(JSON.stringify(manifest)), WILDZ_NATIVE_WORLD_LAW_DIGEST);
  assert.ok(manifest.sourceFiles.length > 100);
  for (const source of manifest.sourceFiles as { path: string; sha256: string }[]) {
    assert.ok(source.path.startsWith("src/") && !source.path.split("/").includes(".."));
    assert.equal(sha(await readFile(resolve(process.cwd(), source.path))), source.sha256, `native law source drift: ${source.path}`);
  }
  const installed = await import(pathToFileURL(resolve(sdkRoot, "wildzNativeWorldLaw.generated.js")).href);
  // tsc may format the distributed JS. Verify its replay against the actual
  // source law rather than requiring source and compiled formatting to match.
  const plant = wildsNourishmentPlantsForTile(-4, -4).find(p => p.foodKind === "orchard-fruit")!;
  const gather: WildzNativeWorldStep = { kind: "food.gather", actorId: "explorer", sourceId: plant.sourceId,
    expectedSourceHead: wildsNourishmentSourceAt(plant, undefined, 100).head, kaiUPulse: 100,
    player: plant.position, spaceId: "wildz.space.outer.v1" };
  assert.deepEqual(installed.replayWildzNativeWorldLaw([]), replayWildzNativeWorldLaw([]));
  assert.deepEqual(installed.replayWildzNativeWorldLaw([gather]), replayWildzNativeWorldLaw([gather]));
});
