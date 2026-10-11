import { createWildzExportCoordinator } from "./wildz-export-coordinator";

/** Settled artifacts are bounded independently of exact in-flight preparations.
 * One serial lane retains at most one waiting speculative target. Explicit Saves
 * join/promote their exact target and are never displaced by background work. */
export function createWildzPreparedCardCache<T>(limit = 8) {
  const settled = new Map<string, T>();
  const inFlight = new Map<string, { scheduled: Promise<T>; pending: Promise<T> }>();
  const coordinator = createWildzExportCoordinator<{ key: string; prepare?: () => Promise<T> }, T>({
    sameSnapshot: (left, right) => left.key === right.key,
    build: snapshot => {
      const prepare = snapshot.prepare!;
      // The coordinator retains its settled key/artifact, not captured player input.
      snapshot.prepare = undefined;
      return prepare();
    }
  });
  return {
    get(key: string, prepare: () => Promise<T>, options: { speculative?: boolean; allowPrompt?: boolean } = {}): Promise<T> {
      if (settled.has(key)) {
        if (options.speculative) coordinator.cancelOtherSpeculative({ key });
        return Promise.resolve(settled.get(key)!);
      }
      const scheduled = coordinator.prepare({ key, prepare }, options.allowPrompt ?? !options.speculative, { explicit: !options.speculative });
      const existing = inFlight.get(key);
      if (existing?.scheduled === scheduled) return existing.pending;
      const pending = scheduled.then(artifact => {
        settled.set(key, artifact);
        while (settled.size > limit) settled.delete(settled.keys().next().value!);
        return artifact;
      }).finally(() => { if (inFlight.get(key)?.pending === pending) inFlight.delete(key); });
      inFlight.set(key, { scheduled, pending });
      return pending;
    }
  };
}
