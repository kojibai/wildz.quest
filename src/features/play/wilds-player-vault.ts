import { canonicalPortableCardJson, sha256PortableBasis } from "./portable-card";
import { restorePlayState, serializePlayState, type PlayState } from "./game-state";
import { parseWildzCharacter, type WildzCharacterGenesis } from "../identity/wildz-genesis";
import { WILDS_WORLD_ID } from "./wilds-world-event";
import type { WildsWorldProjection } from "./wilds-world-state";

export type WildzCardOrder = "rarity" | "newest" | "oldest";

export type WildsPlayerVaultSettings = {
  avatarStyle: "female" | "male" | null;
  movementMode: "walk" | "run";
  audio: Record<string, boolean | number>;
  cardOrder: WildzCardOrder;
};

export type WildsPlayerVaultPayload = {
  schema: "receiz.wilds_player_vault.v3";
  playerId: string;
  exportedAt: string;
  playState: PlayState;
  character: WildzCharacterGenesis | null;
  settings: WildsPlayerVaultSettings;
  personalEvents: { eventId: string; kind: string; occurredAt: string; receiptDigest?: string }[];
  canonicalCursor: { worldId: typeof WILDS_WORLD_ID; revision: number; eventId: string | null };
  receipts: { eventId: string; digest: string }[];
  payloadDigest: string;
};

type PlayerVaultInput = Omit<WildsPlayerVaultPayload, "schema" | "payloadDigest" | "character" | "settings"> & {
  character?: WildzCharacterGenesis | null;
  settings: Omit<WildsPlayerVaultSettings, "cardOrder"> & { cardOrder?: WildzCardOrder };
};

type NormalizedPlayerVaultInput = Omit<WildsPlayerVaultPayload, "schema" | "payloadDigest">;

function identityValid(value: string) {
  return value.length >= 3 && value.length <= 180 && /^[a-z0-9][a-z0-9:._-]*$/i.test(value);
}

function normalizedCharacter(value: WildzCharacterGenesis | null | undefined) {
  if (value === null || value === undefined) return null;
  const parsed = parseWildzCharacter(JSON.stringify(value));
  if (!parsed) throw new Error("wilds_player_vault_character_invalid");
  return parsed;
}

function normalizedInput(input: PlayerVaultInput): NormalizedPlayerVaultInput {
  if (!identityValid(input.playerId)) throw new Error("wilds_player_vault_owner_invalid");
  if (!Number.isFinite(Date.parse(input.exportedAt))) throw new Error("wilds_player_vault_time_invalid");
  if (input.settings.avatarStyle !== null && input.settings.avatarStyle !== "female" && input.settings.avatarStyle !== "male") {
    throw new Error("wilds_player_vault_avatar_invalid");
  }
  if (input.settings.movementMode !== "walk" && input.settings.movementMode !== "run") {
    throw new Error("wilds_player_vault_movement_invalid");
  }
  const cardOrder = input.settings.cardOrder ?? "rarity";
  if (cardOrder !== "rarity" && cardOrder !== "newest" && cardOrder !== "oldest") {
    throw new Error("wilds_player_vault_card_order_invalid");
  }
  if (!input.settings.audio || typeof input.settings.audio !== "object" || Array.isArray(input.settings.audio)
    || Object.values(input.settings.audio).some((value) => typeof value !== "boolean" && (typeof value !== "number" || !Number.isFinite(value)))) {
    throw new Error("wilds_player_vault_audio_invalid");
  }
  if (input.canonicalCursor.worldId !== WILDS_WORLD_ID
    || !Number.isSafeInteger(input.canonicalCursor.revision)
    || input.canonicalCursor.revision < 0) throw new Error("wilds_player_vault_cursor_invalid");
  const events = new Map<string, PlayerVaultInput["personalEvents"][number]>();
  for (const event of input.personalEvents) {
    if (!identityValid(event.eventId) || !event.kind || !Number.isFinite(Date.parse(event.occurredAt))) {
      throw new Error("wilds_player_vault_event_invalid");
    }
    events.set(event.eventId, event);
  }
  const receipts = new Map<string, PlayerVaultInput["receipts"][number]>();
  for (const receipt of input.receipts) {
    if (!identityValid(receipt.eventId) || !/^sha256:[a-f0-9]{64}$/.test(receipt.digest)) {
      throw new Error("wilds_player_vault_receipt_invalid");
    }
    receipts.set(receipt.eventId, receipt);
  }
  return {
    ...input,
    exportedAt: new Date(Date.parse(input.exportedAt)).toISOString(),
    playState: restorePlayState(serializePlayState(input.playState), input.playerId),
    character: normalizedCharacter(input.character),
    settings: {
      avatarStyle: input.settings.avatarStyle,
      movementMode: input.settings.movementMode,
      audio: { ...input.settings.audio },
      cardOrder
    },
    personalEvents: [...events.values()]
      .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt) || left.eventId.localeCompare(right.eventId))
      .slice(-2_048),
    receipts: [...receipts.values()].sort((left, right) => left.eventId.localeCompare(right.eventId)).slice(-2_048)
  };
}

