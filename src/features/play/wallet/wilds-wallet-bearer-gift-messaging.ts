import type { ReceizPortableSealedArtifactV124 } from "@receiz/sdk";
import { sameWildzPlayerCoordinate } from "../../../lib/receiz/wildz-player-coordinate";
import { admitWildsWalletBearerOriginal } from "./wilds-wallet-bearer-gift-proof";
import type { WildsWalletBearerGiftLeg } from "./wilds-wallet-bearer-gift-proof";

export type WildsWalletBearerGiftMessage = Readonly<
  { kind: "trade-bearer-source"; tradeId: string; legId: string; original: ReceizPortableSealedArtifactV124; originProof: unknown; projectionOriginal: ReceizPortableSealedArtifactV124 } |
  { kind: "trade-bearer-accepted"; tradeId: string; legId: string; sourceArtifactSha256: string; original: ReceizPortableSealedArtifactV124 }
>;
export type WildsWalletBearerGiftPrivateMessage = Readonly<{ senderHandle: string; recipientHandle: string; context: unknown }>;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);

/** Message routing is private delivery only. Every Original is re-opened by the
 * SDK before it can establish source/accepted custody. */
export function admitWildsWalletBearerGiftMessage(value: unknown, senderHandle: string, recipientHandle: string, leg?: WildsWalletBearerGiftLeg): WildsWalletBearerGiftMessage {
  if (!object(value) || !["trade-bearer-source", "trade-bearer-accepted"].includes(String(value.kind))
    || Object.keys(value).sort().join(",") !== (value.kind === "trade-bearer-source" ? "kind,legId,originProof,original,projectionOriginal,tradeId" : "kind,legId,original,sourceArtifactSha256,tradeId")
    || typeof value.tradeId !== "string" || !/^staged:[a-f0-9]{64}$/.test(value.tradeId)
    || typeof value.legId !== "string" || !new RegExp(`^${value.tradeId}:(?:0|[1-9][0-9]{0,2})$`).test(value.legId)
    || value.kind === "trade-bearer-accepted" && (typeof value.sourceArtifactSha256 !== "string" || !/^[a-f0-9]{64}$/.test(value.sourceArtifactSha256))) throw Error("The exact bounded bearer gift message is required.");
  if (leg && (value.legId !== leg.legId || value.tradeId !== leg.legId.slice(0, leg.legId.lastIndexOf(":"))
    || !sameWildzPlayerCoordinate(senderHandle, value.kind === "trade-bearer-source" ? leg.senderHandle : leg.recipientHandle)
    || !sameWildzPlayerCoordinate(recipientHandle, value.kind === "trade-bearer-source" ? leg.recipientHandle : leg.senderHandle))) throw Error("This native gift message belongs to another stage or Explorer.");
  const original = admitWildsWalletBearerOriginal(value.original);
  const admitted = { ...value, original, ...(value.kind === "trade-bearer-source" ? { projectionOriginal: admitWildsWalletBearerOriginal(value.projectionOriginal) } : {}) } as WildsWalletBearerGiftMessage;
  if (new TextEncoder().encode(JSON.stringify(admitted)).length > 2_000_000) throw Error("The native gift message is too large.");
  return Object.freeze(admitted);
}

export function wildsWalletBearerGiftMessageId(value: WildsWalletBearerGiftMessage): string {
  return `${value.kind}:${value.legId}:${value.original.artifactSha256}`;
}
