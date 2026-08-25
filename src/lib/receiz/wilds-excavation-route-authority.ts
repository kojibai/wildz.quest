import type { NextRequest } from "next/server";
import { RECEIZ_V123_REGISTRY_DIGEST, validateReceizNamespaceResolutionV123 } from "@receiz/sdk";
import type { PortableCardAsset } from "@/features/play/portable-card";
import { canonicalPortableCardJson, sha256PortableBasis } from "@/features/play/portable-card";
import { currentCreatureHistoryProjection } from "@/features/play/living-card-proof";
import { isLivingCardAsset } from "@/features/play/living-card-types";
import {
  projectCreatureCapabilityIdentity,
  projectCreatureRuntimeCapabilities
} from "@/features/play/creature-capability-identity";
import { digestWildsExcavationCapabilityIdentity, type WildsExcavationCapabilityEvidence } from "@/features/play/wilds-excavation";
import { createReceizCommerceAdapter, type ReceizCommerceAdapter } from "./adapter";
import { authorizeWildsMultiplayerCard } from "./wilds-multiplayer-server";
import { loadReceizConnectProfile } from "./connect-profile";
import { playerReceizWorldAuthorityAccessToken, receizRequestSession } from "./session";
import { readWildzProofSessionCookie } from "./wildz-proof-session";
import { sameWildzPlayerCoordinate } from "./wildz-player-coordinate";
import { admitWildsCreatureSubjectV122 } from "./wilds-v122-subjects";

type RemoteSubject = Awaited<ReturnType<ReceizCommerceAdapter["resolveWorldSubject"]>>;

export type WildsExcavationRouteAuthority = Readonly<{
  accessToken?: string;
  ownerReceizId: string;
  actorSubject: RemoteSubject;
  creatureSubject: RemoteSubject;
  card: PortableCardAsset;
  capability: WildsExcavationCapabilityEvidence;
}>; 

export type WildsExcavationRouteAuthorityDependencies = Readonly<{
  loadProfile(accessToken: string): ReturnType<typeof loadReceizConnectProfile>;
  createAdapter(accessToken: string): Pick<ReceizCommerceAdapter, "resolveWorldSubject"> & Partial<Pick<ReceizCommerceAdapter, "resolveSubjectNamespacesV123">>;
  resolveCapabilityAtHead?(input: Readonly<{ subjectId: string; subjectHead: string }>): Promise<Readonly<{
    capabilityIdentityDigest: string;
    conditionDigest: string;
  }>>;
}>;

export type WildsCreatureSubjectAdmissionDependencies = Readonly<{
  loadProfile(accessToken: string): ReturnType<typeof loadReceizConnectProfile>;
  createAdapter(accessToken: string): Pick<ReceizCommerceAdapter, "admitSubjectV122" | "subjectStateV122">;
}>;

const DEFAULT_DEPENDENCIES: WildsExcavationRouteAuthorityDependencies = {
  loadProfile: loadReceizConnectProfile,
  createAdapter: (accessToken) => createReceizCommerceAdapter({ accessToken })
};

const DEFAULT_SUBJECT_ADMISSION_DEPENDENCIES: WildsCreatureSubjectAdmissionDependencies = {
  loadProfile: loadReceizConnectProfile,
  createAdapter: (accessToken) => createReceizCommerceAdapter({ accessToken })
};

function normalizeDigest(value: string) {
  return value.replace(/^sha256:/, "");
}

function conditionDigest(card: PortableCardAsset) {
  if (!isLivingCardAsset(card)) throw new Error("wilds_excavation_living_card_required");
  return sha256PortableBasis(canonicalPortableCardJson(currentCreatureHistoryProjection(card).condition));
}

function sourceSubject(input: Readonly<{
  subjectId: string;
  ownerReceizId: string;
  subjectType: string;
  identityDigest: string;
  headBasis: string;
}>): RemoteSubject {
  const head = normalizeDigest(sha256PortableBasis(input.headBasis));
  return {
    schema: "receiz.subject.v1",
    subject: {
      schema: "receiz.subject.v1",
      subjectId: input.subjectId,
      proofObjectId: `proof:${head}`,
      subjectType: input.subjectType,
      ownerReceizId: input.ownerReceizId,
      identityDigest: input.identityDigest,
      genesisDigest: head,
      createdAtKai: "0",
      head,
      ownershipHead: head,
      currentOwnerReceizId: input.ownerReceizId,
      namespaces: {}
    },
    exactBytesB64u: Buffer.from(input.headBasis, "utf8").toString("base64url"),
    artifactDigest: head,
    registryDigest: RECEIZ_V123_REGISTRY_DIGEST,
    reducerDigest: head,
    authority: {
      artifactIsProofAuthority: true,
      modelOutputIsAuthority: false,
      indexIsAuthority: false
    }
  } as RemoteSubject;
}

