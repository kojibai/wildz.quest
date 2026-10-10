import { canonicalPortableCardJson, sha256PortableBasis } from "../portable-card";
import { parseWildzPlayerCoordinate } from "../../../lib/receiz/wildz-player-coordinate";
import { createWildsWalletTradeAgreement, wildsWalletTradeAgreementDigest, type WildsWalletTradeAgreement, type WildsWalletTradeExchangeResult } from "./wilds-wallet-trade";
import type { WildsWalletAssetSendRequest, WildsWalletAssetSendResult } from "./wilds-wallet-asset-send";

export type WildsWalletStagedTradeBinding = Readonly<{ ownerHandle: string; keyId: string; identityArtifactDigest: string }>;
export type WildsWalletStagedTradeNativeSourceHead = Readonly<{ legId: string; sourceArtifactSha256: string; sourcePayloadSha256: string; artifactId: string; namespace: string; headReference: string; historyDigestSha256: string; appendCount: number; ownerHandle: string; projectionArtifactSha256: string; projectionPayloadSha256: string; projectionCardDigest: string }>;
export type WildsWalletStagedTradeResourceSourceHead = Readonly<{ protocol: "wildz.resource-source.v128"; legId: string; sourceArtifactSha256: string; sourcePayloadSha256: string; packageId: string; packageHead: string; memberIds: readonly string[]; domainId: "world:wildz:resource-custody:v128"; custodyAppendId: string; custodyHead: string; ownerHandle: string }>;
export type WildsWalletStagedTradeSourceHead = WildsWalletStagedTradeNativeSourceHead | WildsWalletStagedTradeResourceSourceHead;
export type WildsWalletStagedTradeAssetAuthority = Readonly<{ plan: WildsWalletStagedTradePlan; approvals: readonly WildsWalletStagedTradeApproval[]; acceptedNotBeforeKai: string }>;
export type WildsWalletStagedTradeAssetPort = Readonly<{
  /** Independently admit the actual source and durably retain it before returning its descriptor. */
  prepareSource(leg: Extract<WildsWalletStagedTradeLeg, { kind: "asset" }>): Promise<WildsWalletStagedTradeSourceHead>;
  /** Deliver only that exact saved Original after both whole-plan approvals. */
  sendSource(leg: Extract<WildsWalletStagedTradeLeg, { kind: "asset" }>, descriptor: WildsWalletStagedTradeSourceHead, authority: WildsWalletStagedTradeAssetAuthority): Promise<WildsWalletAssetSendResult>;
  observeSource(leg: Extract<WildsWalletStagedTradeLeg, { kind: "asset" }>, descriptor: WildsWalletStagedTradeSourceHead, locator: unknown, authority: WildsWalletStagedTradeAssetAuthority): Promise<WildsWalletStagedTradeLegOutcome>;
  verifyAccepted(leg: Extract<WildsWalletStagedTradeLeg, { kind: "asset" }>, descriptor: WildsWalletStagedTradeSourceHead, outcome: WildsWalletStagedTradeLegOutcome, authority: WildsWalletStagedTradeAssetAuthority): Promise<void>;
  /** Explicit recipient acceptance of this same approved source; ambiguous retries preserve its original attempt. */
  acceptSource?(leg: Extract<WildsWalletStagedTradeLeg, { kind: "asset" }>, descriptor: WildsWalletStagedTradeSourceHead, authority: WildsWalletStagedTradeAssetAuthority): Promise<WildsWalletStagedTradeLegOutcome>;
}>;
export type WildsWalletStagedTradeLeg = Readonly<{ legId: string; attemptId: string; senderHandle: string; recipientHandle: string } & (
  { kind: "asset"; request: WildsWalletAssetSendRequest } | { kind: "phi"; amountPhiMicro: string }
)>;
export type WildsWalletStagedTradePlan = Readonly<{ schema: "wildz.wallet.staged-trade-plan.v1"; executionMode: "staged"; tradeId: string; agreement: WildsWalletTradeAgreement; legs: readonly WildsWalletStagedTradeLeg[] }>;
export type WildsWalletStagedTradeApproval = Readonly<{ schema: "wildz.wallet.staged-trade-approval.v1"; tradeId: string; approvalId: string; sourceHeads: readonly WildsWalletStagedTradeSourceHead[]; evidence: unknown } & WildsWalletStagedTradeBinding>;
export type WildsWalletStagedTradeChallenge = Readonly<{ approvalId: string; exactChallenge: string }>;
export type WildsWalletStagedTradeLegOutcome = Readonly<{ status: "none" | "offered" | "accepted" | "committed" | "pending" | "failed"; receipt?: unknown; message?: string; projectionPending?: true }>;
export type WildsWalletStagedTradeMessage = Readonly<
  { kind: "trade-staged-approval"; plan: WildsWalletStagedTradePlan; approval: WildsWalletStagedTradeApproval } |
  { kind: "trade-staged-progress"; tradeId: string; legId: string; outcome: WildsWalletStagedTradeLegOutcome }
