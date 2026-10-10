import { canonicalPortableCardJson, sha256PortableBasis, verifyAnyWildsCard, type PortableCardAsset } from "./portable-card";
import { verifyPortableCardPng, parsePng } from "./portable-card-png-proof";
import { isVerifiedWildzCardDescendant } from "../../lib/receiz/wildz-card-descendant";
import { WildsWorldService, type WildsWorldAuthority, type WildsWorldCommand } from "./wilds-world-service";
import type { WildsWorldRecord } from "./wilds-world-record";
import { createWildsNourishmentState, creditWildsAnimalFood, creditWildsImportedPackageFood, consumeWildsNourishment, gatherWildsNourishment, type WildsNourishmentState, type WildsNourishmentSources } from "./wilds-nourishment";
import { captureWildsLivestock, collectWildsLivestock, createWildsLivestockState, huntWildsAnimal, type WildsLivestockState, type WildsAnimalHunter, type WildsAnimalSources } from "./wilds-livestock";
import { kaiUPulseToISOString, deriveKaiKlokMomentFromUPulse } from "./kai-klok-moment";
import { createKaiTemporalRoot } from "./kai-temporal-root";
import { withWildsWorldCommandKai } from "./wilds-world-authority";

type Position = Readonly<{ x: number; y: number; z: number }>;
type TickInput = Readonly<{ pulse: string; occurredAt: string; uPulse?: number; systemActorId: "receiz:pulse" }>;
type FoodRequest = Readonly<{ actorId: string; kaiUPulse: number; player: Position; spaceId: string }>;
export type WildzNativeFoodConsumptionReceipt = Readonly<{
  schema: "wildz.native-food-consumption.v1"; ownerReceizId: string; itemId: string; commandId: string;
  kaiUPulse: number; sourceItemDigest: string; fuelMicroBreaths: number;
}>;
export type WildzNativeWorldStep =
  | Readonly<{ kind: "command"; command: WildsWorldCommand; authority: WildsWorldAuthority }>
  | Readonly<{ kind: "resource.native-adopt"; proof: unknown; commands: readonly Extract<WildsWorldCommand, { type: "resource.package.native-adopt" }>[]; kaiUPulse: number }>
  | Readonly<{ kind: "resource.native-unpack"; source: unknown; proof: unknown; packageId: string; commandId: string; actorId: string; kaiUPulse: number; binding: Extract<WildsWorldCommand, { type: "resource.package.native-adopt" }> }>
  | Readonly<{ kind: "food.consume"; actorId: string; kaiUPulse: number; itemId: string; commandId: string; reserveMicroBreaths: number }>
  | Readonly<{ kind: "tick"; tick: "world" | "ecology" | "groves"; input: TickInput }>
  | (FoodRequest & Readonly<{ kind: "food.gather"; sourceId: string; expectedSourceHead: string }>)
  | (FoodRequest & Readonly<{ kind: "animal.hunt"; animalId: string; expectedAnimalHead: string; hunter: WildsAnimalHunter }>)
  | (FoodRequest & Readonly<{ kind: "animal.capture"; animalId: string; expectedAnimalHead: string; shelterId: string }>)
  | (FoodRequest & Readonly<{ kind: "animal.collect"; animalId: string }>);

export type WildzNativeWorldReplay = Readonly<{
  record: WildsWorldRecord;
  foodSources: WildsNourishmentSources;
  nourishment: Readonly<Record<string, WildsNourishmentState>>;
  animalSources: WildsAnimalSources;
  livestock: Readonly<Record<string, WildsLivestockState>>;
  foodConsumptionReceipts: Readonly<Record<string, WildzNativeFoodConsumptionReceipt>>;
}>;

const keys: Record<WildzNativeWorldStep["kind"], readonly string[]> = {
  command: ["kind", "command", "authority"], tick: ["kind", "tick", "input"],
  "resource.native-adopt": ["kind", "proof", "commands", "kaiUPulse"],
  "resource.native-unpack": ["kind", "source", "proof", "packageId", "commandId", "actorId", "kaiUPulse", "binding"],
  "food.consume": ["kind", "actorId", "kaiUPulse", "itemId", "commandId", "reserveMicroBreaths"],
  "food.gather": ["kind", "actorId", "kaiUPulse", "player", "spaceId", "sourceId", "expectedSourceHead"],
  "animal.hunt": ["kind", "actorId", "kaiUPulse", "player", "spaceId", "animalId", "expectedAnimalHead", "hunter"],
  "animal.capture": ["kind", "actorId", "kaiUPulse", "player", "spaceId", "animalId", "expectedAnimalHead", "shelterId"],
  "animal.collect": ["kind", "actorId", "kaiUPulse", "player", "spaceId", "animalId"]
};

