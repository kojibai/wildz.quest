/// <reference lib="webworker" />

type WorkerRequest = { id: string; value: unknown };
const workerScope = self as unknown as DedicatedWorkerGlobalScope;

workerScope.addEventListener("message", (event: MessageEvent<WorkerRequest>) => {
  try {
    workerScope.postMessage({ id: event.data.id, ok: true, json: JSON.stringify(event.data.value) });
  } catch (cause) {
    workerScope.postMessage({
      id: event.data.id,
      ok: false,
      error: cause instanceof Error ? cause.message : "wildz_json_serialization_failed"
    });
  }
});