>;
export type WildsWalletStagedTradeResult = Readonly<{ status: "awaiting-peer" | "awaiting-acceptance" | "pending" | "completed" | "failed"; tradeId?: string; legId?: string; message: string; assetRecoveryRequired?: true }>;
export type WildsWalletStagedTradeIncomingAsset = Readonly<{ tradeId: string; leg: Extract<WildsWalletStagedTradeLeg, { kind: "asset" }>; descriptor: WildsWalletStagedTradeSourceHead; authority: WildsWalletStagedTradeAssetAuthority; status: "offered" | "pending" | "projection-pending" }>;
export type WildsWalletStagedTradeAcceptIncomingAsset = (legId: string) => Promise<WildsWalletTradeExchangeResult>;

/** Every proof port must use existing SDK admission/claim/value paths. This controller grants no authority. */
export type WildsWalletStagedTradePorts = {
  currentBinding(): WildsWalletStagedTradeBinding;
  readApprovalSources(plan: WildsWalletStagedTradePlan, binding: WildsWalletStagedTradeBinding): Promise<readonly WildsWalletStagedTradeSourceHead[]>;
  signApproval(input: { plan: WildsWalletStagedTradePlan; binding: WildsWalletStagedTradeBinding; challenge: WildsWalletStagedTradeChallenge }): Promise<WildsWalletStagedTradeApproval>;
  verifyApproval(approval: WildsWalletStagedTradeApproval, challenge: WildsWalletStagedTradeChallenge): Promise<WildsWalletStagedTradeBinding>;
  sendAsset(leg: Extract<WildsWalletStagedTradeLeg, { kind: "asset" }>): Promise<WildsWalletAssetSendResult>;
  acceptAsset?(leg: Extract<WildsWalletStagedTradeLeg, { kind: "asset" }>): Promise<WildsWalletStagedTradeLegOutcome>;
  /** Adapter durably saves the sealed native attempt before execution, using this exact attemptId as its nonce. */
  sendPhi(leg: Extract<WildsWalletStagedTradeLeg, { kind: "phi" }>): Promise<WildsWalletStagedTradeLegOutcome>;
  /** Read-only resolution of this same attempt; an unknown result never authorizes a new send. */
  observeLeg(leg: WildsWalletStagedTradeLeg): Promise<WildsWalletStagedTradeLegOutcome>;
  /** Re-admit canonical native acceptance/settlement evidence and exact sender/recipient/amount/source binding. */
  verifyLegReceipt(leg: WildsWalletStagedTradeLeg, outcome: WildsWalletStagedTradeLegOutcome): Promise<void>;
  publish(message: WildsWalletStagedTradeMessage): Promise<void>;
};

export function createWildsWalletStagedTradePlan(input: WildsWalletTradeAgreement): WildsWalletStagedTradePlan {
  const agreement = createWildsWalletTradeAgreement(input.first, input.second, input.purpose);
  const tradeId = `staged:${wildsWalletTradeAgreementDigest(agreement)}`;
  const legs: WildsWalletStagedTradeLeg[] = [];
  for (const party of [agreement.first, agreement.second]) {
    const senderHandle = party.senderHandle, recipientHandle = party.draft.recipientHandle;
    const base = () => { const legId = `${tradeId}:${legs.length}`; return { legId, attemptId: legId, senderHandle, recipientHandle }; };
    for (const asset of party.draft.offered.assets) {
      const fields = base();
      legs.push(Object.freeze({ ...fields, kind: "asset", request: Object.freeze({ attemptId: fields.attemptId, recipientHandle, asset }) }));
    }
    if (party.draft.offered.phiMicro !== "0") legs.push(Object.freeze({ ...base(), kind: "phi", amountPhiMicro: party.draft.offered.phiMicro }));
  }
  return Object.freeze({ schema: "wildz.wallet.staged-trade-plan.v1", executionMode: "staged", tradeId, agreement, legs: Object.freeze(legs) });
}

