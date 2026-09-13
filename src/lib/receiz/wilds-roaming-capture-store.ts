import type { JsonObject } from "@receiz/sdk";
import { digestReceizCanonicalV122 } from "@receiz/sdk";
import { createReceizCommerceAdapter } from "./adapter";
import { sealWildsRoamingTransport, openWildsRoamingTransport } from "./wilds-roaming-transport-integrity";
import type { PortableCardAsset } from "../../features/play/portable-card";
import type { WildsRoamingHandoff } from "./wilds-roaming-handoff";

/** Private transport custody for an owner-released source. This record never
 * authorizes a native claim: the route checks the accepted encounter and actor,
 * then the SDK alone performs and independently verifies ownership admission. */
export type WildsStoredRoamingHandoff = Readonly<{
  schema: "wildz.roaming-capture-transport.v1";
  battleId: string;
  ownerPlayerId: string;
  winnerPlayerId: string;
  winnerReceizId: string;
  expiresAtUPulse: number;
  handoff: WildsRoamingHandoff;
}>;

export function wildsRoamingCaptureSourceUrl(origin: string, battleId: string) {
  if (!/^[a-zA-Z0-9:_-]{1,168}$/.test(battleId)) throw new Error("wilds_capture_battle_id_invalid");
  return new URL(`/api/wilds/roaming/capture/source/${encodeURIComponent(battleId)}`, origin).toString();
}

function unwrap(value: unknown, depth = 0): WildsStoredRoamingHandoff | null {
  if (!value || typeof value !== "object" || Array.isArray(value) || depth > 8) return null;
  const record = value as Record<string, unknown>;
  if (record.schema === "wildz.roaming-transport.v1") return openWildsRoamingTransport<WildsStoredRoamingHandoff>(record, "wildz.roaming-capture-offer.v1");
  for (const key of ["state", "data", "record", "appState", "result"]) {
    const result = unwrap(record[key], depth + 1);
    if (result) return result;
  }
  return null;
}

export async function readWildsStoredRoamingHandoff(origin: string, battleId: string, adapter = createReceizCommerceAdapter()) {
  const record = unwrap(await readOptionalState(adapter, wildsRoamingCaptureSourceUrl(origin, battleId)));
  if (!record) return null;
  if (record.schema !== "wildz.roaming-capture-transport.v1" || record.handoff?.schema !== "wildz.roaming-handoff.v1"
    || record.battleId !== battleId || record.handoff?.battleId !== battleId
    || typeof record.ownerPlayerId !== "string" || typeof record.winnerPlayerId !== "string"
    || typeof record.winnerReceizId !== "string" || !Number.isSafeInteger(record.expiresAtUPulse)
    || record.expiresAtUPulse < 0) throw new Error("wilds_capture_transport_invalid");
  return record;
}

export async function storeWildsRoamingHandoff(origin: string, creatorReceizId: string,
  record: WildsStoredRoamingHandoff, adapter: ReturnType<typeof createReceizCommerceAdapter>) {
  const sourceUrl = wildsRoamingCaptureSourceUrl(origin, record.battleId);
  const sealed = sealWildsRoamingTransport(record, "wildz.roaming-capture-offer.v1");
  const digest = await digestReceizCanonicalV122(sealed);
  const result = await adapter.client.appState.publish({
    tenantHost: new URL(origin).host, creatorReceizId, externalCreatorId: creatorReceizId,
    title: "Wildz earned creature capture", sourceUrl, namespace: `wildz:roaming-capture:${record.battleId}`,
    visibility: "private", projectionState: "published", platform: "Wildz",
    state: sealed as unknown as JsonObject
  }, { idempotencyKey: `wildz:roaming-capture:${digest}` });
  if (!result?.ok) throw new Error("wilds_capture_transport_pending");
}

export type WildsRoamingClaimResult = Readonly<{
  schema: "wildz.roaming-claim-result.v1";
  battleId: string; winnerReceizId: string;
  card: PortableCardAsset;
  artifact: Readonly<{exactBytesB64u: string; artifactSha256: string; filename: string; mimeType: string}>;
}>;
function claimResult(value: unknown, depth = 0): WildsRoamingClaimResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value) || depth > 8) return null;
  const record = value as Record<string, unknown>;
  if (record.schema === "wildz.roaming-transport.v1") return openWildsRoamingTransport<WildsRoamingClaimResult>(record, "wildz.roaming-capture-result.v1");
  for (const key of ["state", "data", "record", "appState", "result"]) {
    const result = claimResult(record[key], depth + 1);
    if (result) return result;
  }
  return null;
}
export async function readWildsRoamingClaimResult(origin: string, battleId: string, adapter = createReceizCommerceAdapter()) {
  const result = claimResult(await readOptionalState(adapter, wildsRoamingCaptureSourceUrl(origin, `${battleId}:claimed`)));
  if (result && (result.schema !== "wildz.roaming-claim-result.v1" || result.battleId !== battleId)) throw new Error("wilds_capture_result_invalid");
  return result;
}
export async function storeWildsRoamingClaimResult(origin: string, result: WildsRoamingClaimResult, adapter: ReturnType<typeof createReceizCommerceAdapter>) {
  const sealed = sealWildsRoamingTransport(result, "wildz.roaming-capture-result.v1");
  const digest = await digestReceizCanonicalV122(sealed);
  const published = await adapter.client.appState.publish({ tenantHost: new URL(origin).host,
    creatorReceizId: result.winnerReceizId, externalCreatorId: result.winnerReceizId,
    title: "Wildz completed creature claim", visibility: "private", platform: "Wildz",
    sourceUrl: wildsRoamingCaptureSourceUrl(origin, `${result.battleId}:claimed`), namespace: `wildz:roaming-claim:${result.battleId}`,
    projectionState: "published", state: sealed as unknown as JsonObject
  }, { idempotencyKey: `wildz:roaming-claim:${digest}` });
  if (!published?.ok) throw new Error("wilds_capture_result_retention_pending");
}

async function readOptionalState(adapter: ReturnType<typeof createReceizCommerceAdapter>, url: string) {
  try { return await adapter.readAppStateByUrl(url); }
  catch (error) {
    if (error && typeof error === "object" && "status" in error && error.status === 404) return null;
    throw error;
  }
}
