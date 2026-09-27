import { sealWildsV11Birth, type WildsV11CreatureCard } from "./wilds-card-proof-v11";
import type { WildsV11EncounterResult } from "./wilds-encounter-proof-v11";
import { WILDS_V11_ENCOUNTER_PUBLIC_KEYS } from "./wilds-v11-release-keys";
import { parseWildsWorldAddress, type WildsWorldAddress } from "./wilds-world-address";

type EncounterFetch = typeof fetch;
export const WILDS_V11_ORIGIN: WildsWorldAddress = Object.freeze({ worldVersion: 11,
  regionX: "0", regionZ: "0", localX: 0, localZ: 0 });

function sameAddress(left: WildsWorldAddress, right: WildsWorldAddress) {
  return left.regionX === right.regionX && left.regionZ === right.regionZ
    && left.localX === right.localX && left.localZ === right.localZ;
}

async function postEncounterAction(fetcher: EncounterFetch, body: object) {
  let response: Response;
  try {
    response = await fetcher("/api/wilds/encounters", { method: "POST", headers: { "content-type": "application/json" },
      cache: "no-store", body: JSON.stringify(body) });
  } catch {
    throw new Error("wilds_v11_encounter_connection_pending");
  }
  const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok || payload?.ok !== true) {
    const code = typeof payload?.error === "string" && /^wilds_v11_[a-z0-9_]+$/.test(payload.error)
      ? payload.error : "wilds_v11_encounter_authority_pending";
    throw new Error(code);
  }
  return payload;
}

/** Network is visited only on a discovered site action; proof checking stays in this browser. */
export async function admitWildsV11EncounterFromSite(input: {
  actorId: string;
  playerAddress: WildsWorldAddress;
  site: WildsWorldAddress;
  slot: number;
  fetcher?: EncounterFetch;
  pinnedKeys?: Readonly<Record<string, string>>;
}): Promise<WildsV11CreatureCard> {
  parseWildsWorldAddress(input.playerAddress);
  const site = parseWildsWorldAddress(input.site);
  if (!/^[a-z0-9:._-]{3,180}$/i.test(input.actorId) || !Number.isInteger(input.slot)
    || input.slot < 0 || input.slot > 5) throw new Error("wilds_v11_encounter_input_invalid");
  const fetcher = input.fetcher ?? fetch;
  const reply = await postEncounterAction(fetcher, { action: "encounter", site, slot: input.slot });
  const result = reply.result as WildsV11EncounterResult | undefined;
  let returnedSite: WildsWorldAddress;
  try { returnedSite = parseWildsWorldAddress(result?.input?.site); }
  catch { throw new Error("wilds_v11_encounter_reply_mismatch"); }
  if (!result || result.input?.actorId !== input.actorId || result.input.slot !== input.slot
    || !sameAddress(returnedSite, site)) {
    throw new Error("wilds_v11_encounter_reply_mismatch");
  }
  return sealWildsV11Birth(result, input.pinnedKeys ?? WILDS_V11_ENCOUNTER_PUBLIC_KEYS);
}