export function admitWildsWalletStagedTradeSourceHeads(plan: WildsWalletStagedTradePlan, ownerHandle: string, value: unknown): readonly WildsWalletStagedTradeSourceHead[] {
  const legs = plan.legs.filter((leg): leg is Extract<WildsWalletStagedTradeLeg, { kind: "asset" }> => leg.senderHandle === ownerHandle && leg.kind === "asset");
  if (!Array.isArray(value) || value.length !== legs.length) throw Error("The exact source heads are required for this approval.");
  const sha = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
  const heads = value.map((raw, index) => {
    const leg = legs[index]!;
    if (!raw || typeof raw !== "object" || Array.isArray(raw) || raw.legId !== leg.legId || raw.ownerHandle !== ownerHandle || !sha(raw.sourceArtifactSha256) || !sha(raw.sourcePayloadSha256)) throw Error("The exact source heads are required for this approval.");
    if (raw.protocol === "wildz.resource-source.v128") {
      if (leg.request.asset.kind === "creature" || Object.keys(raw).sort().join(",") !== "custodyAppendId,custodyHead,domainId,legId,memberIds,ownerHandle,packageHead,packageId,protocol,sourceArtifactSha256,sourcePayloadSha256"
        || raw.domainId !== "world:wildz:resource-custody:v128" || !sha(raw.custodyHead) || typeof raw.packageId !== "string" || !/^wildz:package:[a-f0-9]{64}$/.test(raw.packageId)
        || typeof raw.packageHead !== "string" || !/^sha256:[a-f0-9]{64}$/.test(raw.packageHead) || typeof raw.custodyAppendId !== "string" || !/^[a-z0-9][a-z0-9:._-]{5,511}$/i.test(raw.custodyAppendId)
        || !Array.isArray(raw.memberIds) || raw.memberIds.length < 1 || raw.memberIds.length > 64 || raw.memberIds.some((id: unknown) => typeof id !== "string" || !id || id.length > 800 || /[\u0000-\u001f\u007f]/.test(id))
        || new Set(raw.memberIds).size !== raw.memberIds.length || canonicalPortableCardJson(raw.memberIds) !== canonicalPortableCardJson([...raw.memberIds].sort())) throw Error("The exact resource source and members are required for this approval.");
      const asset = leg.request.asset;
      if (asset.kind === "package" ? raw.packageId !== asset.packageId : canonicalPortableCardJson(raw.memberIds) !== canonicalPortableCardJson([...asset.foodItemIds, ...asset.materialLotIds, ...asset.resourceLotIds].sort())) throw Error("The resource source belongs to different selected members.");
      return Object.freeze({ ...structuredClone(raw), memberIds: Object.freeze([...raw.memberIds]) }) as WildsWalletStagedTradeResourceSourceHead;
    }
    if (leg.request.asset.kind !== "creature" || Object.keys(raw).sort().join(",") !== "appendCount,artifactId,headReference,historyDigestSha256,legId,namespace,ownerHandle,projectionArtifactSha256,projectionCardDigest,projectionPayloadSha256,sourceArtifactSha256,sourcePayloadSha256"
      || !sha(raw.artifactId) || !sha(raw.historyDigestSha256) || !sha(raw.projectionArtifactSha256) || !sha(raw.projectionPayloadSha256) || !sha(raw.projectionCardDigest)
      || typeof raw.namespace !== "string" || !raw.namespace || raw.namespace.length > 256 || typeof raw.headReference !== "string" || !raw.headReference || raw.headReference.length > 800
      || !Number.isSafeInteger(raw.appendCount) || raw.appendCount < 0) throw Error("The exact native source heads are required for this approval.");
    return Object.freeze(structuredClone(raw)) as WildsWalletStagedTradeNativeSourceHead;
  });
  const sourceIds = heads.map(head => "protocol" in head ? `resource:${head.domainId}:${head.packageId}` : `native:${head.namespace}:${head.artifactId}`);
  const memberIds = heads.flatMap(head => "protocol" in head ? head.memberIds : []);
  if (new Set(sourceIds).size !== heads.length || new Set(memberIds).size !== memberIds.length) throw Error("A source or resource member cannot be included twice in one package.");
  return Object.freeze(heads);
}

export function wildsWalletStagedTradeApprovalChallenge(plan: WildsWalletStagedTradePlan, binding: WildsWalletStagedTradeBinding & { sourceHeads?: readonly WildsWalletStagedTradeSourceHead[] }): WildsWalletStagedTradeChallenge {
  if (typeof binding.ownerHandle !== "string" || parseWildzPlayerCoordinate(binding.ownerHandle)?.profileHandle !== binding.ownerHandle || typeof binding.keyId !== "string" || !binding.keyId || binding.keyId.length > 256 || typeof binding.identityArtifactDigest !== "string" || !/^[0-9a-f]{64}$/.test(binding.identityArtifactDigest)) throw Error("The verified Explorer identity is required.");
  if (![plan.agreement.first.senderHandle, plan.agreement.second.senderHandle].includes(binding.ownerHandle)) throw Error("This trade belongs to other Explorers.");
  const sourceHeads = admitWildsWalletStagedTradeSourceHeads(plan, binding.ownerHandle, binding.sourceHeads ?? []);
  const exactChallenge = canonicalPortableCardJson({ schema: "wildz.wallet.staged-trade-consent.v1", plan, binding: { ownerHandle: binding.ownerHandle, keyId: binding.keyId, identityArtifactDigest: binding.identityArtifactDigest }, sourceHeads });
  return Object.freeze({ approvalId: sha256PortableBasis(exactChallenge).replace(/^sha256:/, ""), exactChallenge });
}