function decodeNamespace(exactBytesB64u: string) {
  return JSON.parse(Buffer.from(exactBytesB64u, "base64url").toString("utf8")) as unknown;
}

export async function resolveWildsCapabilityNamespacesV123(
  rail: Pick<ReceizCommerceAdapter, "resolveSubjectNamespacesV123">,
  input: Readonly<{
    subjectId: string;
    subjectHead: string;
    admittedProofDigest?: string;
    ownershipHead?: string;
    registryDigest?: string;
    reducerDigest?: string;
  }>
) {
  const request = Object.freeze({ subjectId: input.subjectId, atHead: input.subjectHead, names: Object.freeze(["abilities", "condition"]) });
  let resolution: Awaited<ReturnType<typeof validateReceizNamespaceResolutionV123>>;
  try {
    resolution = await validateReceizNamespaceResolutionV123(await rail.resolveSubjectNamespacesV123(request), request);
  } catch {
    throw new Error("receiz_subject_namespace_authority_required");
  }
  if ("ok" in resolution) throw new Error("receiz_subject_namespace_authority_required");
  if (resolution.subjectId !== input.subjectId || resolution.atHead !== input.subjectHead) {
    throw new Error("receiz_subject_namespace_authority_required");
  }
  if (input.admittedProofDigest !== undefined && resolution.admittedProofDigest !== input.admittedProofDigest
    || input.ownershipHead !== undefined && resolution.ownershipHead !== input.ownershipHead
    || input.registryDigest !== undefined && resolution.registryDigest !== input.registryDigest
    || input.reducerDigest !== undefined && resolution.reducerDigest !== input.reducerDigest
    || resolution.registryDigest !== RECEIZ_V123_REGISTRY_DIGEST) {
    throw new Error("receiz_subject_namespace_authority_required");
  }
  const abilities = resolution.namespaces.find((entry) => entry.name === "abilities" && entry.found && entry.exactBytesB64u);
  const condition = resolution.namespaces.find((entry) => entry.name === "condition" && entry.found && entry.exactBytesB64u);
  if (!abilities?.exactBytesB64u || !condition?.exactBytesB64u) throw new Error("receiz_subject_namespace_authority_required");
  let identity: unknown;
  let conditionState: unknown;
  try {
    identity = decodeNamespace(abilities.exactBytesB64u);
    conditionState = decodeNamespace(condition.exactBytesB64u);
  } catch {
    throw new Error("receiz_subject_namespace_authority_required");
  }
  if (!identity || typeof identity !== "object"
    || (identity as { schema?: unknown }).schema !== "receiz.wilds.creature_capability_identity.v1"
    || !conditionState || typeof conditionState !== "object") throw new Error("receiz_subject_namespace_authority_required");
  return Object.freeze({
    capabilityIdentityDigest: digestWildsExcavationCapabilityIdentity(identity as ReturnType<typeof projectCreatureCapabilityIdentity>),
    conditionDigest: sha256PortableBasis(canonicalPortableCardJson(conditionState))
  });
}

function profileResolutionError(cause: unknown) {
  const status = cause && typeof cause === "object" && "status" in cause ? Number((cause as { status?: unknown }).status) : null;
  const message = cause instanceof Error ? cause.message : "";
  if (status === 401 || /(?:^|\b)(?:401|unauthorized|token_revoked)(?:\b|$)/i.test(message)) return new Error("receiz_authority_required");
  return new Error("receiz_profile_resolution_unavailable");
}

export function wildsExcavationStatusFor(code: string) {
  if (code.includes("scope_required") || code.includes("identity_key_required") || code === "receiz_authority_required") return 401;
  if (code.includes("binding_invalid") || code.includes("subject_invalid") || code.includes("card_owner_invalid") || code.includes("profile_required")) return 403;
  if (code.includes("admission_required")) return 409;
  if (code === "receiz_subject_namespace_authority_required" || code === "receiz_subject_resolution_unavailable" || code === "receiz_profile_resolution_unavailable") return 503;
  if (code === "wilds_excavation_request_invalid") return 422;
  return 502;
}

