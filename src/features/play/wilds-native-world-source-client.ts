"use client";
import { createReceizProofAuthorityChallenge, digestReceizCanonicalV122, receizKaiNow, signReceizIdentityLoginProof, signReceizNativeWorldApprovalV128, type ReceizKeyFile, type ReceizNativeOwnershipIdentityV128, type ReceizProofAuthorityV123, type ReceizPortableSealedArtifactV124, type ReceizNativeTradeRecoveryProofV128 } from "@receiz/sdk";
import { createWildsWalletNativeSdkClient } from "./wallet/wilds-wallet-native-sdk-client";
import { defaultIdentityRepository } from "@/lib/receiz/wildz-active-identity";
import { readWildzIdentityForSigning } from "@/lib/receiz/wildz-identity-signing-read";
import { createWildzIdentityAuthorizationArtifact } from "@/lib/receiz/wildz-identity-authorization-artifact";
import { WILDZ_RECEIZ_APPLICATION_ID } from "@/lib/receiz/wildz-application";
import { kaiUPulseToISOString } from "./kai-klok-moment";
import type { WildzNativeWorldStep } from "./wildz-native-world-law";
import type { WildsWorldRecord } from "./wilds-world-record";
import type { WildsNourishmentState } from "./wilds-nourishment";

export type WildsNativeWorldContext = Readonly<{ keyFile: ReceizKeyFile; authority: ReceizProofAuthorityV123; identity(): Promise<ReceizNativeOwnershipIdentityV128> }>;
export function wildsNativeWorldProfile(context: WildsNativeWorldContext) {
  const username = context.keyFile.owner.username;
  if (!username) throw Error("wilds_native_world_profile_required");
  return `${username.replace(/\.receiz\.id$/i, "").toLowerCase()}.receiz.id`;
}
export function nativeWorldRecord(value: Record<string, unknown>): WildsWorldRecord {
  const r = value.record as WildsWorldRecord | undefined;
  if (!r?.checkpoint?.projection || !Array.isArray(r.eventTail)) throw Error("wilds_native_world_record_required");
  return r;
}
export async function createActiveWildsNativeWorldContext(consent: unknown): Promise<WildsNativeWorldContext> {
  const session = await defaultIdentityRepository.active();
  if (!session || session.localAuthority !== "verified") throw Error("wilds_native_world_identity_required");
  const keyFile = await readWildzIdentityForSigning(session.keyId), transport = await createWildzIdentityAuthorizationArtifact(keyFile);
  const scopes = ["openid", "profile", "receiz:record", "receiz:seal", "receiz:subjects.read", "receiz:subjects.write"].sort();
  const issued = createReceizProofAuthorityChallenge({ applicationId: WILDZ_RECEIZ_APPLICATION_ID, artifactDigest: transport.artifactDigest, scopes, consentStatementDigest: await digestReceizCanonicalV122({ schema: "wildz.native-world-device-consent.v128", consent }), ttlPulses: 60 });
  const proof = await signReceizIdentityLoginProof({ keyFile, challengeB64Url: issued.challengeB64Url }), client = createWildsWalletNativeSdkClient();
  const authority = await client.identity.exchangeProofAuthority({ artifact: transport.artifact, challenge: { ...issued.challenge, proof }, applicationId: WILDZ_RECEIZ_APPLICATION_ID, scopes });
  if (authority.keyId !== session.keyId || (await defaultIdentityRepository.active())?.keyId !== session.keyId) throw Error("wilds_native_world_identity_changed");
  let identity: Promise<ReceizNativeOwnershipIdentityV128> | undefined;
  const context: WildsNativeWorldContext = { keyFile, authority, identity: () => identity ??= client.nativeTrade.identitySource({ applicationId: WILDZ_RECEIZ_APPLICATION_ID, ownerReceizId: wildsNativeWorldProfile(context), keyFile, authority }) };
  return context;
}
export async function prepareWildsNativeWorldCardSource(card: import('./portable-card').PortableCardAsset, owner: string) {
  const { prepareWildsRoamingOwnerFile } = await import('@/lib/receiz/wilds-roaming-source-browser');
  const { readWildsWalletNativeAcceptedProof } = await import('./wallet/wilds-wallet-native-trade-attempt-store');
  const { receizBase64UrlEncode } = await import('@receiz/sdk');
  const source = await prepareWildsRoamingOwnerFile(card, owner);
  const predecessor: ReceizPortableSealedArtifactV124 = { schema: 'receiz.sealed-artifact-bytes.v124', exactBytesB64u: receizBase64UrlEncode(source.artifactBytes), filename: source.filename, mimeType: source.mimeType, artifactSha256: source.artifactSha256, payloadSha256: source.payloadSha256 };
  const proof = await readWildsWalletNativeAcceptedProof(owner, source.artifactSha256);
  return { predecessor, recovery: proof ? { artifactSha256: source.artifactSha256, proof } : null };
}
export async function prepareWildsNativeCreationWorkerSource(worker: import('./creation/world-source').WildsCreationWorkerSource, owner: string): Promise<import('./creation/world-source').WildsCreationWorkerSource> {
  const { sameWildzPlayerCoordinate } = await import('@/lib/receiz/wildz-player-coordinate');
  if (sameWildzPlayerCoordinate(worker.card.manifest.ownerReceizId, owner)) return worker;
  const { prepareWildsRoamingOwnerFile } = await import('@/lib/receiz/wilds-roaming-source-browser');
  const source = await prepareWildsRoamingOwnerFile(worker.card, owner), keeper = source.nativeTradeCustody;
  if (!keeper || keeper.artifactSha256 !== source.artifactSha256 || keeper.ownerReceizId !== owner) throw Error('creation_world_native_keeper_source_required');
  return { ...worker, nativeKeeper: { schema: 'wildz.creation-native-keeper.v128', ownerReceizId: owner, assetId: worker.card.id,
    cardProofDigest: worker.card.proof.digest, artifactSha256: source.artifactSha256, nativeHead: keeper.historyDigestSha256 } };
}
export async function appendWildsNativeWorldSteps(input: Readonly<{ steps: readonly WildzNativeWorldStep[]; idempotencyKey: string; context: WildsNativeWorldContext; cardSources?: readonly ReceizPortableSealedArtifactV124[]; cardRecoveryProofs?: readonly Readonly<{artifactSha256: string; proof: ReceizNativeTradeRecoveryProofV128}>[] }>) {
  const { context } = input, client = createWildsWalletNativeSdkClient(context.authority.accessToken);
  const plan = await client.nativeWorld.plan({ steps: input.steps, actorReceizId: context.keyFile.owner.uid, profileHandle: wildsNativeWorldProfile(context), cardSources: input.cardSources ?? [], cardRecoveryProofs: input.cardRecoveryProofs ?? [] });
  const identity = await context.identity(), proof = await signReceizNativeWorldApprovalV128({ basis: plan.basis, keyFile: context.keyFile });
  const accepted = await client.nativeWorld.append({ predecessor: plan.predecessor, approval: { basis: plan.basis, identity, proof }, idempotencyKey: input.idempotencyKey });
  if (accepted.status !== "admitted" && accepted.status !== "replayed") throw Error(typeof accepted.code === "string" ? accepted.code : "wilds_native_world_head_conflict");
  return { raw: accepted, record: nativeWorldRecord(accepted), replay: accepted.replay as Record<string, unknown> };
}
export async function ensureWildsNativeWorldSource(context: WildsNativeWorldContext) {
  const client = createWildsWalletNativeSdkClient(context.authority.accessToken);
  let source = await client.nativeWorld.readLatest();
  if (!source) {
    try { await appendWildsNativeWorldSteps({ context, steps: [], idempotencyKey: "wildz:native-world:genesis" }); }
    catch (error) { if (!String(error).includes("HEAD_CONFLICT")) throw error; }
    source = await client.nativeWorld.readLatest();
  }
  if (!source) throw Error("wilds_native_world_source_unavailable");
  if (nativeWorldRecord(source).checkpoint.revision === 0) {
    const kai = receizKaiNow().uPulse, pulse = kaiUPulseToISOString(kai), input = { pulse, occurredAt: pulse, uPulse: kai, systemActorId: "receiz:pulse" as const };
    try { await appendWildsNativeWorldSteps({ context, steps: [{ kind: "tick", tick: "world", input }, { kind: "tick", tick: "ecology", input }, { kind: "tick", tick: "groves", input }], idempotencyKey: "wildz:native-world:lawful-bootstrap" }); }
    catch (error) { if (!String(error).includes("HEAD_CONFLICT")) throw error; }
    source = await client.nativeWorld.readLatest();
  }
  if (!source) throw Error("wilds_native_world_source_unavailable");
  return { raw: source, record: nativeWorldRecord(source), replay: source.replay };
}
/** Only the root-admitted replay can credit the shared gathered slot locally. */
export async function gatherWildsNativeWorldFood(step: Extract<WildzNativeWorldStep, { kind: "food.gather" | "animal.hunt" | "animal.capture" | "animal.collect" }>, context?: WildsNativeWorldContext, cardSources: readonly ReceizPortableSealedArtifactV124[] = [], cardRecoveryProofs: readonly Readonly<{artifactSha256: string; proof: ReceizNativeTradeRecoveryProofV128}>[] = []) {
  const held = context ?? await createActiveWildsNativeWorldContext(step);
  if (step.actorId !== wildsNativeWorldProfile(held)) throw Error("wilds_native_world_actor_mismatch");
  await ensureWildsNativeWorldSource(held);
  const admitted = await appendWildsNativeWorldSteps({ context: held, steps: [step], cardSources, cardRecoveryProofs, idempotencyKey: `wildz:native-gather:${await digestReceizCanonicalV122(step)}` });
  const nourishment = admitted.replay.nourishment as Record<string, WildsNourishmentState>;
  return { record: admitted.record, nourishment: nourishment[step.actorId], replay: admitted.replay };
}

export async function consumeWildsNativeWorldFood(step: Extract<WildzNativeWorldStep, { kind: "food.consume" }>) {
  const context = await createActiveWildsNativeWorldContext(step);
  if (step.actorId !== wildsNativeWorldProfile(context)) throw Error("wilds_native_world_actor_mismatch");
  const accepted = await appendWildsNativeWorldSteps({ context, steps: [step], idempotencyKey: step.commandId });
  return { ...accepted, nourishment: (accepted.replay.nourishment as Record<string, WildsNourishmentState>)[step.actorId] };
}
