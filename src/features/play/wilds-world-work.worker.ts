/// <reference lib="webworker" />
import { performWildsWorldWork, type WildsWorldWork } from "./wilds-world-work";
import { prepareAndPersistWildsWorldOutboxEntry, persistWildsWorldCommandDurably, type WildsWorldOutboxEntry } from "./wilds-world-outbox";
import type { WildsWorldProjection } from "./wilds-world-state";
type FusedAdmissionWork = { kind: "prepare-persist"; base: WildsWorldProjection; entry: WildsWorldOutboxEntry; anchorId?: string | null };
const scope = self as unknown as DedicatedWorkerGlobalScope;
scope.addEventListener("message", (event: MessageEvent<{ id: number; work: WildsWorldWork | FusedAdmissionWork }>) => {
  const { id, work } = event.data;
  const operation = work.kind === "prepare-persist"
    ? prepareAndPersistWildsWorldOutboxEntry(work.base, work.entry, work.anchorId)
    : work.kind === "persist" ? persistWildsWorldCommandDurably(work.entry) : performWildsWorldWork(work);
  void operation.then(
    (value) => scope.postMessage({ id, ok: true, value }),
    (cause) => scope.postMessage({ id, ok: false, error: cause instanceof Error ? cause.message : "wilds_world_work_failed" })
  );
});
