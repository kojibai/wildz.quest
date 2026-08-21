import type { NextRequest } from "next/server";
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

type RemoteSubject = Awaited<ReturnType<ReceizCommerceAdapter["resolveWorldSubject"]>>;

export type WildsExcavationRouteAuthority = Readonly<{
  accessToken: string;
  ownerReceizId: string;
  actorSubject: RemoteSubject;
  creatureSubject: RemoteSubject;
  card: PortableCardAsset;
  capability: WildsExcavationCapabilityEvidence;
}>;

export type WildsExcavationRouteAuthorityDependencies = Readonly<{
  loadProfile(accessToken: string): ReturnType<typeof loadReceizConnectProfile>;
  createAdapter(accessToken: string): Pick<ReceizCommerceAdapter, "resolveWorldSubject">;
  resolveCapabilityAtHead?(input: Readonly<{ subjectId: string; subjectHead: string }>): Promise<Readonly<{
    capabilityIdentityDigest: string;
    conditionDigest: string;
  }>>;
}>;

const DEFAULT_DEPENDENCIES: WildsExcavationRouteAuthorityDependencies = {
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

function subjectResolutionError(cause: unknown) {
  const status = cause && typeof cause === "object" && "status" in cause ? Number((cause as { status?: unknown }).status) : null;
  const message = cause instanceof Error ? cause.message : "";
  if (status === 401 || /(?:^|\b)(?:401|unauthorized|token_revoked)(?:\b|$)/i.test(message)) return new Error("receiz_authority_required");
  if (status === 404 || /(?:^|\b)(?:404|not_found|subject_not_found)(?:\b|$)/i.test(message)) return new Error("receiz_remote_subject_admission_required");
  return new Error("receiz_subject_resolution_unavailable");
}

function profileResolutionError(cause: unknown) {
  const status = cause && typeof cause === "object" && "status" in cause ? Number((cause as { status?: unknown }).status) : null;
  const message = cause instanceof Error ? cause.message : "";
  if (status === 401 || /(?:^|\b)(?:401|unauthorized|token_revoked)(?:\b|$)/i.test(message)) return new Error("receiz_authority_required");
  return new Error("receiz_profile_resolution_unavailable");
}

export async function resolveWildsExcavationRouteAuthority(
  request: NextRequest,
  input: Readonly<{ card: unknown; cardAdmission?: unknown; actorSubjectId: string; creatureSubjectId: string }>,
  dependencies: WildsExcavationRouteAuthorityDependencies = DEFAULT_DEPENDENCIES
): Promise<WildsExcavationRouteAuthority> {
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
  if (input.actorSubjectId !== proofSession.actorId) throw new Error("wilds_excavation_actor_subject_invalid");
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
  if (input.creatureSubjectId !== card.id || admitted.assetId !== card.id || admitted.proofDigest !== card.proof.digest) {
    throw new Error("wilds_excavation_creature_subject_invalid");
  }
  if (!isLivingCardAsset(card)) throw new Error("wilds_excavation_living_card_required");
  const adapter = dependencies.createAdapter(accessToken);
  let actorArtifact: RemoteSubject;
  let creatureArtifact: RemoteSubject;
  try {
    [actorArtifact, creatureArtifact] = await Promise.all([
      adapter.resolveWorldSubject(input.actorSubjectId),
      adapter.resolveWorldSubject(input.creatureSubjectId)
    ]);
  } catch (cause) {
    // The v121 remote client intentionally has no subject-admission method.
    // Missing subjects must be migrated by a proof-native Receiz admission rail;
    // a local living-subject runtime is never substituted as world authority.
    throw subjectResolutionError(cause);
  }
  const actorSubject = actorArtifact.subject;
  const creatureSubject = creatureArtifact.subject;
  if (actorSubject.subjectId !== input.actorSubjectId || creatureSubject.subjectId !== input.creatureSubjectId
    || actorSubject.currentOwnerReceizId !== profile.id || creatureSubject.currentOwnerReceizId !== profile.id
    || normalizeDigest(creatureSubject.identityDigest) !== normalizeDigest(card.proof.digest)) {
    throw new Error("receiz_remote_subject_binding_invalid");
  }
  const identity = projectCreatureCapabilityIdentity(card);
  const condition = currentCreatureHistoryProjection(card).condition;
  const capability = Object.freeze({
    identity,
    runtime: projectCreatureRuntimeCapabilities(identity, condition),
    conditionDigest: conditionDigest(card)
  });
  if (!dependencies.resolveCapabilityAtHead) throw new Error("receiz_subject_namespace_authority_required");
  const atHead = await dependencies.resolveCapabilityAtHead({ subjectId: creatureSubject.subjectId, subjectHead: creatureSubject.head });
  if (atHead.capabilityIdentityDigest !== digestWildsExcavationCapabilityIdentity(identity)
    || atHead.conditionDigest !== capability.conditionDigest) throw new Error("wilds_excavation_capability_binding_invalid");
  return Object.freeze({ accessToken, ownerReceizId: profile.id, actorSubject: actorArtifact, creatureSubject: creatureArtifact, card, capability });
}
