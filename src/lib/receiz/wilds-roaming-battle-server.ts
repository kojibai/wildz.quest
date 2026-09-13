import { openWildsRoamingTransport, sealWildsRoamingTransport } from "./wilds-roaming-transport-integrity";
import type { NextRequest } from "next/server";
import { digestReceizCanonicalV122, type JsonObject } from "@receiz/sdk";
import { createReceizCommerceAdapter } from "./adapter";
import { platform } from "../platform";
import { hostContextFromHost } from "../hosting/host-context";
import { admitWildsRoamingEncounter, roamingEncounterParticipant, type WildsRoamingEncounter } from "../../features/play/wilds-roaming-encounter";
import type { WildsMultiplayerActor } from "./wilds-multiplayer-server";

type AdapterFactory = typeof createReceizCommerceAdapter;
const key = Symbol.for("wildz.roaming-private-encounters.v1");
function records() {
  const root = globalThis as typeof globalThis & { [key]?: Map<string, WildsRoamingEncounter> };
  return root[key] ??= new Map();
}
const serial = Symbol.for("wildz.roaming-private-encounter-queue.v1");
export function serializeWildsRoamingEncounter<T>(work: () => Promise<T>): Promise<T> {
  const root = globalThis as typeof globalThis & { [serial]?: Promise<unknown> };
  const next = (root[serial] ?? Promise.resolve()).catch(() => undefined).then(work);
  root[serial] = next.catch(() => undefined);
  return next;
}
export function wildsRoamingEncounterSourceUrl(request: NextRequest, id: string) {
  if (!/^[a-zA-Z0-9:-]{8,160}$/.test(id)) throw new Error("wilds_roaming_encounter_id_invalid");
  return `${new URL(request.url).origin}/api/wilds/multiplayer/roaming-battle?encounterId=${encodeURIComponent(id)}`;
}
export function storeWildsRoamingEncounter(row: WildsRoamingEncounter) {
  const next = admitWildsRoamingEncounter(records().get(row.id), row);
  if (!records().has(row.id) && records().size >= 256) {
    const removable = [...records().values()].find(item => item.cancelled || (item.session && item.session.outcome !== "active") || item.expiresKaiUPulse <= row.requestedKaiUPulse);
    if (!removable) throw new Error("wilds_roaming_encounter_capacity_busy");
    records().delete(removable.id);
  }
  records().set(row.id, next);
  return next;
}
function findRecord(value: unknown, depth = 0): WildsRoamingEncounter | null {
  if (!value || typeof value !== "object" || Array.isArray(value) || depth > 6) return null;
  const record = value as Record<string, unknown>;
  if (record.schema === "wildz.roaming-transport.v1") return openWildsRoamingTransport<WildsRoamingEncounter>(record, "wildz.roaming-encounter.v1");
  if (record.schema === "wildz.roaming-encounter.v1") throw new Error("wilds_roaming_transport_invalid");
  for (const field of ["state", "data", "record", "appState", "result"]) {
    const found = findRecord(record[field], depth + 1);
    if (found) return found;
  }
  return null;
}
async function deadline<T>(promise: Promise<T>) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([promise, new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), 1500); })]); }
  finally { if (timer) clearTimeout(timer); }
}
/** Read is participant authenticated. The private record is gameplay evidence, not custody authority. */
export async function readWildsRoamingEncounter(request: NextRequest, actor: WildsMultiplayerActor, id: string, adapterFactory: AdapterFactory = createReceizCommerceAdapter) {
  if (actor.practice) throw new Error("wilds_roaming_encounter_identity_required");
  const sourceUrl = wildsRoamingEncounterSourceUrl(request, id);
  const prior = records().get(id);
  if (prior && !roamingEncounterParticipant(prior, actor.playerId)) throw new Error("wilds_roaming_encounter_participant_required");
  let recovered: unknown;
  try { recovered = await deadline(adapterFactory(actor.accessToken ? { accessToken: actor.accessToken } : undefined).readAppStateByUrl(sourceUrl)); }
  catch { recovered = null; }
  const incoming = findRecord(recovered);
  if (incoming?.id === id) {
    if (!roamingEncounterParticipant(incoming, actor.playerId)) throw new Error("wilds_roaming_encounter_participant_required");
    storeWildsRoamingEncounter(incoming);
  }
  const row = records().get(id);
  if (!row) throw new Error("wilds_roaming_encounter_not_found");
  if (!roamingEncounterParticipant(row, actor.playerId)) throw new Error("wilds_roaming_encounter_participant_required");
  return row;
}
export async function publishWildsRoamingEncounter(request: NextRequest, actor: WildsMultiplayerActor, row: WildsRoamingEncounter, adapterFactory: AdapterFactory = createReceizCommerceAdapter) {
  if (actor.practice || !roamingEncounterParticipant(row, actor.playerId)) throw new Error("wilds_roaming_encounter_participant_required");
  const sourceUrl = wildsRoamingEncounterSourceUrl(request, row.id);
  const host = hostContextFromHost(new URL(sourceUrl).host);
  const sealed = sealWildsRoamingTransport(row, "wildz.roaming-encounter.v1");
  const publicationDigest = await digestReceizCanonicalV122(sealed);
  try {
    const result = await deadline(adapterFactory(actor.accessToken ? { accessToken: actor.accessToken } : undefined).client.appState.publish({
      tenantHost: host.tenantHost ?? host.host ?? platform.domain,
      creatorReceizId: actor.receizActorId, externalCreatorId: actor.receizActorId,
      title: `Wildz roaming encounter ${row.id}`, sourceUrl, namespace: row.id,
      projectionState: "published", visibility: "private", platform: platform.productName,
      state: sealed as unknown as JsonObject, data: sealed as unknown as JsonObject
    }, { idempotencyKey: `roaming:${publicationDigest}` }));
    return { published: Boolean(result?.ok), mode: result?.ok ? "receiz_synced" as const : "sync_pending" as const };
  } catch { return { published: false, mode: "sync_pending" as const }; }
}

/** Called only by the native capture route after its own proof/claim verification. */
export async function recordWildsRoamingCaptureState(request: NextRequest, actor: WildsMultiplayerActor, id: string, phase: "ready" | "captured" | "expired") {
  return serializeWildsRoamingEncounter(async () => {
    const row = await readWildsRoamingEncounter(request, actor, id);
    if (!row.session || row.session.outcome !== "capture-eligible" || row.ownerAcknowledgedRevision !== row.session.revision) throw new Error("wilds_roaming_encounter_approved_win_required");
    if (row.capturePhase === "captured" || row.capturePhase === phase) return row;
    const next = storeWildsRoamingEncounter({ ...row, revision: row.revision + 1, capturePhase: phase });
    await publishWildsRoamingEncounter(request, actor, next);
    return next;
  });
}

export function assertWildsRoamingEncounterAvailable(row: WildsRoamingEncounter, kaiUPulse: number) {
  for (const other of records().values()) {
    if (other.id !== row.id && other.defenderId === row.defenderId && other.defenderAssetId === row.defenderAssetId
      && other.session?.outcome === "active" && other.expiresKaiUPulse > kaiUPulse) throw new Error("wilds_roaming_encounter_creature_busy");
  }
}
