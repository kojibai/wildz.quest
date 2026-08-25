type UpdateWorker = EventTarget & {
  readonly state: ServiceWorkerState;
  postMessage(message: unknown): void;
};

type UpdateRegistration = {
  readonly scope: string;
  readonly waiting: UpdateWorker | null;
  readonly installing: UpdateWorker | null;
  readonly active: UpdateWorker | null;
  update(): Promise<unknown>;
};

type UpdateWorkerContainer = EventTarget & {
  readonly controller: UpdateWorker | null;
  getRegistration(scope?: string): Promise<UpdateRegistration | undefined>;
};

type ActivateWaitingUpdateOptions = {
  serviceWorkers: UpdateWorkerContainer;
  registration: UpdateRegistration;
  renderedWorker: UpdateWorker;
  message: unknown;
};

function canActivate(worker: UpdateWorker | null): worker is UpdateWorker {
  return worker !== null && worker.state !== "redundant";
}

async function liveRegistration(
  serviceWorkers: UpdateWorkerContainer,
  fallback: UpdateRegistration
): Promise<UpdateRegistration> {
  try {
    return await serviceWorkers.getRegistration(fallback.scope) ?? fallback;
  } catch {
    return fallback;
  }
}

/**
 * Activates the worker that is live at tap time, rather than trusting the
 * worker object captured when React rendered the update notice.
 */
export async function activateWaitingUpdate({
  serviceWorkers,
  registration,
  renderedWorker,
  message
}: ActivateWaitingUpdateOptions): Promise<void> {
  let currentRegistration = await liveRegistration(serviceWorkers, registration);
  let worker = canActivate(currentRegistration.waiting)
    ? currentRegistration.waiting
    : canActivate(renderedWorker)
      ? renderedWorker
      : null;

  if (!worker) {
    await currentRegistration.update();
    currentRegistration = await liveRegistration(serviceWorkers, currentRegistration);
    worker = canActivate(currentRegistration.waiting)
      ? currentRegistration.waiting
      : canActivate(currentRegistration.installing)
        ? currentRegistration.installing
        : null;
  }

  if (!worker) throw new Error("wildz_update_worker_unavailable");
  if (worker.state === "activated") return;

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    let activationRequested = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      serviceWorkers.removeEventListener("controllerchange", handleControllerChange);
      worker.removeEventListener("statechange", handleStateChange);
      if (error) reject(error);
      else resolve();
    };
    const handleControllerChange = () => finish();
    const handleStateChange = () => {
      if (worker.state === "activated") finish();
      else if (worker.state === "redundant") finish(new Error("wildz_update_worker_replaced"));
      else if (worker.state === "installed") requestActivation();
    };
    const requestActivation = () => {
      if (activationRequested || worker.state !== "installed") return;
      activationRequested = true;
      try {
        worker.postMessage(message);
      } catch (error) {
        finish(error instanceof Error ? error : new Error("wildz_update_message_failed"));
      }
    };

    serviceWorkers.addEventListener("controllerchange", handleControllerChange, { once: true });
    worker.addEventListener("statechange", handleStateChange);

    if (worker.state === "installed") requestActivation();
    else if (worker.state === "activated") {
      finish();
    }
  });
}
