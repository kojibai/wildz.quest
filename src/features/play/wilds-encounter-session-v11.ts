import { isAdmittedWildsCard } from "./admitted-inventory";
import { startWildsV11BattleSession, type WildsV11BattleSession } from "./wilds-battle-session-v11";
import { flushOneWildsV11Site, type WildsV11EncounterOutbox } from "./wilds-encounter-outbox-v11";
import type { PortableCardAsset } from "./portable-card";
import type { WildsWorldAddress } from "./wilds-world-address";
import { sameWildzPlayerCoordinate } from "../../lib/receiz/wildz-player-coordinate";

export type WildsV11EncounterSessionResult =
  | Readonly<{ kind: "ready"; outbox: WildsV11EncounterOutbox; session: WildsV11BattleSession }>
  | Readonly<{ kind: "pending" | "no-nearby"; outbox: WildsV11EncounterOutbox; error?: string }>;

/** One explicit site action performs network admission, then local signature verification and battle setup. */
export async function resolveWildsV11EncounterSession(input: {
  outbox: WildsV11EncounterOutbox;
  actorId: string;
  playerAddress: WildsWorldAddress;
  target: Readonly<{ site: WildsWorldAddress; slot: number }>;
  leader: PortableCardAsset;
  fetcher?: typeof fetch;
  pinnedKeys: Readonly<Record<string, string>>;
}): Promise<WildsV11EncounterSessionResult> {
  if (!isAdmittedWildsCard(input.leader) || (input.leader.manifest.ownerReceizId !== input.actorId
    && !sameWildzPlayerCoordinate(input.leader.manifest.ownerReceizId, input.actorId))) {
    throw new Error("wilds_v11_encounter_leader_unadmitted");
  }
  const result = await flushOneWildsV11Site(input);
  if (result.kind !== "admitted") return { kind: result.kind, outbox: result.outbox, error: result.error };
  if (!result.birth) throw new Error("wilds_v11_encounter_birth_missing");
  const session = await startWildsV11BattleSession({ birth: result.birth, player: input.leader,
    ownerId: input.actorId, pinnedKeys: input.pinnedKeys });
  return { kind: "ready", outbox: result.outbox, session };
}
