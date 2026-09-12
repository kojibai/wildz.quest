/** One refresh at a time; a burst during a request needs only its latest follow-up. */
export function createWildsWorldRefreshCoordinator() {
  let running: Promise<void> | null = null;
  let next: (() => Promise<void>) | null = null;
  return {
    cancelPending() { next = null; },
    run(task: () => Promise<void>): Promise<void> {
      next = task;
      if (running) return running;
      running = Promise.resolve().then(async () => {
        try {
          while (next) {
            const current = next;
            next = null;
            try { await current(); }
            catch (cause) { if (!next) throw cause; }
          }
        } finally {
          // Clear synchronously with the last queue check: no promise-finally gap can lose new work.
          running = null;
        }
      });
      return running;
    }
  };
}
