import {useEffect, useRef, type Dispatch, type SetStateAction} from "react";
import type {createWildsWalletResourceProjectionStoreV128} from "./wilds-wallet-resource-projection-store-v128";
import type {WildsWalletResourceProjectionRowV128} from "./wilds-wallet-resource-projection-v128";
export type WalletResourceRowsState = {keyId: string; actorId: string; owner: string; incarnation: string; pending?: boolean; rows: readonly WildsWalletResourceProjectionRowV128[]} | null;
export type WalletResourceRowsReader = Pick<ReturnType<typeof createWildsWalletResourceProjectionStoreV128>, "listCached" | "assertCurrent">;
/** Retained presentation is independent from first paint. A later action's row
 * state wins; cleanup and persisted scope checks fence async delivery. */
export function useWildsWalletResourceRowsHydration(store: WalletResourceRowsReader | null,
  scope: {keyId: string | null; actorId: string; owner: string | null; incarnation: string},
  value: WalletResourceRowsState, setValue: Dispatch<SetStateAction<WalletResourceRowsState>>) {
  const valueRef = useRef(value); valueRef.current = value;
  const {keyId, actorId, owner, incarnation} = scope;
  useEffect(() => {
    if (!store || !keyId || !owner) return;
    const before = valueRef.current, abort = new AbortController();
    void store.listCached(abort.signal).then(async rows => {
      await store.assertCurrent();
      if (!abort.signal.aborted) setValue(current => current === before ? {keyId, actorId, owner, incarnation, rows} : current);
    }).catch(() => undefined);
    return () => abort.abort();
  }, [store, keyId, actorId, owner, incarnation, setValue]);
}
