"use client";
/** Development-only public signed-index fixture. No native custody or signing. */
import {useEffect, useState} from "react";
import {flushSync} from "react-dom";
import {createWildzContinuityDatabase} from "../../../lib/storage/wildz-indexed-db";
import {createWildzIdentityRepository} from "../../../lib/receiz/wildz-identity-repository";
import {loadWildzWalletPresentation} from "../../../lib/receiz/wildz-wallet-presentation";
import {createWildsWalletControllerDriver} from "./wilds-wallet-controller-driver";
import {createWildsWalletSessionCache, type WildsWalletPresentationState} from "./wilds-wallet-controller";
import {createWildsWalletResourceProjectionStoreV128} from "./wilds-wallet-resource-projection-store-v128";
import {projectWildsWalletResourceProjectionsV128} from "./wilds-wallet-resource-projection-v128";
import {useWildsWalletResourceRowsHydration, type WalletResourceRowsReader, type WalletResourceRowsState} from "./useWildsWalletResourceRowsHydration";
import {WildsWalletOverview} from "./WildsWalletOverview";
declare global {interface Window {walletBootstrapQA?: {load(abort?: boolean): Promise<unknown>; lifecycle(mode: "latest" | "unmount"): Promise<unknown>};}}
type DeliveryScope = {keyId: string; actorId: string; owner: string; incarnation: string};
type LifecycleProps = {reader: WalletResourceRowsReader; scope: DeliveryScope; controls: {replace?: () => void}};
function LifecycleProbe({reader, scope, controls}: LifecycleProps) {
  const [value, setValue] = useState<WalletResourceRowsState>(null);
  useWildsWalletResourceRowsHydration(reader, scope, value, setValue);
  useEffect(() => {controls.replace = () => setValue({...scope, rows: [], pending: false}); return () => {delete controls.replace;};}, [scope, controls]);
  return <output data-wallet-delivery>{value ? value.rows.length : "pending"}</output>;
}
export default function WalletBootstrapPressureFixture() {
  const [lifecycle, setLifecycle] = useState<LifecycleProps | null>(null);
  const [display, setDisplay] = useState<{state: WildsWalletPresentationState; pending: boolean; units: number} | null>(null);
  useEffect(() => {
    const database = createWildzContinuityDatabase(), repository = createWildzIdentityRepository({database});
    let controller: AbortController | null = null;
    window.walletBootstrapQA = {async load(abort = false) {
      controller?.abort(); controller = new AbortController(); const signal = controller.signal;
      const session = await repository.active(); if (!session) throw Error("fixture_session_missing");
      const start = performance.now(), presentation = await loadWildzWalletPresentation(database, session), observationMs = performance.now() - start;
      const driver = createWildsWalletControllerDriver({identityKey: session.actorId, authorityGeneration: "fixture", sourceKey: session.keyId, incarnation: session.walletObservationEpoch,
        observation: presentation.observation, cache: createWildsWalletSessionCache(4), publish() {}, fetcher: async () => {throw Error("fixture_network_forbidden");}});
      flushSync(() => setDisplay({state: driver.state, pending: true, units: 0}));
      const initialHTML = document.querySelector("[data-wallet-bootstrap]")?.textContent;
      const firstFrame = new Promise<number>(resolve => requestAnimationFrame(() => resolve(performance.now() - start)));
      const ownerHandle = `${session.username}.receiz.id`, incarnation = session.walletObservationEpoch ?? "legacy";
      const store = createWildsWalletResourceProjectionStoreV128({keyId: session.keyId, actorId: session.actorId, ownerHandle, incarnation,
        currentIdentity: () => ({keyId: session.keyId, ownerHandle, incarnation}), openRuntime: async () => {throw Error("fixture_native_source_forbidden");}}, {database: async () => database});
      const pending = store.listCached(signal);
      if (abort) controller.abort();
      try {
        const rows = await pending; await store.assertCurrent(); signal.throwIfAborted();
        const rowMs = performance.now() - start, projection = projectWildsWalletResourceProjectionsV128(rows), units = Object.values(projection.resourceUnitCounts).reduce((sum, count) => sum + count, 0);
        flushSync(() => setDisplay({state: driver.state, pending: false, units}));
        return {observationMs, rowMs, firstFrameMs: await firstFrame, rows: rows.length, units, initialHTML, settledHTML: document.querySelector("[data-wallet-bootstrap]")?.textContent};
      } catch (cause) {if (!abort) throw cause; return {aborted: true, observationMs, firstFrameMs: await firstFrame, initialHTML};}
      finally {driver.dispose();}
    }, async lifecycle(mode) {
      const session = await repository.active(); if (!session) throw Error("fixture_session_missing");
      const scope = {keyId: session.keyId, actorId: session.actorId, owner: `${session.username}.receiz.id`, incarnation: session.walletObservationEpoch ?? "legacy"};
      const store = createWildsWalletResourceProjectionStoreV128({...scope, ownerHandle: scope.owner,
        currentIdentity: () => ({...scope, ownerHandle: scope.owner}), openRuntime: async () => {throw Error("fixture_native_source_forbidden");}}, {database: async () => database});
      let release!: () => void, loaded!: () => void, finished!: () => void, activeSignal: AbortSignal | undefined;
      const gate = new Promise<void>(resolve => {release = resolve;}), ready = new Promise<void>(resolve => {loaded = resolve;}), done = new Promise<void>(resolve => {finished = resolve;});
      const controls: LifecycleProps["controls"] = {};
      const reader: WalletResourceRowsReader = {assertCurrent: store.assertCurrent, async listCached(signal) {activeSignal = signal; const rows = await store.listCached(signal); loaded(); await gate; finished(); return rows;}};
      flushSync(() => setLifecycle({scope, reader, controls})); await ready;
      if (mode === "latest") flushSync(() => controls.replace?.()); else flushSync(() => setLifecycle(null));
      release(); await done; await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame);
      const result = {mode, text: document.querySelector("[data-wallet-delivery]")?.textContent ?? null, aborted: activeSignal?.aborted};
      flushSync(() => setLifecycle(null)); return result;
    }};
    return () => {controller?.abort(); delete window.walletBootstrapQA;};
  }, []);
  return <main data-wallet-bootstrap>{lifecycle ? <LifecycleProbe {...lifecycle}/> : null}{display ? <WildsWalletOverview state={display.state} inventoryCounts={{resourceUnits: display.units, creatureCards: 68, resourceUnitsPending: display.pending}} onNavigate={() => {}}/> : <p>Disposable public index bootstrap probe</p>}</main>;
}