/** Decodes only the payload already admitted by the native root verifier. */
export function readWildzNativeWorldCardPayload(bytes: Uint8Array) {
  const result = verifyPortableCardPng(bytes);
  if (!result.ok || !result.asset) throw Error("native_world_card_payload_invalid");
  const appends = parsePng(bytes).filter(chunk => chunk.type === "rzWx");
  if (appends.length > 1) throw Error("native_world_card_payload_invalid");
  if (!appends.length) return result.asset;
  const append = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(appends[0]!.data));
  if (append.schema !== "receiz.wildz_proof_append.v1" || (append.kind !== undefined && append.kind !== "card")
    || append.base?.assetId !== result.asset.id || append.base?.proofDigest !== result.asset.proof.digest
    || !verifyAnyWildsCard(append.asset).ok || !isVerifiedWildzCardDescendant(result.asset, append.asset)) throw Error("native_world_card_payload_invalid");
  return append.asset as PortableCardAsset;
}
/** A keeper changes native title; a causal sidecar preserves card genesis. */
export function matchesWildzNativeWorldCardProjection(bytes: Uint8Array, current: PortableCardAsset) {
  const original = readWildzNativeWorldCardPayload(bytes);
  return verifyAnyWildsCard(current).ok && (canonicalPortableCardJson(original) === canonicalPortableCardJson(current)
    || isVerifiedWildzCardDescendant(original, current));
}
function exactStep(value: WildzNativeWorldStep) {
  if (!value || typeof value !== "object" || !Object.hasOwn(keys, value.kind)
    || Object.keys(value).sort().join(",") !== [...keys[value.kind]].sort().join(",")) throw Error("native_world_step_invalid");
}

/** The host bundles this exact existing reducer graph. No caller checkpoint,
 * local food save or unsigned resource count supplies the initial state.
 * Device/peer/native-artifact admission happens before this deterministic law. */
