/** A requested return survives the temporary battle hold until the expedition
 * store confirms recall. This is a command queue, never movement authority. */
export function createWildsCrewBattleRecallQueue(input: Readonly<{
  readScope(): string;
  readPending(assetId: string): boolean;
  writePending(assetId: string, pending: boolean): void;
  recall(assetId: string): Promise<boolean>;
  onError(error: unknown): void;
}>) {
  const pending = new Set<string>();
  const flights = new Map<string, Promise<void>>();
  let disposed = false;
  const key = (scope: string, assetId: string) => JSON.stringify([scope, assetId]);
  const current = (scope: string) => !disposed && input.readScope() === scope;
  function report(scope: string, error: unknown) {
    if (current(scope)) input.onError(error);
  }
  return {
    request(assetId: string) {
      if (disposed) return;
      const scope = input.readScope();
      pending.add(key(scope, assetId));
      try { input.writePending(assetId, true); }
      catch (error) { report(scope, error); }
    },
    resume(assetId: string): void {
      if (disposed) return;
      const scope = input.readScope(), id = key(scope, assetId);
      if (flights.has(id)) return;
      try { if (!pending.has(id) && !input.readPending(assetId)) return; }
      catch (error) { report(scope, error); return; }
      pending.add(id);
      const flight = Promise.resolve().then(async () => {
        if (!current(scope)) return;
        const recalled = await input.recall(assetId);
        if (!recalled || !current(scope)) return;
        // Keep the in-memory request if durable removal fails, so another
        // release can retry instead of silently losing the user's command.
        input.writePending(assetId, false);
        pending.delete(id);
      }).catch(error => report(scope, error)).finally(() => {
        if (flights.get(id) === flight) flights.delete(id);
      });
      flights.set(id, flight);
    },
    dispose() { disposed = true; pending.clear(); }
  };
}
