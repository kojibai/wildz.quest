import { canonicalPortableCardJson, sha256PortableBasis } from "../portable-card";
import { parseWildzPlayerCoordinate, sameWildzPlayerCoordinate } from "@/lib/receiz/wildz-player-coordinate";
import type { WildsWalletAssetSendAsset, WildsWalletAssetSendSelection } from "./wilds-wallet-asset-send";
import { createWildsWalletAssetSendReview } from "./wilds-wallet-asset-send";
import type { WildsWalletTradeReply } from "./wilds-wallet-trade-messaging";

/** A proposal describes exact selected sources. Only the native executor can settle them. */
export type WildsWalletTradePackage = Readonly<{
  phiMicro: string;
  assets: readonly WildsWalletAssetSendAsset[];
}>;
export type WildsWalletTradeDraft = Readonly<{
  schema: "wildz.wallet.trade-draft.v1";
  attemptId: string;
  recipientHandle: string;
  offered: WildsWalletTradePackage;
  requestedPhiMicro: string;
  requestNote: string;
}>;
export type WildsWalletTradeResult = Readonly<{
  status: "offered" | "pending" | "failed";
  message: string;
  tradeId?: string;
}>;
export type WildsWalletProposeTrade = (draft: WildsWalletTradeDraft, inReplyTo?: WildsWalletTradeReply) => Promise<WildsWalletTradeResult>;
export type WildsWalletTradeAgreement = Readonly<{
  schema: "wildz.wallet.trade-agreement.v1";
  purpose?:"gift";
  first: Readonly<{senderHandle: string; draft: WildsWalletTradeDraft}>;
  second: Readonly<{senderHandle: string; draft: WildsWalletTradeDraft}>;
}>;
export type WildsWalletTradeExchangeResult = Readonly<{
  status: "awaiting-peer" | "committed" | "pending" | "failed";
  message: string;
  tradeId?: string;
  /** Projection repair only after every staged native leg is verified. */
  assetRecoveryRequired?: true;
}>;
export type WildsWalletApproveTrade = (agreement: WildsWalletTradeAgreement) => Promise<WildsWalletTradeExchangeResult>;

export function createWildsWalletTradeAgreement(first: WildsWalletTradeAgreement["first"], second: WildsWalletTradeAgreement["second"],purpose?:"gift"): WildsWalletTradeAgreement {
  const left = parseWildzPlayerCoordinate(first.senderHandle), right = parseWildzPlayerCoordinate(second.senderHandle);
  if (!left || !right || left.actorId === right.actorId) throw Error("wilds_wallet_trade_peer_invalid");
  const leftDraft = admitWildsWalletTradeDraft(first.draft, left.profileHandle);
  const expectedGift:WildsWalletTradeDraft={schema:"wildz.wallet.trade-draft.v1",attemptId:`gift:receive:${sha256PortableBasis(canonicalPortableCardJson({sender:left.profileHandle,draft:leftDraft})).replace(/^sha256:/,"")}`,recipientHandle:left.profileHandle,offered:{phiMicro:"0",assets:[]},requestedPhiMicro:"0",requestNote:"Receive this gift"};
  if(purpose==="gift"&&(leftDraft.offered.phiMicro!=="0"||!leftDraft.offered.assets.length||leftDraft.requestedPhiMicro!=="0"||leftDraft.requestNote!=="Gift"||canonicalPortableCardJson(second.draft)!==canonicalPortableCardJson(expectedGift)))throw Error("wilds_wallet_gift_agreement_invalid");
  const rightDraft = purpose==="gift"?Object.freeze({...expectedGift,offered:Object.freeze({phiMicro:"0",assets:Object.freeze([])})}):admitWildsWalletTradeDraft(second.draft, right.profileHandle);
  if (!sameWildzPlayerCoordinate(leftDraft.recipientHandle, right.profileHandle) || !sameWildzPlayerCoordinate(rightDraft.recipientHandle, left.profileHandle)) throw Error("wilds_wallet_trade_recipient_invalid");
  return Object.freeze({schema: "wildz.wallet.trade-agreement.v1",...(purpose?{purpose}:{}), first: Object.freeze({senderHandle: left.profileHandle, draft: leftDraft}), second: Object.freeze({senderHandle: right.profileHandle, draft: rightDraft})});
}

export function createWildsWalletGiftAgreement(senderHandle:string,request:import("./wilds-wallet-asset-send").WildsWalletAssetSendRequest):WildsWalletTradeAgreement{
 const sender=parseWildzPlayerCoordinate(senderHandle),recipient=parseWildzPlayerCoordinate(request.recipientHandle);if(!sender||!recipient)throw Error("Choose a valid Receiz recipient.");
 const draft=createWildsWalletTradeDraft({attemptId:request.attemptId,recipient:recipient.profileHandle,selfHandle:sender.profileHandle,phiMicro:"0",requestedPhiMicro:"0",requestNote:"Gift",selections:[{selection:{id:"gift",label:"Gift",quantity:1,asset:request.asset},quantity:1}]});
 const received:WildsWalletTradeDraft={schema:"wildz.wallet.trade-draft.v1",attemptId:`gift:receive:${sha256PortableBasis(canonicalPortableCardJson({sender:sender.profileHandle,draft})).replace(/^sha256:/,"")}`,recipientHandle:sender.profileHandle,offered:{phiMicro:"0",assets:[]},requestedPhiMicro:"0",requestNote:"Receive this gift"};
 return createWildsWalletTradeAgreement({senderHandle:sender.profileHandle,draft},{senderHandle:recipient.profileHandle,draft:received},"gift");
}

