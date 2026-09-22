/** Explicit exports only. State publication must never schedule a backup. */
export function createWildzExportCoordinator<Snapshot, Artifact>(options: {
  sameSnapshot: (left: Snapshot, right: Snapshot) => boolean;
  build: (snapshot: Snapshot, allowPrompt: boolean) => Promise<Artifact>;
}) {
  let cached: { snapshot: Snapshot; artifact: Artifact } | null = null;
  let tail: Promise<unknown> = Promise.resolve();
  const pending: Array<{ snapshot: Snapshot; allowPrompt: boolean; promise: Promise<Artifact> }> = [];
  return {
    peek(snapshot: Snapshot): Artifact | null {
      return cached && options.sameSnapshot(cached.snapshot, snapshot) ? cached.artifact : null;
    },
    prepare(snapshot: Snapshot, allowPrompt: boolean): Promise<Artifact> {
      if (cached && options.sameSnapshot(cached.snapshot, snapshot)) return Promise.resolve(cached.artifact);
      const existing = pending.find(job => job.allowPrompt === allowPrompt && options.sameSnapshot(job.snapshot, snapshot));
      if (existing) return existing.promise;
      const promise = tail.catch(() => undefined).then(() => options.build(snapshot, allowPrompt)).then(artifact => {
        cached = { snapshot, artifact };
        return artifact;
      }).finally(() => {
        const index = pending.indexOf(job);
        if (index !== -1) pending.splice(index, 1);
      });
      const job = { snapshot, allowPrompt, promise };
      pending.push(job); tail = promise;
      return promise;
    }
  };
}
