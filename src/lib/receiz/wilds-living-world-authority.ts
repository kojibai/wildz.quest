import "server-only";

import {
  prepareReceizSubjectSourceProofObjectCandidateV124,
  transportReceizSealedArtifactV124,
  type ReceizProofAuthorityChallengeV123,
  type ReceizSubjectStateV122
} from "@receiz/sdk";
import { wildsLivingWorldConsentStatementDigest, type WildsLivingWorldAuthorizationRequest } from "@/features/play/wilds-living-world-consent";
import { sameWildzPlayerCoordinate } from "./wildz-player-coordinate";
import { WILDZ_RECEIZ_APPLICATION_ID } from "./wildz-application";
import type { WildsMultiplayerActor } from "./wilds-multiplayer-server";

type AuthorityRail = Readonly<{
  client: Readonly<{ assets: Readonly<{ createProofObject(proofObject: unknown, options: unknown): Promise<unknown> }> }>;
  subjectStateV122(subjectId: string): Promise<unknown>;
  publishSealedSourceV124(input: unknown): Promise<unknown>;
}>;

type LivingWorldExecutionProof = Readonly<{
  artifact: string;
  challenge: ReceizProofAuthorityChallengeV123;
  requestedRails: readonly string[];
}>;

const DIGEST = /^[a-f0-9]{64}$/;

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("wilds_living_world_authority_invalid");
  return value as Record<string, unknown>;
}

function exactSubjectState(value: unknown, actor: WildsMultiplayerActor) {
  const state = record(value) as unknown as ReceizSubjectStateV122;
  if (state.schema !== "receiz.subject.state.v122" || !DIGEST.test(state.head) || !DIGEST.test(state.stateDigest)
    || !DIGEST.test(state.registryDigest) || !DIGEST.test(state.reducerDigest) || typeof state.subjectId !== "string"
    || typeof state.proofObjectId !== "string" || !sameWildzPlayerCoordinate(state.ownerReceizId, actor.handle)) {
    throw new Error("wilds_living_world_subject_source_invalid");
  }
  return state;
}

function admitExecutionProof(value: unknown, operation: WildsLivingWorldAuthorizationRequest) {
  const proof = record(value) as Partial<LivingWorldExecutionProof>;
  const expectedRails = operation.amountPhiMicro === "0" ? [] : ["settlement"];
  if (typeof proof.artifact !== "string" || !proof.artifact || !proof.challenge
    || !Array.isArray(proof.requestedRails) || proof.requestedRails.length !== expectedRails.length
    || proof.requestedRails.some((rail, index) => rail !== expectedRails[index])) {
    throw new Error("wilds_living_world_authority_invalid");
  }
  return proof as LivingWorldExecutionProof;
}

export async function prepareWildsLivingWorldAuthoritySession(input: Readonly<{
  rail: AuthorityRail;
  actor: WildsMultiplayerActor;
  executionProof: unknown;
  operation: WildsLivingWorldAuthorizationRequest;
}>) {
  const proof = admitExecutionProof(input.executionProof, input.operation);
  const expectedStatementDigest = await wildsLivingWorldConsentStatementDigest(input.operation);
  if (proof.challenge.consent?.statementDigest !== expectedStatementDigest) {
    throw new Error("wilds_living_world_consent_binding_invalid");
  }
  const state = exactSubjectState(await input.rail.subjectStateV122(input.actor.handle), input.actor);
  const candidate = await prepareReceizSubjectSourceProofObjectCandidateV124({
    subjectState: state,
    portable: {
      ownership: { ownerReceizId: state.ownerReceizId, custody: "current", proofRef: state.admittedProofDigest },
      provenance: {
        root: state.genesisHead,
        appends: [{ schema: "receiz.subject-source.v124", subjectId: state.subjectId, head: state.head }]
      },
      settlement: {}
    }
  });
  const sealed = await input.rail.client.assets.createProofObject(candidate.proofObject, {
    idempotencyKey: `wildz:living-world-source:${state.stateDigest}`,
    filename: `wildz-living-world-${state.subjectId.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 80)}.receiz`
  });
  const subjectSourceArtifact = await transportReceizSealedArtifactV124(sealed as never);
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