export async function resolveWildsExcavationRouteAuthority(
  request: NextRequest,
  input: Readonly<{ card: unknown; cardAdmission?: unknown; actorSubjectId: string; creatureSubjectId: string }>,
  _dependencies: WildsExcavationRouteAuthorityDependencies = DEFAULT_DEPENDENCIES
): Promise<WildsExcavationRouteAuthority> {
  const session = receizRequestSession(request);
  const accessToken = playerReceizWorldAuthorityAccessToken(session);
  const proofSession = readWildzProofSessionCookie(request);
  if (proofSession.authority !== "identity-key") throw new Error("receiz_identity_key_required");
  if (input.actorSubjectId !== proofSession.actorId) throw new Error("wilds_excavation_actor_subject_invalid");
  const actor = {
    playerId: proofSession.actorId,
    handle: proofSession.profileHandle,
    receizActorId: proofSession.actorId,
    practice: false,
    ...(accessToken ? { accessToken } : {}),
    ...(proofSession.vaultCardRootSha256 ? { vaultCardRootSha256: proofSession.vaultCardRootSha256 } : {})
  };
  const admitted = authorizeWildsMultiplayerCard(actor, input.card, input.cardAdmission);
  const card = input.card as PortableCardAsset;
  if (input.creatureSubjectId !== card.id || admitted.assetId !== card.id || admitted.proofDigest !== card.proof.digest) {
    throw new Error("wilds_excavation_creature_subject_invalid");
  }
  if (!isLivingCardAsset(card)) throw new Error("wilds_excavation_living_card_required");
  const identity = projectCreatureCapabilityIdentity(card);
  const condition = currentCreatureHistoryProjection(card).condition;
  const capability = Object.freeze({
    identity,
    runtime: projectCreatureRuntimeCapabilities(identity, condition),
    conditionDigest: conditionDigest(card)
  });
  const actorArtifact = sourceSubject({
    subjectId: proofSession.actorId,
    ownerReceizId: proofSession.actorId,
    subjectType: "wildz.explorer",
    identityDigest: normalizeDigest(sha256PortableBasis(proofSession.subjectKey)),
    headBasis: canonicalPortableCardJson({ actorId: proofSession.actorId, subjectKey: proofSession.subjectKey })
  });
  const creatureArtifact = sourceSubject({
    subjectId: card.id,
    ownerReceizId: proofSession.actorId,
    subjectType: "wildz.creature",
    identityDigest: normalizeDigest(card.proof.digest),
    headBasis: canonicalPortableCardJson({ proofDigest: card.proof.digest, conditionDigest: capability.conditionDigest })
  });
  return Object.freeze({
    ...(accessToken ? { accessToken } : {}),
    ownerReceizId: proofSession.actorId,
    actorSubject: actorArtifact,
    creatureSubject: creatureArtifact,
    card,
    capability
  });
}

export async function admitWildsCreatureSubjectForRequestV122(
  request: NextRequest,
  input: Readonly<{ card: unknown; cardAdmission?: unknown }>,
  dependencies: WildsCreatureSubjectAdmissionDependencies = DEFAULT_SUBJECT_ADMISSION_DEPENDENCIES
) {
  const session = receizRequestSession(request);
  const accessToken = playerReceizWorldAuthorityAccessToken(session);
  if (!accessToken) throw new Error("receiz_world_authority_scope_required");
  const proofSession = readWildzProofSessionCookie(request);
  if (proofSession.authority !== "identity-key") throw new Error("receiz_identity_key_required");
  let profile: Awaited<ReturnType<typeof dependencies.loadProfile>>;
  try {
    profile = await dependencies.loadProfile(accessToken);
  } catch (cause) {
    throw profileResolutionError(cause);
  }
  if (!profile?.id || !profile.handle || !sameWildzPlayerCoordinate(profile.handle, proofSession.profileHandle)) {
    throw new Error("receiz_profile_binding_invalid");
  }
  const actor = {
    playerId: proofSession.actorId,
    handle: proofSession.profileHandle,
    receizActorId: profile.id,
    practice: false,
    accessToken,
    ...(proofSession.vaultCardRootSha256 ? { vaultCardRootSha256: proofSession.vaultCardRootSha256 } : {})
  };
  const admitted = authorizeWildsMultiplayerCard(actor, input.card, input.cardAdmission);
  const card = input.card as PortableCardAsset;
  if (admitted.assetId !== card.id || admitted.proofDigest !== card.proof.digest) {
    throw new Error("wilds_excavation_creature_subject_invalid");
  }
  return admitWildsCreatureSubjectV122({
    card,
    ownerReceizId: profile.id,
    rail: dependencies.createAdapter(accessToken)
  });
}
