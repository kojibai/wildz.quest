import assert from "node:assert/strict";
import { test } from "node:test";
import { prepareWildzLocalCardSealer, readWildzLocalSealerReadiness } from "../src/lib/receiz/local-seal/browser";

// Substitute only the Worker transport. The real browser client owns requests,
// errors, setup ordering and resource lifetime; canonical proofs are covered by
// wildz-local-image-seal and wildz-owned-card-export with the actual SDK.
function browserWorkerFixture() {
  const descriptors = new Map(["window", "Worker"].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const workers: TestWorker[] = [];
  let rejectPosts = false;
  class TestWorker {
    onmessage: ((event: { data: { id: number; result?: unknown; error?: string } }) => void) | null = null;
    onerror: ((event: { message: string }) => void) | null = null;
    onmessageerror: (() => void) | null = null;
    messages: { id: number; command: string; input?: unknown }[] = [];
    terminations = 0;
    failPost = false;
    constructor() { workers.push(this); }
    postMessage(message: TestWorker["messages"][number]) {
      if (this.failPost || rejectPosts) throw new Error("test_worker_post_failed");
      this.messages.push(message);
    }
    terminate() { this.terminations++; }
    reply(index: number, result: unknown, error?: string) {
      this.onmessage?.({ data: { id: this.messages[index]!.id, result, ...(error ? { error } : {}) } });
    }
  }
  Object.defineProperty(globalThis, "window", { configurable: true, value: { indexedDB: {} } });
  Object.defineProperty(globalThis, "Worker", { configurable: true, value: TestWorker });
  return { workers, rejectPosts: () => { rejectPosts = true; },
    restore() {
      // Clears any failed-test request deadline without a production test API.
      workers.at(-1)?.onerror?.({ message: "test_cleanup" });
      for (const [name, descriptor] of descriptors) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else Reflect.deleteProperty(globalThis, name);
      }
    } };
}

test("a completed readiness operation releases its signing worker and the next call reopens custody", async () => {
  const f = browserWorkerFixture();
  try {
    const first = readWildzLocalSealerReadiness();
    f.workers[0]!.reply(0, true);
    assert.equal(await first, true);
    assert.equal(f.workers[0]!.terminations, 1, "idle resource and proving runtime must be released");
    const second = readWildzLocalSealerReadiness();
    assert.equal(f.workers.length, 2);
    f.workers[1]!.reply(0, false);
    assert.equal(await second, false);
    assert.equal(f.workers[1]!.terminations, 1);
  } finally { f.restore(); }
});

test("overlapping readiness requests share one worker until the last result settles", async () => {
  const f = browserWorkerFixture();
  try {
    const first = readWildzLocalSealerReadiness(), second = readWildzLocalSealerReadiness();
    assert.equal(f.workers.length, 1);
    f.workers[0]!.reply(1, true);
    assert.equal(await second, true);
    assert.equal(f.workers[0]!.terminations, 0);
    f.workers[0]!.reply(0, false);
    assert.equal(await first, false);
    assert.equal(f.workers[0]!.terminations, 1);
  } finally { f.restore(); }
});

test("explicit signer setup retains one worker between readiness and enrollment then releases it", async () => {
  const f = browserWorkerFixture();
  try {
    const setup = prepareWildzLocalCardSealer();
    f.workers[0]!.reply(0, false);
    await Promise.resolve();
    assert.equal(f.workers.length, 1, "setup must not reload proof resources between commands");
    assert.equal(f.workers[0]!.terminations, 0);
    assert.deepEqual(f.workers[0]!.messages.map(message => message.command), ["ready", "enroll"]);
    f.workers[0]!.reply(1, undefined);
    await setup;
    assert.equal(f.workers[0]!.terminations, 1);
  } finally { f.restore(); }
});

test("signing-worker failure rejects all pending work and a later operation starts fresh", async () => {
  const f = browserWorkerFixture();
  try {
    const first = readWildzLocalSealerReadiness(), second = readWildzLocalSealerReadiness();
    const failed = Promise.all([assert.rejects(first, /wildz_local_seal_worker_failed: stopped/), assert.rejects(second, /wildz_local_seal_worker_failed: stopped/)]);
    f.workers[0]!.onerror?.({ message: "stopped" });
    await failed;
    assert.equal(f.workers[0]!.terminations, 1);
    const retry = readWildzLocalSealerReadiness();
    assert.equal(f.workers.length, 2);
    f.workers[1]!.reply(0, true);
    assert.equal(await retry, true);
    assert.equal(f.workers[1]!.terminations, 1);
  } finally { f.restore(); }
});

test("a rejected readiness result propagates the real error and releases its worker", async () => {
  const f = browserWorkerFixture();
  try {
    const result = readWildzLocalSealerReadiness();
    f.workers[0]!.reply(0, undefined, "offline_seal_resources_invalid");
    await assert.rejects(result, /offline_seal_resources_invalid/);
    assert.equal(f.workers[0]!.terminations, 1);
  } finally { f.restore(); }
});

test("a request that cannot cross the worker transport releases its deadline and rejects", async () => {
  const f = browserWorkerFixture();
  try {
    f.rejectPosts();
    await assert.rejects(readWildzLocalSealerReadiness(), /test_worker_post_failed/);
    assert.equal(f.workers[0]!.terminations, 1);
  } finally { f.restore(); }
});

test("a late error from a completed signing worker cannot cancel a newer Save operation", async () => {
  const f = browserWorkerFixture();
  try {
    const first = readWildzLocalSealerReadiness();
    f.workers[0]!.reply(0, true); await first;
    const second = readWildzLocalSealerReadiness();
    f.workers[0]!.onerror?.({ message: "late_old_error" });
    f.workers[1]!.reply(0, true);
    assert.equal(await second, true);
    assert.equal(f.workers[1]!.terminations, 1);
  } finally { f.restore(); }
});
