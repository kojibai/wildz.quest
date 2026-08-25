import {
  prepareReceizSubjectSourceProofObjectCandidateV124,
  transportReceizSealedArtifactV124,
  verifyReceizPortableExecutionTransitionSetV124,
  type ReceizPortableSealedArtifactV124,
  type ReceizSubjectStateV122,
  type ReceizVerifiedPortableExecutionTransitionSetV124
} from "@receiz/sdk";
import { validateWildsPortableClaim, type WildsPortableClaim } from "@/features/play/wilds-portable-claim";
import { wildsPortableClaimConsentStatementDigest } from "@/features/play/wilds-portable-claim-consent";
import { sameWildzPlayerCoordinate } from "./wildz-player-coordinate";
import type { WildsWalletReadAuthority } from "./wilds-wallet-route-authority";
import { WILDZ_RECEIZ_APPLICATION_ID } from "./wildz-application";
import type { WildsMultiplayerActor } from "./wilds-multiplayer-server";

type Rail = Readonly<{
  openAuthoritySessionV124(input: unknown): Promise<unknown>;
  stagePreparedExecutionV124(plan: unknown, transitions: unknown): Promise<unknown>;
  executeV124(handle: unknown, session: unknown): Promise<unknown>;
  resolveExecutionByIdempotencyV124(input: unknown): Promise<unknown>;
  closeAuthoritySessionV124(input: unknown): Promise<unknown>;
}>;

type VerifiedTransitionSet = ReceizVerifiedPortableExecutionTransitionSetV124;
type AuthorityRail = Readonly<{
  client: Readonly<{ assets: Readonly<{ createProofObject(proofObject: unknown, options: unknown): Promise<unknown> }> }>;
  subjectStateV122(subjectId: string): Promise<unknown>;
  publishSealedSourceV124(input: unknown): Promise<unknown>;
}>;

function record(value: unknown, code = "wilds_portable_claim_execution_invalid") {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as Record<string, unknown>;
}

function bindRecipient(claim: WildsPortableClaim, authority: WildsWalletReadAuthority) {
  const recipient = claim.recipient.handle;
  if (recipient && !sameWildzPlayerCoordinate(recipient, authority.profileHandle)
    && !sameWildzPlayerCoordinate(recipient, authority.actorId)
    && !sameWildzPlayerCoordinate(recipient, authority.ownerReceizId)) {
    throw new Error("wilds_portable_claim_recipient_mismatch");
  }
}

function bindSource(claim: WildsPortableClaim, verified: VerifiedTransitionSet) {
  if (claim.carrier.kind !== "portable-execution") throw new Error("wilds_portable_claim_carrier_invalid");
  const plan = record(verified.operationPlan);
  if (verified.status !== "verified-portable-execution-transition-set"
    || plan.applicationId !== WILDZ_RECEIZ_APPLICATION_ID
    || plan.exactPlanDigest !== claim.carrier.exactPlanDigest
    || verified.expectedParticipantHeads[claim.source.subjectId] !== claim.source.head) {
    throw new Error("wilds_portable_claim_source_mismatch");
  }
  return plan;
}

function exactSubjectState(value: unknown, actor: WildsMultiplayerActor) {
  const state = record(value, "wilds_portable_claim_subject_source_invalid") as unknown as ReceizSubjectStateV122;
  if (state.schema !== "receiz.subject.state.v122"
    || typeof state.subjectId !== "string" || !state.subjectId
    || typeof state.proofObjectId !== "string" || !state.proofObjectId
    || !/^[a-f0-9]{64}$/.test(state.head)
    || !/^[a-f0-9]{64}$/.test(state.stateDigest)
    || !/^[a-f0-9]{64}$/.test(state.registryDigest)
    || !/^[a-f0-9]{64}$/.test(state.reducerDigest)
    || !sameWildzPlayerCoordinate(state.ownerReceizId, actor.handle)) {
    throw new Error("wilds_portable_claim_subject_source_invalid");
  }
  return state;
}

async function sealRecipientSource(rail: AuthorityRail, state: ReceizSubjectStateV122) {
  const candidate = await prepareReceizSubjectSourceProofObjectCandidateV124({
    subjectState: state,
    portable: {
      ownership: { ownerReceizId: state.ownerReceizId, custody: "current", proofRef: state.admittedProofDigest },
      provenance: { root: state.genesisHead, appends: [{ schema: "receiz.subject-source.v124", subjectId: state.subjectId, head: state.head }] },
      settlement: {}
    }
  });
  const sealed = await rail.client.assets.createProofObject(candidate.proofObject, {
    idempotencyKey: `wildz:portable-claim-recipient:${state.stateDigest}`,
    filename: `wildz-claim-${state.subjectId.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 80)}.receiz`
  });
  return transportReceizSealedArtifactV124(sealed as never);
}