function recordKey(value: unknown) {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return JSON.stringify(value);
  const item = value as Record<string, unknown>;
  return String(item.eventId ?? item.id ?? item.digest ?? item.sourceEventId ?? JSON.stringify(value));
}

function mergeRecords<T>(local: readonly T[] | undefined, restored: readonly T[] | undefined) {
  const merged = new Map<string, T>();
  for (const value of local ?? []) merged.set(recordKey(value), value);
  for (const value of restored ?? []) merged.set(recordKey(value), value);
  return [...merged.values()];
}

function basis(input: NormalizedPlayerVaultInput) {
  return { schema: "receiz.wilds_player_vault.v3" as const, ...input };
}

export function createWildsPlayerVault(input: PlayerVaultInput): WildsPlayerVaultPayload {
  const normalized = normalizedInput(input);
  return { ...basis(normalized), payloadDigest: sha256PortableBasis(canonicalPortableCardJson(basis(normalized))) };
}

export function verifyWildsPlayerVault(value: WildsPlayerVaultPayload) {
  const errors: string[] = [];
  try {
    // Verify the exact sealed payload before normalization. A later save parser
    // may add defaults, but that must not invalidate a correctly sealed V3 file.
    const { payloadDigest, schema, ...payload } = value;
    const expectedDigest = sha256PortableBasis(canonicalPortableCardJson({ schema, ...payload }));
    if (schema !== "receiz.wilds_player_vault.v3" || payloadDigest !== expectedDigest) {
      errors.push("wilds_player_vault_digest_invalid");
    }
    normalizedInput({
      playerId: value.playerId,
      exportedAt: value.exportedAt,
      playState: value.playState,
      character: value.character,
      settings: value.settings,
      personalEvents: value.personalEvents,
      canonicalCursor: value.canonicalCursor,
      receipts: value.receipts
    });
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "wilds_player_vault_invalid");
  }
  return { ok: errors.length === 0, errors };
}

export function reconcileWildsPlayerVault(input: {
  local: PlayState;
  restored: WildsPlayerVaultPayload;
  canonical: WildsWorldProjection;
  actorId: string;
  preferLocalState?: boolean;
}) {
  if (input.restored.playerId !== input.actorId) throw new Error("wilds_player_vault_owner_invalid");
  const verified = verifyWildsPlayerVault(input.restored);
  if (!verified.ok) throw new Error(verified.errors[0] ?? "wilds_player_vault_invalid");
  const restoredPlayState = input.restored.playState;
  const adventureConditions = { ...input.local.adventureConditions, ...restoredPlayState.adventureConditions };
  for (const [assetId, condition] of Object.entries(input.local.adventureConditions)) {
    if (condition.life === "dead") adventureConditions[assetId] = condition;
  }
  const mergedState: PlayState = {
    ...(input.preferLocalState ? restoredPlayState : input.local),
    ...(input.preferLocalState ? input.local : restoredPlayState),
    inventory: mergeRecords(input.local.inventory, restoredPlayState.inventory),
    achievements: mergeRecords(input.local.achievements, restoredPlayState.achievements),
    completedMissionIds: mergeRecords(input.local.completedMissionIds, restoredPlayState.completedMissionIds),
    discoveredCardIds: mergeRecords(input.local.discoveredCardIds, restoredPlayState.discoveredCardIds),
    capturedHotspotIds: mergeRecords(input.local.capturedHotspotIds, restoredPlayState.capturedHotspotIds),
    pendingSyncAssetIds: mergeRecords(input.local.pendingSyncAssetIds, restoredPlayState.pendingSyncAssetIds),
    civicEvents: mergeRecords(input.local.civicEvents, restoredPlayState.civicEvents),
    ecologyEvents: mergeRecords(input.local.ecologyEvents, restoredPlayState.ecologyEvents),
    raidEvents: mergeRecords(input.local.raidEvents, restoredPlayState.raidEvents),
    rewardCards: mergeRecords(input.local.rewardCards, restoredPlayState.rewardCards),
    raidAchievements: mergeRecords(input.local.raidAchievements, restoredPlayState.raidAchievements),
    ascensionCatalysts: mergeRecords(input.local.ascensionCatalysts, restoredPlayState.ascensionCatalysts),
    hearttreeReceipts: mergeRecords(input.local.hearttreeReceipts, restoredPlayState.hearttreeReceipts).slice(-512),
    adventureConditions
  };
  const state = restorePlayState(serializePlayState(mergedState), input.actorId);
  const warnings: string[] = [];
  if (input.restored.canonicalCursor.revision < input.canonical.revision) warnings.push("wilds_player_vault_canonical_cursor_stale");
  if (input.restored.canonicalCursor.revision > input.canonical.revision) warnings.push("wilds_player_vault_canonical_sync_pending");
  return { state, warnings };
}
