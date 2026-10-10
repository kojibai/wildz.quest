import {
  readReceizCommittedNativeTradeRecoveryV128,
  verifyReceizNativeTradeRecoveryProofV128,
  receizBase64UrlDecode,
  type ReceizCommittedNativeTradeV128,
  type ReceizNativeTradeRecoveryProofV128,
  type ReceizNativeOwnershipTransitionMemberV128
} from "@receiz/sdk";
import {sameWildzPlayerCoordinate} from "./wildz-player-coordinate";

export type WildzNativeTradeCustody = Readonly<{
  artifactSha256: string;
  assetId: string;
  ownerReceizId: string;
  historyDigestSha256: string;
  exactPlanDigest: string;
  operationId: string;
}>;
const admitted = new Map<string, WildzNativeTradeCustody>();

/** Only the SDK's in-process, fully accepted group can authorize its candidate.
 * On restart, resolve/recover the durable group before reopening its assets. */
export async function qualifyWildzNativeTradeArtifact(input: Readonly<{
  committed: ReceizCommittedNativeTradeV128;
  bytes: Uint8Array;
  ownerReceizId: string;
}>): Promise<WildzNativeTradeCustody> {
  const recovery = readReceizCommittedNativeTradeRecoveryV128(input.committed);
  const sha = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", input.bytes.slice().buffer)), b => b.toString(16).padStart(2,"0")).join("");
  const member = recovery.transitionSet.members.find(raw => {
    const value = raw as ReceizNativeOwnershipTransitionMemberV128;
    return value.schema === "receiz.native-ownership-transition-member.v128" && value.candidate.artifactSha256 === sha;
  }) as ReceizNativeOwnershipTransitionMemberV128 | undefined;
  if (!member || !recovery.receipt.candidateArtifactSha256s.includes(sha)) throw Error("wildz_native_trade_candidate_missing");
  const basis = member.signedAtomicHandoff.basis;
  const exact = receizBase64UrlDecode(member.candidate.exactBytesB64u);
  const head = recovery.receipt.acceptedParticipantHeads[basis.intent.participantId];
  if (!sameWildzPlayerCoordinate(basis.intent.toOwnerReceizId, input.ownerReceizId)
    || basis.operationPlan.exactPlanDigest !== recovery.receipt.exactPlanDigest
    || !recovery.receipt.operationIds.includes(basis.operationId)
    || !head || exact.length !== input.bytes.length || exact.some((b,i) => b !== input.bytes[i])) throw Error("wildz_native_trade_candidate_mismatch");
  const result = Object.freeze({artifactSha256:sha,assetId:basis.intent.assetId,ownerReceizId:basis.intent.toOwnerReceizId,
    historyDigestSha256:head,exactPlanDigest:recovery.receipt.exactPlanDigest,operationId:basis.operationId});
  admitted.delete(sha);
  admitted.set(sha,result);
  if (admitted.size > 256) admitted.delete(admitted.keys().next().value!);
  return result;
}

/** This lookup never accepts serialized receipt/status claims as authority. */
export function readWildzNativeTradeCustody(sha: string): WildzNativeTradeCustody | null {
  return admitted.get(sha) ?? null;
}

/** Reopening a retained asset verifies its complete historical proof locally.
 * This creates no grant, sends no transfer, and performs no host request. */
export async function qualifyWildzNativeTradeArtifactProof(input: Readonly<{
  proof: ReceizNativeTradeRecoveryProofV128;
  bytes: Uint8Array;
  ownerReceizId: string;
}>): Promise<WildzNativeTradeCustody> {
  const committed = await verifyReceizNativeTradeRecoveryProofV128(input.proof, {audience: "wildz"});
  return qualifyWildzNativeTradeArtifact({...input, committed});
}