export async function prepareWildsPortableClaimAuthoritySession(input: Readonly<{
  claim: WildsPortableClaim;
  actor: WildsMultiplayerActor;
  executionProof: unknown;
  rail: AuthorityRail;
  sealSource?: (rail: AuthorityRail, state: ReceizSubjectStateV122) => Promise<ReceizPortableSealedArtifactV124>;
}>) {
  const claim = validateWildsPortableClaim(input.claim);
  if (claim.carrier.kind !== "portable-execution") throw new Error("wilds_portable_claim_carrier_invalid");
  bindRecipient(claim, {
    accessToken: input.actor.accessToken ?? "",
    ownerReceizId: input.actor.receizActorId,
    actorId: input.actor.playerId,
    profileHandle: input.actor.handle
  });
  const proof = record(input.executionProof, "wilds_portable_claim_authority_invalid");
  const challenge = record(proof.challenge, "wilds_portable_claim_authority_invalid");
  const consent = record(challenge.consent, "wilds_portable_claim_authority_invalid");
  const expectedRails = claim.kind === "phi" ? ["settlement"] : [];
  if (typeof proof.artifact !== "string" || !proof.artifact
    || !Array.isArray(proof.requestedRails)
    || proof.requestedRails.length !== expectedRails.length
    || proof.requestedRails.some((rail, index) => rail !== expectedRails[index])
    || consent.statementDigest !== await wildsPortableClaimConsentStatementDigest({
      claimId: claim.claimId,
      exactPlanDigest: claim.carrier.exactPlanDigest,
      kind: claim.kind
    })) {
    throw new Error("wilds_portable_claim_authority_invalid");
  }
  const state = exactSubjectState(await input.rail.subjectStateV122(input.actor.handle), input.actor);
  const subjectSourceArtifact = await (input.sealSource ?? sealRecipientSource)(input.rail, state);
  void input.rail.publishSealedSourceV124({
    applicationId: WILDZ_RECEIZ_APPLICATION_ID,
    authoritySessionHandle: null,
    sourceArtifact: subjectSourceArtifact
  }).catch(() => undefined);
  return Object.freeze({
    applicationId: WILDZ_RECEIZ_APPLICATION_ID,
    actorSubjectId: state.subjectId,
    subjectSourceArtifact,
    proofArtifact: proof.artifact,
    signedChallenge: proof.challenge,
    requestedRails: proof.requestedRails,
    requiredNamespaces: [],
    audience: WILDZ_RECEIZ_APPLICATION_ID
  });
}

function resolutionCoordinates(plan: Record<string, unknown>) {
  const applicationId = plan.applicationId;
  const domainId = plan.domainId;
  const operationKind = plan.operationKind;
  const semanticIdempotencyKey = plan.semanticIdempotencyKey;
  if (applicationId !== WILDZ_RECEIZ_APPLICATION_ID
    || typeof domainId !== "string" || !domainId
    || typeof operationKind !== "string" || !operationKind
    || typeof semanticIdempotencyKey !== "string" || !semanticIdempotencyKey) {
    throw new Error("wilds_portable_claim_execution_invalid");
  }
  return { applicationId, domainId, operationKind, semanticIdempotencyKey };
}

function admitOutcome(value: unknown, claim: WildsPortableClaim, plan: Record<string, unknown>) {
  if (claim.carrier.kind !== "portable-execution") throw new Error("wilds_portable_claim_carrier_invalid");
  const outcome = record(value);
  if (outcome.status === "zero-write" || outcome.status === "cancelled") {
    return Object.freeze({
      status: "zero-write" as const,
      claimId: claim.claimId,
      writes: 0 as const,
      reasonCode: typeof outcome.reasonCode === "string" ? outcome.reasonCode : "INVALID_OPERATION"
    });
  }
  if (outcome.status !== "committed"
    || outcome.applicationId !== WILDZ_RECEIZ_APPLICATION_ID
    || outcome.exactPlanDigest !== claim.carrier.exactPlanDigest
    || outcome.semanticIdempotencyKey !== plan.semanticIdempotencyKey) {
    throw new Error("wilds_portable_claim_outcome_invalid");
  }
  return Object.freeze({
    status: "committed" as const,
    claimId: claim.claimId,
    executionId: typeof outcome.executionId === "string" ? outcome.executionId : "",
    committedHeads: record(outcome.committedHeads)
  });
}

export async function executeWildsPortableClaim(input: Readonly<{
  claim: WildsPortableClaim;
  currentKai: number;
  authority: WildsWalletReadAuthority;
  authoritySessionInput: unknown;
  rail: Rail;
  verifyTransitionSet?: (value: unknown, input: Readonly<{ audience: string }>) => Promise<VerifiedTransitionSet>;
}>) {
  const claim = validateWildsPortableClaim(input.claim);
  if (claim.carrier.kind !== "portable-execution") throw new Error("wilds_portable_claim_carrier_invalid");
  if (!Number.isSafeInteger(input.currentKai) || input.currentKai < claim.issuedAtKai) {
    throw new Error("wilds_portable_claim_clock_invalid");
  }
  if (input.currentKai >= claim.expiresAtKai) throw new Error("wilds_portable_claim_expired");
  bindRecipient(claim, input.authority);
  const verify = input.verifyTransitionSet ?? verifyReceizPortableExecutionTransitionSetV124;
  const verified = await verify(claim.carrier.transitionSet, { audience: WILDZ_RECEIZ_APPLICATION_ID });
  const plan = bindSource(claim, verified);
  const coordinates = resolutionCoordinates(plan);
  let session: unknown = null;
  try {
    session = await input.rail.openAuthoritySessionV124(input.authoritySessionInput);
    const handle = await input.rail.stagePreparedExecutionV124(verified.operationPlan, claim.carrier.transitionSet);
    try {
      return admitOutcome(await input.rail.executeV124(handle, session), claim, plan);
    } catch {
      return admitOutcome(await input.rail.resolveExecutionByIdempotencyV124(coordinates), claim, plan);
    }
  } finally {
    if (session) {
      const authoritySessionHandle = record(session).authoritySessionHandle;
      await input.rail.closeAuthoritySessionV124({
        applicationId: WILDZ_RECEIZ_APPLICATION_ID,
        authoritySessionHandle,
        persistedSession: session
      }).catch(() => undefined);
    }
  }
}
