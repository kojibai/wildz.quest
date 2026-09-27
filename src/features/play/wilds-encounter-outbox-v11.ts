import { admitWildsV11EncounterFromSite } from "./wilds-encounter-client-v11";
import type { WildsV11CreatureCard } from "./wilds-card-proof-v11";
import { generateWildsRegionV11 } from "./wilds-region-generator-v11";
import { parseWildsWorldAddress, WILDS_REGION_MICRO_UNITS, type WildsWorldAddress } from "./wilds-world-address";

export const WILDS_V11_ENCOUNTER_OUTBOX_SCHEMA = "wildz.encounter-outbox.v11" as const;
const MAX_PENDING = 64;
const ADMISSION_RADIUS_MICRO = 3_000_000n;

export type PendingWildsV11Site = Readonly<{
  actorId: string;
  site: WildsWorldAddress;
  slot: number;
}>;

export type WildsV11EncounterOutbox = Readonly<{
  schema: typeof WILDS_V11_ENCOUNTER_OUTBOX_SCHEMA;
  pending: readonly PendingWildsV11Site[];
}>;

function canonicalPending(value: PendingWildsV11Site): PendingWildsV11Site {
  const site = parseWildsWorldAddress(value.site);
  if (!/^[a-z0-9:._-]{3,180}$/i.test(value.actorId) || !Number.isInteger(value.slot)
    || value.slot < 0 || value.slot > 5) throw new Error("wilds_v11_pending_site_invalid");
  const region = generateWildsRegionV11(site.regionX, site.regionZ);
  if (!region.encounterSites.some(candidate => candidate.slot === value.slot
    && candidate.localX === site.localX && candidate.localZ === site.localZ)) {
    throw new Error("wilds_v11_pending_site_invalid");
  }
  return { actorId: value.actorId, site, slot: value.slot };
}

function pendingKey(value: PendingWildsV11Site) {
  const { actorId, site, slot } = value;
  return `${actorId.length}:${actorId}:${site.regionX.length}:${site.regionX}:${site.regionZ.length}:${site.regionZ}:${site.localX}:${site.localZ}:${slot}`;
}

export function emptyWildsV11EncounterOutbox(): WildsV11EncounterOutbox {
  return { schema: WILDS_V11_ENCOUNTER_OUTBOX_SCHEMA, pending: [] };
}

/** Untrusted local storage is only an observation queue; it never confers rarity or ownership. */
export function restoreWildsV11EncounterOutbox(value: unknown, actorId: string): WildsV11EncounterOutbox {
  if (!value || typeof value !== "object" || (value as { schema?: unknown }).schema !== WILDS_V11_ENCOUNTER_OUTBOX_SCHEMA) {
    return emptyWildsV11EncounterOutbox();
  }
  const entries = (value as { pending?: unknown }).pending;
  if (!Array.isArray(entries)) return emptyWildsV11EncounterOutbox();
  const pending: PendingWildsV11Site[] = [];
  const seen = new Set<string>();
  for (const entry of entries.slice(0, MAX_PENDING)) {
    try {
      const site = canonicalPending(entry);
      const key = pendingKey(site);
      if (site.actorId === actorId && !seen.has(key)) { pending.push(site); seen.add(key); }
    } catch { /* Untrusted observation discarded. */ }
  }
  return { schema: WILDS_V11_ENCOUNTER_OUTBOX_SCHEMA, pending };
}

export function enqueueWildsV11Site(outbox: WildsV11EncounterOutbox, value: PendingWildsV11Site): WildsV11EncounterOutbox {
  const site = canonicalPending(value);
  const current = restoreWildsV11EncounterOutbox(outbox, site.actorId);
  if (current.pending.some(item => pendingKey(item) === pendingKey(site))) return current;
  if (current.pending.length >= MAX_PENDING) throw new Error("wilds_v11_encounter_outbox_full");
  return { ...current, pending: [...current.pending, site] };
}

function nearSite(a: WildsWorldAddress, b: WildsWorldAddress) {
  const region = BigInt(WILDS_REGION_MICRO_UNITS);
  const dx = (BigInt(a.regionX) - BigInt(b.regionX)) * region + BigInt(a.localX - b.localX);
  const dz = (BigInt(a.regionZ) - BigInt(b.regionZ)) * region + BigInt(a.localZ - b.localZ);
  return dx * dx + dz * dz <= ADMISSION_RADIUS_MICRO * ADMISSION_RADIUS_MICRO;
}

/** Try one nearby site per user/reconnect action. No background remote lookups or frame-loop work. */
export async function flushOneWildsV11Site(input: {
  outbox: WildsV11EncounterOutbox;
  actorId: string;
  playerAddress: WildsWorldAddress;
  target?: Readonly<{ site: WildsWorldAddress; slot: number }>;
  fetcher?: typeof fetch;
  pinnedKeys?: Readonly<Record<string, string>>;
}): Promise<{ kind: "no-nearby" | "pending" | "admitted"; outbox: WildsV11EncounterOutbox;
  birth?: WildsV11CreatureCard; error?: string }> {
  const playerAddress = parseWildsWorldAddress(input.playerAddress);
  const outbox = restoreWildsV11EncounterOutbox(input.outbox, input.actorId);
  const target = input.target ? canonicalPending({ actorId: input.actorId, ...input.target }) : null;
  const item = outbox.pending.find(candidate => (!target || pendingKey(candidate) === pendingKey(target))
    && nearSite(playerAddress, candidate.site));
  if (!item) return { kind: "no-nearby", outbox };
  try {
    const birth = await admitWildsV11EncounterFromSite({ actorId: input.actorId, playerAddress,
      site: item.site, slot: item.slot, fetcher: input.fetcher, pinnedKeys: input.pinnedKeys });
    return { kind: "admitted", birth, outbox: { ...outbox,
      pending: outbox.pending.filter(candidate => pendingKey(candidate) !== pendingKey(item)) } };
  } catch (error) {
    return { kind: "pending", outbox, error: error instanceof Error ? error.message : "wilds_v11_encounter_authority_pending" };
  }
}
