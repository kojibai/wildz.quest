import type { ReceizPortableSealedArtifactV124 } from "@receiz/sdk";
import { sameWildzPlayerCoordinate } from "../../../lib/receiz/wildz-player-coordinate";
import { admitWildsWalletBearerOriginal } from "./wilds-wallet-bearer-gift-proof";
import type { WildsWalletStagedTradeLeg } from "./wilds-wallet-staged-trade-types";

export type WildsWalletResourceSourceLegV128 = Extract<WildsWalletStagedTradeLeg, { kind: "asset" }>;
export type WildsWalletResourceSourceReceiptV128 = Readonly<{
  schema: "wildz.wallet.resource-source-receipt.v128";
  legId: string; packageId: string;
  sourceArtifactSha256: string; sourcePayloadSha256: string;
  acceptedAppendId: string; acceptedHead: string; acceptedSealKai: string;
  ownerReceizId: string; authorizationDigest: string;
}>;
export type WildsWalletResourceSourceMessageV128 = Readonly<
  { kind: "trade-resource-source"; tradeId: string; legId: string; original: ReceizPortableSealedArtifactV124 } |
  { kind: "trade-resource-accepted"; tradeId: string; legId: string; receipt: WildsWalletResourceSourceReceiptV128 }
>;
export type WildsWalletResourceSourcePrivateMessageV128 = Readonly<{ senderHandle: string; recipientHandle: string; context: unknown }>;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const sha = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);

/** This is a bounded locator, not proof of acceptance. The asset port reopens
 * the actual SDK source and checks its exact recipient-authored CAS addition. */
export function admitWildsWalletResourceSourceReceiptV128(value: unknown): WildsWalletResourceSourceReceiptV128 {
  if (!object(value) || Object.keys(value).sort().join() !== "acceptedAppendId,acceptedHead,acceptedSealKai,authorizationDigest,legId,ownerReceizId,packageId,schema,sourceArtifactSha256,sourcePayloadSha256"
    || value.schema !== "wildz.wallet.resource-source-receipt.v128" || typeof value.legId !== "string" || !/^staged:[a-f0-9]{64}:(?:0|[1-9][0-9]{0,2})$/.test(value.legId)
    || typeof value.packageId !== "string" || !/^wildz:package:[a-f0-9]{64}$/.test(value.packageId)
    || !sha(value.sourceArtifactSha256) || !sha(value.sourcePayloadSha256) || !sha(value.acceptedHead) || !sha(value.authorizationDigest)
    || typeof value.acceptedAppendId !== "string" || !/^[a-z0-9][a-z0-9:._-]{5,511}$/i.test(value.acceptedAppendId)
    || typeof value.acceptedSealKai !== "string" || !/^(?:0|[1-9][0-9]*)$/.test(value.acceptedSealKai)
    || typeof value.ownerReceizId !== "string" || !/^[a-z0-9_]{3,30}\.receiz\.id$/.test(value.ownerReceizId)) throw Error("The exact resource source receipt locator is required.");
  return Object.freeze({ ...value }) as WildsWalletResourceSourceReceiptV128;
}

/** Private message routing alone never grants resource custody. */
export function admitWildsWalletResourceSourceMessageV128(value: unknown, senderHandle: string, recipientHandle: string, leg?: WildsWalletResourceSourceLegV128): WildsWalletResourceSourceMessageV128 {
  if (!object(value) || !["trade-resource-source", "trade-resource-accepted"].includes(String(value.kind))
    || Object.keys(value).sort().join() !== (value.kind === "trade-resource-source" ? "kind,legId,original,tradeId" : "kind,legId,receipt,tradeId")
    || typeof value.tradeId !== "string" || !/^staged:[a-f0-9]{64}$/.test(value.tradeId)
    || typeof value.legId !== "string" || !new RegExp(`^${value.tradeId}:(?:0|[1-9][0-9]{0,2})$`).test(value.legId)) throw Error("The exact resource source message is required.");
  if (leg && (leg.request.asset.kind === "creature" || value.legId !== leg.legId || value.tradeId !== leg.legId.slice(0, leg.legId.lastIndexOf(":"))
    || !sameWildzPlayerCoordinate(senderHandle, value.kind === "trade-resource-source" ? leg.senderHandle : leg.recipientHandle)
    || !sameWildzPlayerCoordinate(recipientHandle, value.kind === "trade-resource-source" ? leg.recipientHandle : leg.senderHandle))) throw Error("The resource message belongs to another stage or Explorer.");
  const admitted = value.kind === "trade-resource-source"
    ? { ...value, original: admitWildsWalletBearerOriginal(value.original) }
    : { ...value, receipt: admitWildsWalletResourceSourceReceiptV128(value.receipt) };
  if ("receipt" in admitted && admitted.receipt.legId !== value.legId) throw Error("The receipt belongs to another resource stage.");
  if (new TextEncoder().encode(JSON.stringify(admitted)).length > 2_000_000) throw Error("The exact resource message is too large.");
  return Object.freeze(admitted) as WildsWalletResourceSourceMessageV128;
}

export function wildsWalletResourceSourceMessageIdV128(value: WildsWalletResourceSourceMessageV128): string {
  return `${value.kind}:${value.legId}:${value.kind === "trade-resource-source" ? value.original.artifactSha256 : value.receipt.acceptedAppendId}`;
}
