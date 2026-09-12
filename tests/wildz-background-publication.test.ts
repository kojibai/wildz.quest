import assert from "node:assert/strict";
import { test } from "node:test";
import { startWildzProfilePublication, type ProfilePublicationStatus } from "../src/features/profile/background-publication";

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
function harness(publish: (signal: AbortSignal, progress: () => void) => Promise<unknown>, online = true) {
  const statuses: ProfilePublicationStatus[] = [];
  const timers = new Map<ReturnType<typeof setTimeout>, { callback: () => void; delay: number }>();
  let serial = 0;
  const connection = { online };
  const job = startWildzProfilePublication({
    publish, onStatus: (status) => statuses.push(status), isOnline: () => connection.online,
    schedule: (task) => Promise.resolve().then(task),
    setTimer: (callback, delay) => {
      const id = ++serial as unknown as ReturnType<typeof setTimeout>;
      timers.set(id, { callback, delay });
      return id;
    },
    clearTimer: (id) => { timers.delete(id); }
  });
  const fire = (delay: number) => {
    const entry = [...timers].find(([, timer]) => timer.delay === delay);
    assert.ok(entry, `expected ${delay}ms timer`);
    timers.delete(entry[0]); entry[1].callback();
  };
  return { job, statuses, timers, connection, fire };
}

test("publication queues immediate feedback, runs without a click, and never republishes a completed revision", async () => {
  let requests = 0;
  const h = harness(async () => { requests++; });
  assert.deepEqual(h.statuses, ["publishing"]);
  assert.equal(requests, 0);
  h.fire(300); await flush();
  assert.equal(requests, 1);
  assert.equal(h.statuses.at(-1), "ready");
  h.job.wake(); await flush();
  assert.equal(requests, 1);
  assert.equal(h.timers.size, 0);
});

test("offline publication resumes on reconnect and failures retry with backoff", async () => {
  let requests = 0;
  const h = harness(async () => { if (++requests === 1) throw new Error("offline"); }, false);
  h.fire(300); await flush();
  assert.equal(requests, 0);
  h.connection.online = true;
  h.job.wake(); await flush();
  assert.equal(h.statuses.at(-1), "unpublished");
  h.fire(15_000); await flush();
  assert.equal(requests, 2);
  assert.equal(h.statuses.at(-1), "ready");
});

test("a replaced profile cancels its request and cannot mark the new profile live", async () => {
  let finish!: () => void;
  let signal!: AbortSignal;
  const h = harness((input) => { signal = input; return new Promise<void>((resolve) => { finish = resolve; }); });
  h.fire(300); await flush();
  h.job.wake(); // No duplicate while pending.
  h.job.stop(); finish(); await flush();
  assert.equal(signal.aborted, true);
  assert.equal(h.statuses.includes("ready"), false);
  assert.equal(h.timers.size, 0);
});

test("a timed-out request is cancelled and retries automatically", async () => {
  const h = harness((signal) => new Promise((_, reject) => signal.addEventListener("abort", () => reject(signal.reason))));
  h.fire(300); await flush(); h.fire(30_000); await flush();
  assert.equal(h.statuses.at(-1), "unpublished");
  assert.ok([...h.timers.values()].some((timer) => timer.delay === 15_000));
  h.job.stop();
});

test("card progress renews the deadline so large restored vaults can finish publishing", async () => {
  let progress!: () => void;
  let finish!: () => void;
  const h = harness((_signal, reportProgress) => {
    progress = reportProgress;
    return new Promise<void>((resolve) => { finish = resolve; });
  });
  h.fire(300); await flush();
  const firstDeadline = [...h.timers.keys()][0];
  assert.equal(typeof progress, "function");
  progress();
  assert.equal(h.timers.has(firstDeadline!), false);
  assert.equal(h.timers.size, 1);
  finish(); await flush();
  assert.equal(h.statuses.at(-1), "ready");
  assert.equal(h.timers.size, 0);
});
