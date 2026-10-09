/// <reference lib="webworker" />
import { defaultContinuityDatabase, defaultIdentityRepository } from "./wildz-active-identity";
import { loadWildzRestoredOwnerState } from "../../features/identity/wildz-restore";
import { reopenWildzStoredCrewCustody } from "./wildz-crew-custody-local";

const scope = self as unknown as DedicatedWorkerGlobalScope;
scope.addEventListener("message", (event: MessageEvent<{ keyId: string; actorId: string }>) => {
  const owner = event.data;
  if (!globalThis.indexedDB) {
    scope.postMessage({ ...owner, ok: false, fallbackSafe: true, error: "wildz_crew_custody_worker_storage_unavailable" });
    return;
  }
  void (async () => {
    const session = await defaultIdentityRepository.active();
    if (!session || session.keyId !== owner.keyId || session.actorId !== owner.actorId) throw Error("wildz_crew_custody_worker_owner_changed");
    const state = await loadWildzRestoredOwnerState({ database: defaultContinuityDatabase, session });
    if (!state) throw Error("wildz_crew_custody_worker_source_missing");
    await reopenWildzStoredCrewCustody(session, state.playState.inventory);
    scope.postMessage({ ...owner, ok: true });
  })().catch(cause => scope.postMessage({ ...owner, ok: false, error: cause instanceof Error ? cause.message : "wildz_crew_custody_worker_failed" }));
});
