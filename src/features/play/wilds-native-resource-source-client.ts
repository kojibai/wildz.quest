"use client";
import { receizKaiNow, readReceizCommittedNativeTradeRecoveryProofV128, createReceizNativeWorldResourceAdoptionStepV128, createReceizNativeWorldResourceUnpackStepV128, type ReceizCommittedNativeTradeV128 } from "@receiz/sdk";
import { createWildsWalletNativeSdkClient } from "./wallet/wilds-wallet-native-sdk-client";
import { createWildsResourcePackage, type WildsResourcePackageMember } from "./wilds-resource-package";
import type { WildsWalletAssetSendAsset } from "./wallet/wilds-wallet-asset-send";
import { canonicalPortableCardJson } from "./portable-card";
import { createKaiTemporalRoot } from "./kai-temporal-root";
import { deriveKaiKlokMomentFromUPulse, kaiUPulseToISOString } from "./kai-klok-moment";
import { withWildsWorldCommandKai } from "./wilds-world-authority";
import { appendWildsNativeWorldSteps, ensureWildsNativeWorldSource, wildsNativeWorldProfile, type WildsNativeWorldContext } from "./wilds-native-world-source-client";
import type { WildsNourishmentState } from "./wilds-nourishment";
import type { WildsWalletNativeOwnershipSource } from "./wallet/wilds-wallet-native-trade-context";
import { constitutionalDigest } from "./wilds-constitution";

export async function prepareWildsNativeResourceSource(input: Readonly<{ asset: WildsWalletAssetSendAsset; commandId: string; context: WildsNativeWorldContext }>): Promise<WildsWalletNativeOwnershipSource> {
  if (input.asset.kind === "creature") throw Error("wilds_native_resource_selection_invalid");
  const { context, asset } = input, owner = wildsNativeWorldProfile(context), source = await ensureWildsNativeWorldSource(context), world = source.record.checkpoint.projection;
  let packageId: string;
  if (asset.kind === "package") packageId = asset.packageId;
  else {
    const ids = [...asset.foodItemIds, ...asset.materialLotIds, ...asset.resourceLotIds];
    if (!ids.length || ids.length > 64 || new Set(ids).size !== ids.length) throw Error("wilds_native_resource_selection_invalid");
    const existing = Object.values(world.resourcePackages ?? {}).find(record => record.package.commandId === input.commandId && record.package.ownerReceizId === owner);
    if (existing) {
      const actual = existing.package.members.map(member => `${member.kind}:${member.id}`).sort();
      const expected = [...asset.foodItemIds.map(id => `food:${id}`), ...asset.materialLotIds.map(id => `material:${id}`), ...asset.resourceLotIds.map(id => `resource:${id}`)].sort();
      if (canonicalPortableCardJson(actual) !== canonicalPortableCardJson(expected)) throw Error("wilds_native_resource_attempt_substitution");
      packageId = existing.package.packageId;
    } else {
      const nourishment = (source.replay.nourishment as Record<string, WildsNourishmentState>)[owner], members: WildsResourcePackageMember[] = [];
      for (const id of asset.foodItemIds) {
        const prior = world.foodItems?.[id];
        const item = nourishment?.items[id] ?? prior?.foodItem;
        if (!item || item.consumedKaiUPulse !== undefined || world.reservedFoodItems?.[id] || world.consumedFoodItems?.[id]) throw Error("wilds_native_resource_food_source_unadmitted");
        if (world.foodCustody?.[id] && world.foodCustody[id].ownerReceizId !== owner) throw Error("wilds_native_resource_food_source_unadmitted");
        const evidence = nourishment?.items[id] ? nourishment : prior?.nourishment;
        if (!evidence) throw Error("wilds_native_resource_food_source_unadmitted");
        members.push({ kind: "food", id, foodItem: item, nourishment: evidence });
      }
      for (const id of asset.materialLotIds) {
        const lot = world.materialLots[id];
        if (!lot || (world.materialCustody[id]?.ownerReceizId ?? lot.ownerReceizId) !== owner || world.reservedMaterialLots[id] || world.consumedMaterialLots[id] || world.storedMaterialLots[id]) throw Error("wilds_native_resource_material_unavailable");
        members.push({ kind: "material", id, materialLot: lot });
      }
      for (const id of asset.resourceLotIds) {
        const lot = world.resourceLots[id];
        if (!lot || (world.resourceCustody[id]?.ownerReceizId ?? lot.ownerReceizId) !== owner || world.reservedResourceLots?.[id]) throw Error("wilds_native_resource_honey_unavailable");
        members.push({ kind: "resource", id, resourceLot: lot });
      }
      const kai = receizKaiNow().uPulse, pulse = kaiUPulseToISOString(kai);
      const pkg = createWildsResourcePackage({ ownerReceizId: owner, createdKaiUPulse: kai, commandId: input.commandId, members });
      const command = withWildsWorldCommandKai({ type: "resource.package.create", package: pkg, commandId: input.commandId }, createKaiTemporalRoot(deriveKaiKlokMomentFromUPulse({ uPulse: kai, authority: "world" })));
      await appendWildsNativeWorldSteps({ context, steps: [{ kind: "command", command, authority: { actorId: owner, canonical: true, pulse, occurredAt: pulse, uPulse: kai } }], idempotencyKey: input.commandId });
      packageId = pkg.packageId;
    }
  }
  const native = await createWildsWalletNativeSdkClient(context.authority.accessToken).nativeWorld.packageSource({ packageId });
  return { asset, predecessor: native.predecessor, artifactId: native.artifactId, head: native.head,
    ...(native.predecessorRecovery ? { predecessorRecovery: native.predecessorRecovery } : {}) };
}
/** Only a complete native receipt can authorize resource custody adoption. */
export async function adoptWildsNativeResourceRecovery(committed: ReceizCommittedNativeTradeV128, context: WildsNativeWorldContext) {
  const proof = readReceizCommittedNativeTradeRecoveryProofV128(committed);
  let step;
  try { step = await createReceizNativeWorldResourceAdoptionStepV128({ proof, kaiUPulse: receizKaiNow().uPulse }); }
  catch (error) { if (String(error).includes("V128_NATIVE_WORLD_RESOURCE_EFFECT_REQUIRED")) return; throw error; }
  const current = await ensureWildsNativeWorldSource(context);
  const receipts = current.record.checkpoint.projection.constitutionalCommandReceipts ?? {};
  if (step.commands.every(command => receipts[command.commandId]?.type === command.type
    && receipts[command.commandId]?.actorId === command.toOwnerReceizId
    && receipts[command.commandId]?.digest === constitutionalDigest(command))) return current;
  return appendWildsNativeWorldSteps({ context, steps: [step], idempotencyKey: `native-resource-adopt:${committed.receipt.receiptDigest}` });
}

