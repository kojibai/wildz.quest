/** Opened Save surfaces may prepare; state publication must never schedule a backup.
 * Coalescing happens before build, hence before any dependent worker delta. */
export function createWildzExportCoordinator<Snapshot, Artifact>(options: {
  sameSnapshot: (left: Snapshot, right: Snapshot) => boolean;
  build: (snapshot: Snapshot, allowPrompt: boolean) => Promise<Artifact>;
}) {
  type Job = { snapshot: Snapshot; allowPrompt: boolean; explicit: boolean;
    promise: Promise<Artifact>; resolve: (value: Artifact) => void; reject: (error: unknown) => void };
  let cached: { snapshot: Snapshot; artifact: Artifact } | null = null;
  let active: Job | null = null;
  const waiting: Job[] = [];
  function finish() {
    active = null;
    const next = waiting.shift();
    if (next) start(next);
  }
  function start(job: Job) {
    active = job;
    void Promise.resolve().then(() => options.build(job.snapshot, job.allowPrompt)).then(artifact => {
      cached = { snapshot: job.snapshot, artifact };
      finish();
      job.resolve(artifact);
    }, error => {
      // Retire the failed job before consumers can synchronously retry Save.
      finish();
      job.reject(error);
    });
  }
  function cancelOtherSpeculative(snapshot: Snapshot) {
    for (let index = waiting.length - 1; index >= 0; index--) {
      const job = waiting[index]!;
      if (job.explicit || options.sameSnapshot(job.snapshot, snapshot)) continue;
      waiting.splice(index, 1)[0]!.reject(new Error("wildz_export_preparation_superseded"));
    }
  }
  return {
    // Cache-backed callers can select a settled artifact without enqueuing a build.
    cancelOtherSpeculative,
    peek(snapshot: Snapshot): Artifact | null {
      return cached && options.sameSnapshot(cached.snapshot, snapshot) ? cached.artifact : null;
    },
    prepare(snapshot: Snapshot, allowPrompt: boolean, request: { explicit?: boolean } = {}): Promise<Artifact> {
      const explicit = request.explicit ?? allowPrompt;
      if (!explicit) cancelOtherSpeculative(snapshot);
      if (cached && options.sameSnapshot(cached.snapshot, snapshot)) return Promise.resolve(cached.artifact);
      const existing = [active, ...waiting].find(job => job && options.sameSnapshot(job.snapshot, snapshot));
      if (existing) {
        if (explicit) {
          // Upgrade an unstarted background or nonprompt job, but never replace
          // an already protected callback with equal or lower prompt permission.
          if (existing !== active && (!existing.explicit || (allowPrompt && !existing.allowPrompt))) {
            existing.snapshot = snapshot;
            existing.allowPrompt = allowPrompt;
          }
          existing.explicit = true;
        }
        return existing.promise;
      }
      let resolve!: Job["resolve"], reject!: Job["reject"];
      const promise = new Promise<Artifact>((done, fail) => { resolve = done; reject = fail; });
      const job = { snapshot, allowPrompt, explicit, promise, resolve, reject };
      if (active) {
        // Explicit actions precede the one remaining speculative target.
        const speculativeIndex = waiting.findIndex(item => !item.explicit);
        if (explicit && speculativeIndex !== -1) waiting.splice(speculativeIndex, 0, job);
        else waiting.push(job);
      } else start(job);
      return promise;
    }
  };
}