export function replayWildzNativeWorldLaw(steps: readonly WildzNativeWorldStep[]): WildzNativeWorldReplay {
  if (!Array.isArray(steps)) throw Error("native_world_steps_invalid");
  const world = new WildsWorldService();
  let foodSources: WildsNourishmentSources = {};
  let animalSources: WildsAnimalSources = {};
  const nourishment: Record<string, WildsNourishmentState> = {};
  const livestock: Record<string, WildsLivestockState> = {};
  const foodConsumptionReceipts: Record<string, WildzNativeFoodConsumptionReceipt> = {};
  for (const step of steps) {
    exactStep(step);
    if (step.kind === "resource.native-adopt") {
      if (!step.proof || !Array.isArray(step.commands) || !step.commands.length) throw Error("native_world_native_receipt_required");
      for (const command of step.commands) {
        if (command.type !== "resource.package.native-adopt") throw Error("native_world_native_receipt_invalid");
        const pulse = kaiUPulseToISOString(step.kaiUPulse);
        world.execute(withWildsWorldCommandKai(command, createKaiTemporalRoot(deriveKaiKlokMomentFromUPulse({ uPulse: step.kaiUPulse, authority: "world" }))), { actorId: command.toOwnerReceizId, canonical: true, pulse, occurredAt: pulse, uPulse: step.kaiUPulse });
      }
      continue;
    }
    if (step.kind === "resource.native-unpack") {
      const pulse = kaiUPulseToISOString(step.kaiUPulse);
      world.execute(withWildsWorldCommandKai(step.binding, createKaiTemporalRoot(deriveKaiKlokMomentFromUPulse({ uPulse: step.kaiUPulse, authority: "world" }))), { actorId: step.actorId, canonical: true, pulse, occurredAt: pulse, uPulse: step.kaiUPulse });
      world.execute(withWildsWorldCommandKai({ type: "resource.package.unpack", packageId: step.packageId, commandId: step.commandId }, createKaiTemporalRoot(deriveKaiKlokMomentFromUPulse({ uPulse: step.kaiUPulse, authority: "world" }))), { actorId: step.actorId, canonical: true, pulse, occurredAt: pulse, uPulse: step.kaiUPulse });
      continue;
    }
    if (step.kind === "tick") {
      if (step.tick === "world") world.tick(step.input);
      else if (step.tick === "ecology") world.tickEcology(step.input);
      else if (step.tick === "groves") world.tickGroves(step.input);
      else throw Error("native_world_tick_invalid");
      continue;
    }
    if (step.kind === "command") {
      // Packaging must originate in this complete shared gather history.
      // A self-consistent local nourishment checkpoint is insufficient.
      if (step.command.type === "resource.package.create") {
        for (const member of step.command.package.members) {
          if (member.kind !== "food") continue;
          const projection = world.snapshot();
          const actual = nourishment[step.authority.actorId]?.items[member.id] ?? (projection.foodCustody?.[member.id]?.ownerReceizId === step.authority.actorId ? projection.foodItems?.[member.id]?.foodItem : undefined);
          if (!actual || actual.consumedKaiUPulse !== undefined
            || canonicalPortableCardJson(actual) !== canonicalPortableCardJson(member.foodItem)) throw Error("native_world_food_source_unadmitted");
        }
      }
      world.execute(step.command, step.authority);
      continue;
    }
    if (!step.actorId || step.actorId.trim() !== step.actorId) throw Error("native_world_food_actor_invalid");
    let food = nourishment[step.actorId] ?? createWildsNourishmentState(step.actorId);
    if (step.kind === "food.consume") {
      const projection = world.snapshot();
      if (projection.reservedFoodItems?.[step.itemId] || projection.consumedFoodItems?.[step.itemId] || projection.foodCustody?.[step.itemId] && projection.foodCustody[step.itemId].ownerReceizId !== step.actorId) throw Error("native_world_food_unavailable");
      if (!food.items[step.itemId]) {
        const member = projection.foodItems?.[step.itemId], custody = projection.foodCustody?.[step.itemId];
        if (!member || !custody) throw Error("native_world_food_source_unadmitted");
        food = creditWildsImportedPackageFood(food, [member], custody, step.kaiUPulse);
      }
      const result = consumeWildsNourishment({ state: food, ownerReceizId: step.actorId, itemId: step.itemId, kaiUPulse: step.kaiUPulse, reserveMicroBreaths: step.reserveMicroBreaths });
      if (!result.ok) throw Error(`native_world_food_consume:${result.reason}`);
      if (!step.commandId || step.commandId.trim() !== step.commandId || Object.values(foodConsumptionReceipts).some(receipt => receipt.commandId === step.commandId)) throw Error("native_world_food_consume_command_invalid");
      foodConsumptionReceipts[step.itemId] = { schema: "wildz.native-food-consumption.v1", ownerReceizId: step.actorId,
        itemId: step.itemId, commandId: step.commandId, kaiUPulse: step.kaiUPulse,
        sourceItemDigest: sha256PortableBasis(canonicalPortableCardJson(result.item)), fuelMicroBreaths: Math.round(result.fuelBreaths * 1_000_000) };
      nourishment[step.actorId] = result.state;
      if (projection.foodItems?.[step.itemId]) {
        const pulse = kaiUPulseToISOString(step.kaiUPulse);
        world.execute(withWildsWorldCommandKai({ type: "resource.food.consume", itemId: step.itemId, commandId: step.commandId }, createKaiTemporalRoot(deriveKaiKlokMomentFromUPulse({ uPulse: step.kaiUPulse, authority: "world" }))), { actorId: step.actorId, canonical: true, pulse, occurredAt: pulse, uPulse: step.kaiUPulse });
      }
      continue;
    }
    if (step.kind === "food.gather") {
      const gathered = gatherWildsNourishment({ ...step, state: food, ownerReceizId: step.actorId, sourceStates: foodSources });
      if (!gathered.ok) throw Error(`native_world_food_gather:${gathered.reason}`);
      foodSources = { ...foodSources, [step.sourceId]: gathered.sourceState };
      nourishment[step.actorId] = gathered.state;
      continue;
    }
    const animals = livestock[step.actorId] ?? createWildsLivestockState(step.actorId);
    const base = { ...step, state: animals, ownerReceizId: step.actorId };
    const projection = world.snapshot();
    const result = step.kind === "animal.hunt"
      ? huntWildsAnimal({ ...base, expectedAnimalHead: step.expectedAnimalHead, sourceStates: animalSources,
        hunter: step.hunter.kind === "tool" ? { kind: "tool", world: projection } : step.hunter, admittedKeeperReceizId: step.actorId })
      : step.kind === "animal.capture"
        ? captureWildsLivestock({ ...base, expectedAnimalHead: step.expectedAnimalHead, shelterId: step.shelterId, sourceStates: animalSources, world: projection })
        : collectWildsLivestock({ ...base, world: projection });
    if (!result.ok) throw Error(`native_world_${step.kind}:${result.reason}`);
    animalSources = { ...animalSources, [step.animalId]: result.source };
    livestock[step.actorId] = result.state;
    if (result.foodReceipt) {
      const credited = creditWildsAnimalFood(food, result.foodReceipt);
      if (!credited.ok) throw Error(`native_world_food_credit:${credited.reason}`);
      nourishment[step.actorId] = credited.state;
    }
  }
  return { record: { checkpoint: world.checkpoint(), eventTail: world.events() }, foodSources, nourishment, animalSources, livestock, foodConsumptionReceipts };
}
