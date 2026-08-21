import type { JsonObject, ReceizClient } from "@receiz/sdk";
import type { WildzOwnershipWitness } from "./wildz-artifact-custody";
import { sameWildzPlayerCoordinate } from "./wildz-player-coordinate";
import { WILDZ_PRODUCT } from "../wildz/product";

export const WILDZ_OWNERSHIP_RECONCILE_MAX_ASSETS = 1_000;
export const WILDZ_OWNERSHIP_SYNC_NAMESPACE = "wildz.quest:ownership:v119";
export const WILDZ_OWNERSHIP_SYNC_SCHEMA = "receiz.wilds_ownership_sync.v119";

type WildzOwnershipSyncProjection = Readonly<{
  assetId: string;
  artifactId: string;
  previousOwnerReceizId: string;
  ownerReceizId: string;
  headReference: string;
  historyDigestSha256: string;
  appendCount: number;
  witnessedKaiPulse: string;
  witnessedAt: string;
}>;

type WildzOwnershipSyncAppState = Pick<
  ReceizClient["appState"],
  "createRecord" | "createFeed" | "publish"
>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function parseWildzOwnershipReconcileRequest(value: unknown) {
  if (!isRecord(value)
    || Object.keys(value).length !== 1
    || !Object.hasOwn(value, "assetIds")
    || !Array.isArray(value.assetIds)
    || value.assetIds.length < 1
    || value.assetIds.length > WILDZ_OWNERSHIP_RECONCILE_MAX_ASSETS
    || value.assetIds.some((assetId) => typeof assetId !== "string" || !/^wilds:[a-f0-9]{24}$/.test(assetId))) {
    throw new Error("wildz_ownership_reconcile_request_invalid");
  }
  return [...new Set(value.assetIds as string[])];
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim() === value && value.length > 0;
}

function ownershipSyncProjection(value: unknown): WildzOwnershipSyncProjection | null {
  if (!isRecord(value)
    || value.namespace !== WILDZ_OWNERSHIP_SYNC_NAMESPACE
    || value.schema !== WILDZ_OWNERSHIP_SYNC_SCHEMA
    || value.state !== "published"
    || !isRecord(value.data)) return null;
  const data = value.data;
  if (data.schema !== WILDZ_OWNERSHIP_SYNC_SCHEMA
    || typeof data.assetId !== "string"
    || !/^wilds:[a-f0-9]{24}$/.test(data.assetId)
    || typeof data.artifactId !== "string"
    || !/^[a-f0-9]{64}$/.test(data.artifactId)
    || !nonEmpty(data.previousOwnerReceizId)
    || !data.previousOwnerReceizId.endsWith(".receiz.id")
    || !nonEmpty(data.ownerReceizId)
    || !data.ownerReceizId.endsWith(".receiz.id")
    || !nonEmpty(data.headReference)
    || typeof data.historyDigestSha256 !== "string"
    || !/^[a-f0-9]{64}$/.test(data.historyDigestSha256)
    || !Number.isSafeInteger(data.appendCount)
    || Number(data.appendCount) < 1
    || !nonEmpty(data.witnessedKaiPulse)
    || !nonEmpty(data.witnessedAt)
    || !Number.isFinite(Date.parse(data.witnessedAt))
    || !isRecord(data.authority)
    || data.authority.claim !== "witnessed-kai-pulse-in-sealed-artifact"
    || data.authority.server !== "synchronization-projection-only") return null;
  return {
    assetId: data.assetId,
    artifactId: data.artifactId,
    previousOwnerReceizId: data.previousOwnerReceizId,
    ownerReceizId: data.ownerReceizId,
    headReference: data.headReference,
    historyDigestSha256: data.historyDigestSha256,
    appendCount: Number(data.appendCount),
    witnessedKaiPulse: data.witnessedKaiPulse,
    witnessedAt: data.witnessedAt
  };
}

function sameSyncHead(left: WildzOwnershipSyncProjection, right: WildzOwnershipSyncProjection) {
  return left.artifactId === right.artifactId
    && left.ownerReceizId === right.ownerReceizId
    && left.headReference === right.headReference
    && left.historyDigestSha256 === right.historyDigestSha256;
}

export function lostWildzOwnershipAssetIdsFromSync(
  records: unknown,
  actorId: string,
  assetIds: readonly string[]
) {
  if (!Array.isArray(records) || records.length > 100_000) return [];
  const requested = new Set(assetIds);
  const heads = new Map<string, { projection: WildzOwnershipSyncProjection; divergent: boolean }>();
  for (const record of records) {
    const projection = ownershipSyncProjection(record);
    if (!projection || !requested.has(projection.assetId)) continue;
    const current = heads.get(projection.assetId);
    if (!current) {
      heads.set(projection.assetId, { projection, divergent: false });
      continue;
    }
    if (current.projection.artifactId !== projection.artifactId) {
      current.divergent = true;
      continue;
    }
    if (projection.appendCount > current.projection.appendCount) {
      current.projection = projection;
      continue;
    }
    if (projection.appendCount === current.projection.appendCount
      && !sameSyncHead(current.projection, projection)) current.divergent = true;
  }
  return assetIds.filter((assetId) => {
    const head = heads.get(assetId);
    return Boolean(head && !head.divergent && !sameWildzPlayerCoordinate(head.projection.ownerReceizId, actorId));
  });
}

function syncData(assetId: string, witness: WildzOwnershipWitness): JsonObject {
  return {
    schema: WILDZ_OWNERSHIP_SYNC_SCHEMA,
    assetId,
    artifactId: witness.artifactId,
    previousOwnerReceizId: witness.previousOwnerReceizId,
    ownerReceizId: witness.ownerReceizId,
    headReference: witness.headReference,
    historyDigestSha256: witness.historyDigestSha256,
    appendCount: witness.appendCount,
    witnessedKaiPulse: witness.witnessedKaiPulse,
    witnessedAt: witness.witnessedAt,
    authority: {
      claim: "witnessed-kai-pulse-in-sealed-artifact",
      server: "synchronization-projection-only"
    }
  };
}

export async function publishWildzOwnershipSyncProjection(
  appState: WildzOwnershipSyncAppState,
  witness: WildzOwnershipWitness,
  assetIds: readonly string[],
  idempotencyKey: string
): Promise<"admitted" | "unavailable"> {
  try {
    const records = assetIds.map((assetId) => appState.createRecord({
      id: `wildz_ownership_v119_${assetId.slice(6)}_${witness.appendCount}_${witness.historyDigestSha256.slice(0, 20)}`,
      sourceUrl: `${WILDZ_PRODUCT.origin}/cards/${encodeURIComponent(assetId)}?ownership=${encodeURIComponent(witness.headReference)}`,
      externalCreatorId: witness.ownerReceizId,
      namespace: WILDZ_OWNERSHIP_SYNC_NAMESPACE,
      schema: WILDZ_OWNERSHIP_SYNC_SCHEMA,
      state: "published",
      platform: WILDZ_PRODUCT.domain,
      data: syncData(assetId, witness)
    }));
    const feed = appState.createFeed(records, {
      namespace: WILDZ_OWNERSHIP_SYNC_NAMESPACE,
      externalCreatorId: witness.ownerReceizId
    });
    const response = await appState.publish(feed, {
      idempotencyKey: `wildz-ownership:${idempotencyKey}:${witness.historyDigestSha256.slice(0, 24)}`.slice(0, 160)
    });
    return response.ok === true && (typeof response.rejected !== "number" || response.rejected === 0)
      ? "admitted"
      : "unavailable";
  } catch {
    return "unavailable";
  }
}