export async function unpackWildsNativeResourcePackage(packageId: string, context: WildsNativeWorldContext, commandId: string) {
  const current = await ensureWildsNativeWorldSource(context);
  const record = current.record.checkpoint.projection.resourcePackages?.[packageId];
  const receipt = current.record.checkpoint.projection.constitutionalCommandReceipts?.[commandId];
  if (record?.status === "unpacked" && record.ownerReceizId === wildsNativeWorldProfile(context)
    && receipt?.type === "resource.package.unpack" && receipt.actorId === record.ownerReceizId
    && receipt.digest === constitutionalDigest({ type: "resource.package.unpack", packageId, commandId })) return current;
  const source = await createWildsWalletNativeSdkClient(context.authority.accessToken).nativeWorld.packageSource({ packageId });
  if (source.predecessorRecoveryProof) {
    const adoption = await createReceizNativeWorldResourceAdoptionStepV128({ proof: source.predecessorRecoveryProof, kaiUPulse: receizKaiNow().uPulse });
    await appendWildsNativeWorldSteps({ context, steps: [adoption], idempotencyKey: `native-resource-adopt:${source.predecessorRecoveryProof.recovery.receipt.receiptDigest}` });
  }
  const step = await createReceizNativeWorldResourceUnpackStepV128({ source: source.predecessor, proof: source.predecessorRecoveryProof ?? null, packageId, commandId, actorId: wildsNativeWorldProfile(context), kaiUPulse: receizKaiNow().uPulse });
  return appendWildsNativeWorldSteps({ context, steps: [step], idempotencyKey: commandId });
}
