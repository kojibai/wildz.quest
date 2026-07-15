import { canonicalPortableCardJson, sha256PortableBasis } from "./portable-card";
import { restorePlayState, serializePlayState, type PlayState } from "./game-state";
import { WILDS_WORLD_ID } from "./wilds-world-event";
import type { WildsWorldProjection } from "./wilds-world-state";

export type WildsPlayerVaultPayload = {
  schema: "receiz.wilds_player_vault.v3";
  playerId: string;
  exportedAt: string;
  playState: PlayState;
  settings: {
    avatarStyle: "female" | "male" | null;
    movementMode: "walk" | "run";
    audio: Record<string, boolean | number>;
  };
  personalEvents: { eventId: string; kind: string; occurredAt: string; receiptDigest?: string }[];
  canonicalCursor: { worldId: typeof WILDS_WORLD_ID; revision: number; eventId: string | null };
  receipts: { eventId: string; digest: string }[];
  payloadDigest: string;
};

type PlayerVaultInput = Omit<WildsPlayerVaultPayload, "schema" | "payloadDigest">;

function identityValid(value: string) {
  return value.length >= 3 && value.length <= 180 && /^[a-z0-9][a-z0-9:._-]*$/i.test(value);
}

function normalizedInput(input: PlayerVaultInput): PlayerVaultInput {
  if (!identityValid(input.playerId)) throw new Error("wilds_player_vault_owner_invalid");
  if (!Number.isFinite(Date.parse(input.exportedAt))) throw new Error("wilds_player_vault_time_invalid");
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
    playState: restorePlayState(serializePlayState(input.playState)),
    personalEvents: [...events.values()]
      .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt) || left.eventId.localeCompare(right.eventId))
      .slice(-2_048),
    receipts: [...receipts.values()].sort((left, right) => left.eventId.localeCompare(right.eventId)).slice(-2_048)
  };
}

function basis(input: PlayerVaultInput) {
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
}) {
  if (input.restored.playerId !== input.actorId) throw new Error("wilds_player_vault_owner_invalid");
  const verified = verifyWildsPlayerVault(input.restored);
  if (!verified.ok) throw new Error(verified.errors[0] ?? "wilds_player_vault_invalid");
  const state = restorePlayState(serializePlayState({
    ...input.restored.playState,
    inventory: [...input.local.inventory, ...input.restored.playState.inventory]
  }));
  const warnings: string[] = [];
  if (input.restored.canonicalCursor.revision < input.canonical.revision) warnings.push("wilds_player_vault_canonical_cursor_stale");
  if (input.restored.canonicalCursor.revision > input.canonical.revision) warnings.push("wilds_player_vault_canonical_sync_pending");
  return { state, warnings };
}
