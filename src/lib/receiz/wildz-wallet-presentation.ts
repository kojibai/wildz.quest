import type { WildzIdentitySession } from "./wildz-identity-repository";
import type { WildzContinuityDatabase } from "../storage/wildz-indexed-db";
import { createWildzWalletObservationStore, type WildzWalletObservation, type WildzWalletObservationPort } from "./wildz-wallet-observation";
import type { WildsWalletResourceProjectionRowV128 } from "../../features/play/wallet/wilds-wallet-resource-projection-v128";
export type WildzWalletPresentation = Readonly<{
  keyId: string; actorId: string; incarnation: string;
  observation: WildzWalletObservation | null;
  resourceRowsPending?: boolean;
  resourceRows: readonly WildsWalletResourceProjectionRowV128[];
}>;
/** Local compact admission only: no signing, private key, network or source reopening. */
export async function loadWildzWalletPresentation(database: WildzContinuityDatabase, session: WildzIdentitySession): Promise<WildzWalletPresentation> {
  const isCurrent = () => database.transaction(["meta"], "readonly", async tx => {
    const pointer = await tx.get<{keyId: string; actorId: string}>("meta", "receiz.wildz.active_identity.v1");
    const active = await tx.get<WildzIdentitySession>("meta", `receiz.wildz.identity_session.v1:${session.keyId}`);
    return pointer?.keyId === session.keyId && pointer.actorId === session.actorId && active?.actorId === session.actorId
      && active.walletObservationEpoch === session.walletObservationEpoch;
  }).catch(() => false);
  const empty = {keyId: session.keyId, actorId: session.actorId, incarnation: session.walletObservationEpoch ?? "legacy", observation: null, resourceRows: []};
  if (!await isCurrent()) return empty;
  // Only this compact authenticated observation gates Campaign's first render.
  // The serializable descriptor starts no bulk read/worker before that handoff.
  const observation = await createWildzWalletObservationStore(database).load(session);
  if (!await isCurrent()) return empty;
  return {keyId: session.keyId, actorId: session.actorId, incarnation: session.walletObservationEpoch ?? "legacy", observation, resourceRows: [], resourceRowsPending: Boolean(session.username)};
}
export function createWildzWalletObservationPort(database: WildzContinuityDatabase, scope: Pick<WildzIdentitySession, "keyId" | "actorId" | "walletObservationEpoch">): WildzWalletObservationPort {
  const store = createWildzWalletObservationStore(database);
  return {observe: (summary, origin, freshness) => store.observe(scope, summary, origin, freshness),
    retire: () => database.transaction(["meta"], "readwrite", tx => store.retire(tx, scope))};
}
