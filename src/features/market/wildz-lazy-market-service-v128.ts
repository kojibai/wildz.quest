import type { WildzMarketServiceV128, WildzMarketSnapshotV128 } from "./wildz-market-service-v128";

/** The game can expose actions to the shell without importing, opening or
 * enrolling a source runtime. Opening Market or an explicit sale action starts
 * the service; reading the cached snapshot and subscribing remain local. */
export function createLazyWildzMarketServiceV128(input: Readonly<{
  binding: WildzMarketServiceV128["binding"];
  currentBinding(): WildzMarketServiceV128["binding"];
  open(): Promise<WildzMarketServiceV128>;
}>) {
  let snapshot: WildzMarketSnapshotV128 = { status: "loading", message: "Open the market to check current listings.", listings: [], purchases: [], sellables: [] };
  let service: WildzMarketServiceV128 | null = null, opening: Promise<WildzMarketServiceV128> | null = null;
  let unsubscribe: (() => void) | null = null, disposed = false;
  const listeners = new Set<(snapshot: WildzMarketSnapshotV128) => void>();
  const current = () => {
    const binding = input.currentBinding();
    if (disposed || binding.keyId !== input.binding.keyId || binding.ownerHandle !== input.binding.ownerHandle) throw Error("The Explorer changed. Reopen the same marketplace action.");
  };
  const emit = (next: WildzMarketSnapshotV128) => { current(); snapshot = next; for (const listener of listeners) listener(next); };
  const attach = () => {
    if (!service || unsubscribe || !listeners.size) return;
    unsubscribe = service.subscribe(value => {
      try { current(); } catch { return; }
      emit(value);
    });
  };
  const open = async () => {
    current();
    if (service) return service;
    if (!opening) {
      const operation = (async () => {
        const next = await input.open(); current();
        if (next.binding.keyId !== input.binding.keyId || next.binding.ownerHandle !== input.binding.ownerHandle) throw Error("The market belongs to another Explorer.");
        service = next;
        attach();
        emit(next.snapshot()); return next;
      })();
      opening = operation;
      void operation.finally(() => { if (opening === operation) opening = null; }).catch(() => undefined);
    }
    return opening;
  };
  const run = async <T>(action: (service: WildzMarketServiceV128) => Promise<T>) => {
    const next = await open(); current();
    const result = await action(next); current(); return result;
  };
  const lazy: WildzMarketServiceV128 = {
    binding: input.binding, snapshot: () => snapshot,
    subscribe(listener) {
      current(); listeners.add(listener); attach();
      return () => { listeners.delete(listener); if (!listeners.size) { unsubscribe?.(); unsubscribe = null; } };
    },
    read: () => run(next => next.read()),
    list: request => run(next => next.list(request)),
    cancel: id => run(next => next.cancel(id)),
    previewPurchase: id => run(next => next.previewPurchase(id)),
    approvePurchase: id => run(next => next.approvePurchase(id)),
    resume: id => run(next => next.resume(id)),
    accept: id => run(next => next.accept(id)),
    receive: (context, sender) => run(next => next.receive(context, sender)),
  };
  return { service: lazy, opened: () => service !== null, dispose() { disposed = true; unsubscribe?.(); unsubscribe = null; listeners.clear(); } };
}