const MICRO = /^(?:0|[1-9][0-9]{0,29})$/;
const ID = /^[a-z0-9][a-z0-9:._-]{0,159}$/i;

export function wildsWalletTradeAssetKeys(asset: WildsWalletAssetSendAsset): readonly string[] {
  if (asset.kind === "creature") return [`creature:${asset.assetId}`];
  if (asset.kind === "package") return [`package:${asset.packageId}`];
  return [...asset.foodItemIds, ...asset.materialLotIds, ...asset.resourceLotIds].map(id => `source:${id}`);
}

export function admitWildsWalletTradeDraft(value: unknown, selfHandle: string): WildsWalletTradeDraft {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("Saved trade review is invalid.");
  const draft = value as WildsWalletTradeDraft;
  if (draft.schema !== "wildz.wallet.trade-draft.v1" || !draft.offered || !Array.isArray(draft.offered.assets)) throw Error("Saved trade review is invalid.");
  const admitted = createWildsWalletTradeDraft({
    attemptId: draft.attemptId, recipient: draft.recipientHandle, selfHandle,
    phiMicro: draft.offered.phiMicro, requestedPhiMicro: draft.requestedPhiMicro, requestNote: draft.requestNote,
    selections: draft.offered.assets.map((asset, index) => ({
      selection: { id: `saved:${index}`, label: "Saved asset", quantity: 1, asset }, quantity: 1
    }))
  });
  if (canonicalPortableCardJson(value) !== canonicalPortableCardJson(admitted)) throw Error("Saved trade review is invalid.");
  return admitted;
}

export function createWildsWalletTradeDraft(input: {
  attemptId: string;
  recipient: string;
  selfHandle: string | null;
  phiMicro: string;
  requestedPhiMicro: string;
  requestNote: string;
  selections: readonly Readonly<{ selection: WildsWalletAssetSendSelection; quantity: number }>[];
}): WildsWalletTradeDraft {
  const recipient = parseWildzPlayerCoordinate(input.recipient);
  if (!recipient || input.selfHandle && sameWildzPlayerCoordinate(recipient.profileHandle, input.selfHandle)) throw Error("Choose another valid Receiz user.");
  if (!ID.test(input.attemptId)) throw Error("A saved trade attempt is required.");
  if (!MICRO.test(input.phiMicro) || !MICRO.test(input.requestedPhiMicro)) throw Error("Enter an exact PHI amount with up to six decimal places.");
  const note = input.requestNote.trim();
  if (note.length > 500 || /[\u0000-\u001f\u007f]/.test(note)) throw Error("Describe what you want in up to 500 characters.");
  if (input.selections.length > 32) throw Error("Choose up to 32 assets for one trade.");
  const assets = input.selections.map(({ selection, quantity }) => createWildsWalletAssetSendReview(selection, recipient.profileHandle, quantity, input.attemptId, input.selfHandle).request.asset);
  const keys = assets.flatMap(wildsWalletTradeAssetKeys);
  if (keys.length > 64 || new Set(keys).size !== keys.length || keys.some(key => key.length > 808 || key.endsWith(":"))) throw Error("Choose up to 64 distinct available units.");
  if (!assets.length && input.phiMicro === "0") throw Error("Add an asset or PHI to your trade package.");
  if (input.requestedPhiMicro === "0" && !note) throw Error("Describe the assets you want in exchange, or request PHI.");
  return Object.freeze({ schema: "wildz.wallet.trade-draft.v1", attemptId: input.attemptId, recipientHandle: recipient.profileHandle,
    offered: Object.freeze({ phiMicro: input.phiMicro, assets: Object.freeze(assets) }), requestedPhiMicro: input.requestedPhiMicro, requestNote: note });
}

/** A comparison coordinate only; a self-hash is never ownership or settlement authority. */
export function wildsWalletTradeDraftDigest(draft: WildsWalletTradeDraft) {
  return sha256PortableBasis(canonicalPortableCardJson(draft));
}

/** The exact proposal digest identifies coordination only; it grants no custody. */
export function wildsWalletTradeAgreementDigest(agreement: WildsWalletTradeAgreement) {
  return sha256PortableBasis(canonicalPortableCardJson(createWildsWalletTradeAgreement(agreement.first, agreement.second, agreement.purpose))).replace(/^sha256:/, "");
}
