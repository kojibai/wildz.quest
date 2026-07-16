import type { PublicWildzProfile } from "../../features/profile/public-profile";
import {
  canonicalPortableCardJson,
  sha256PortableBasis,
  verifyAnyWildsCard,
  type PortableCardAsset
} from "../../features/play/portable-card";
import { canonicalWildzActorId } from "./wildz-identity-repository";
import { parseWildzPlayerCoordinate } from "./wildz-player-coordinate";

export const WILDZ_PUBLIC_STATE_SCHEMA = "receiz.wildz_public_projection.v1" as const;

export type WildzPublicState = {
  schema: typeof WILDZ_PUBLIC_STATE_SCHEMA;
  revision: number;
  updatedAt: string;
  profiles: Record<string, PublicWildzProfile>;
  cards: Record<string, PortableCardAsset>;
};

export type WildzPublicCommand =
  | {
    type: "publish-profile";
    actorHandle: string;
    expectedRevision: number;
    profile: PublicWildzProfile;
  }
  | {
    type: "publish-card";
    actorId: string;
    expectedRevision: number;
    card: PortableCardAsset;
  };

const EMPTY_UPDATED_AT = "1970-01-01T00:00:00.000Z";
const MAX_PUBLIC_PROFILES = 1_000;
const MAX_PUBLIC_CARDS = 5_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function admittedIso(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== value) {
    throw new Error("wildz_public_time_invalid");
  }
  return value;
}

function cardOwnerActorId(asset: PortableCardAsset) {
  return parseWildzPlayerCoordinate(asset.manifest.ownerReceizId)?.actorId
    ?? canonicalWildzActorId({ owner: { username: asset.manifest.ownerReceizId, uid: null } });
}

export function emptyWildzPublicState(): WildzPublicState {
  return {
    schema: WILDZ_PUBLIC_STATE_SCHEMA,
    revision: 0,
    updatedAt: EMPTY_UPDATED_AT,
    profiles: {},
    cards: {}
  };
}

export function restoreWildzPublicState(value: unknown): WildzPublicState {
  if (!isRecord(value)
    || value.schema !== WILDZ_PUBLIC_STATE_SCHEMA
    || !Number.isSafeInteger(value.revision)
    || Number(value.revision) < 0
    || typeof value.updatedAt !== "string") {
    return emptyWildzPublicState();
  }
  try {
    admittedIso(value.updatedAt);
  } catch {
    return emptyWildzPublicState();
  }

  const profiles: Record<string, PublicWildzProfile> = {};
  if (isRecord(value.profiles)) {
    for (const [handle, candidate] of Object.entries(value.profiles).slice(0, MAX_PUBLIC_PROFILES)) {
      if (!isRecord(candidate)
        || candidate.schema !== "wildz.public_profile.v1"
        || typeof candidate.username !== "string"
        || candidate.username.toLowerCase() !== handle.toLowerCase()) continue;
      profiles[handle.toLowerCase()] = structuredClone(candidate) as PublicWildzProfile;
    }
  }

  const cards: Record<string, PortableCardAsset> = {};
  if (isRecord(value.cards)) {
    for (const [assetId, candidate] of Object.entries(value.cards).slice(0, MAX_PUBLIC_CARDS)) {
      if (!isRecord(candidate)) continue;
      const asset = candidate as PortableCardAsset;
      try {
        if (asset.id === assetId && verifyAnyWildsCard(asset).ok) cards[assetId] = structuredClone(asset);
      } catch {
        // Invalid public records are omitted rather than becoming read authority.
      }
    }
  }

  return {
    schema: WILDZ_PUBLIC_STATE_SCHEMA,
    revision: Number(value.revision),
    updatedAt: value.updatedAt,
    profiles,
    cards
  };
}

export function wildzPublicStateDigest(state: WildzPublicState) {
  return sha256PortableBasis(canonicalPortableCardJson(restoreWildzPublicState(state)));
}

export function isCurrentWildzPublicCardRegistration(
  state: WildzPublicState,
  card: PortableCardAsset
) {
  const existing = restoreWildzPublicState(state).cards[card.id];
  if (!existing) return false;
  try {
    return verifyAnyWildsCard(card).ok
      && verifyAnyWildsCard(existing).ok
      && existing.proof.digest === card.proof.digest
      && canonicalPortableCardJson(existing) === canonicalPortableCardJson(card);
  } catch {
    return false;
  }
}

export function advanceWildzPublicState(
  state: WildzPublicState,
  command: WildzPublicCommand,
  context: { occurredAt: string; admittedCardOwnerId?: string }
): WildzPublicState {
  const current = restoreWildzPublicState(state);
  if (command.expectedRevision !== current.revision) throw new Error("wildz_public_revision_conflict");
  const updatedAt = admittedIso(context.occurredAt);

  if (command.type === "publish-profile") {
    const actorHandle = command.actorHandle.toLowerCase();
    if (command.profile.username.toLowerCase() !== actorHandle) throw new Error("wildz_public_profile_owner_mismatch");
    return {
      ...current,
      revision: current.revision + 1,
      updatedAt,
      profiles: { ...current.profiles, [actorHandle]: structuredClone(command.profile) }
    };
  }

  let verified = false;
  try {
    verified = verifyAnyWildsCard(command.card).ok;
  } catch {
    verified = false;
  }
  if (!verified) throw new Error("wildz_public_card_verification_failed");
  const admittedOwnerId = context.admittedCardOwnerId ?? cardOwnerActorId(command.card);
  if (admittedOwnerId !== command.actorId) throw new Error("wildz_public_card_owner_mismatch");
  return {
    ...current,
    revision: current.revision + 1,
    updatedAt,
    cards: { ...current.cards, [command.card.id]: structuredClone(command.card) }
  };
}
