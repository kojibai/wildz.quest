import assert from "node:assert/strict";
import { test } from "node:test";
import { activateWaitingUpdate } from "../src/features/pwa/pwa-update";

class FakeWorker extends EventTarget {
  messages: unknown[] = [];

  constructor(public state: ServiceWorkerState) {
    super();
  }

  postMessage(message: unknown) {
    this.messages.push(message);
    this.state = "activated";
    this.dispatchEvent(new Event("statechange"));
  }
}

test("one update action reacquires the live waiting worker when the rendered worker became stale", async () => {
  const staleWorker = new FakeWorker("redundant");
  const liveWorker = new FakeWorker("installed");
  const registration = {
    scope: "https://wildz.quest/",
    waiting: liveWorker,
    installing: null,
    active: null,
    update: async () => undefined
  };
  const serviceWorkers = Object.assign(new EventTarget(), {
    controller: null,
    getRegistration: async () => registration
  });

  await activateWaitingUpdate({
    serviceWorkers,
    registration,
    renderedWorker: staleWorker,
    message: { type: "WILDZ_APPLY_UPDATE" }
  });

  assert.deepEqual(staleWorker.messages, []);
  assert.deepEqual(liveWorker.messages, [{ type: "WILDZ_APPLY_UPDATE" }]);
});

test("one update action refreshes registration and activates a newly waiting worker", async () => {
  const staleWorker = new FakeWorker("redundant");
  const liveWorker = new FakeWorker("installed");
  const registration = {
    scope: "https://wildz.quest/",
    waiting: null as FakeWorker | null,
    installing: null,
    active: null,
    update: async () => {
      registration.waiting = liveWorker;
    }
  };
  const serviceWorkers = Object.assign(new EventTarget(), {
    controller: null,
    getRegistration: async () => registration
  });

  await activateWaitingUpdate({
    serviceWorkers,
    registration,
    renderedWorker: staleWorker,
    message: { type: "WILDZ_APPLY_UPDATE" }
  });

  assert.deepEqual(liveWorker.messages, [{ type: "WILDZ_APPLY_UPDATE" }]);
});

test("one update action continues automatically when the replacement is still installing", async () => {
  const staleWorker = new FakeWorker("redundant");
  const installingWorker = new FakeWorker("installing");
  const registration = {
    scope: "https://wildz.quest/",
    waiting: null,
    installing: installingWorker,
    active: null,
    update: async () => undefined
  };
  const serviceWorkers = Object.assign(new EventTarget(), {
    controller: null,
    getRegistration: async () => registration
  });

  const activation = activateWaitingUpdate({
    serviceWorkers,
    registration,
    renderedWorker: staleWorker,
    message: { type: "WILDZ_APPLY_UPDATE" }
  });
  await Promise.resolve();
  installingWorker.state = "installed";
  installingWorker.dispatchEvent(new Event("statechange"));
  await activation;

  assert.deepEqual(installingWorker.messages, [{ type: "WILDZ_APPLY_UPDATE" }]);
});
