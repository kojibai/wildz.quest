/// <reference lib="webworker" />
import { performWildsWorldWork, type WildsWorldWork } from "./wilds-world-work";
const scope = self as unknown as DedicatedWorkerGlobalScope;
scope.addEventListener("message", (event: MessageEvent<{ id: number; work: WildsWorldWork }>) => {
  const { id, work } = event.data;
  void performWildsWorldWork(work).then(
    (value) => scope.postMessage({ id, ok: true, value }),
    (cause) => scope.postMessage({ id, ok: false, error: cause instanceof Error ? cause.message : "wilds_world_work_failed" })
  );
});
