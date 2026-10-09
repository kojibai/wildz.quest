import assert from "node:assert/strict";
import test from "node:test";
import { startWildzSessionReconnect } from "../src/lib/receiz/wildz-session-reconnect";
const settle = () => new Promise(resolve => setImmediate(resolve));

test("restored proof sessions retry transient failures, serialize reconnects and stop after connection", async () => {
  let attempts = 0;
  const timers = new Map<number, { callback: () => void; delay: number }>();
  let id = 0;
  const connection = startWildzSessionReconnect({
    connect: async () => { attempts++; if (attempts === 1) throw new Error("offline"); return attempts >= 3; },
    setTimer: (callback, delay) => { timers.set(++id, { callback, delay }); return id as unknown as ReturnType<typeof setTimeout>; },
    clearTimer: timer => { timers.delete(timer as unknown as number); }
  });
  connection.wake(); connection.wake();
  await settle();
  assert.equal(attempts, 1);
  assert.equal(timers.get(1)?.delay, 1000);
  connection.wake();
  await settle();
  assert.equal(attempts, 2);
  assert.equal(timers.has(1), false);
  assert.equal(timers.get(2)?.delay, 2000);
  timers.get(2)!.callback();
  await settle();
  assert.equal(attempts, 3);
  assert.equal(timers.size, 0);
  connection.stop(); connection.wake();
  await settle();
  assert.equal(attempts, 3);
});

test("retiring an account prevents retry after its in-flight failure", async () => {
  let reject!: (error: Error) => void;
  let timers = 0;
  const connection = startWildzSessionReconnect({
    connect: () => new Promise((_resolve, rejectPromise) => { reject = rejectPromise; }),
    setTimer: () => { timers++; return 1 as unknown as ReturnType<typeof setTimeout>; }
  });
  await settle();
  connection.stop(); reject(new Error("retired"));
  await settle();
  assert.equal(timers, 0);
});

test("offline reopening makes no connected-session request and resumes when online", async () => {
  let online = false;
  let attempts = 0;
  let timers = 0;
  const options = {
    isOnline: () => online,
    connect: async () => { attempts++; return true; },
    setTimer: () => { timers++; return 1 as unknown as ReturnType<typeof setTimeout>; }
  };
  const connection = startWildzSessionReconnect(options);
  connection.wake();
  await settle();
  assert.equal(attempts, 0);
  assert.equal(timers, 0);

  online = true;
  connection.wake();
  await settle();
  assert.equal(attempts, 1);
  assert.equal(timers, 0);
  connection.stop();
});

test("going offline cancels a queued reconnect without losing online recovery", async () => {
  let online = true;
  let attempts = 0;
  let queued: (() => void) | undefined;
  let pendingTimer = false;
  const options = {
    isOnline: () => online,
    connect: async () => { attempts++; return attempts > 1; },
    setTimer: (callback: () => void) => {
      queued = callback;
      pendingTimer = true;
      return 1 as unknown as ReturnType<typeof setTimeout>;
    },
    clearTimer: () => { pendingTimer = false; }
  };
  const connection = startWildzSessionReconnect(options);
  await settle();
  assert.equal(attempts, 1);
  assert.equal(pendingTimer, true);

  online = false;
  connection.wake();
  assert.equal(pendingTimer, false);
  // A callback already dispatched before cancellation must still stay offline.
  queued!();
  await settle();
  assert.equal(attempts, 1);
  assert.equal(pendingTimer, false);

  online = true;
  connection.wake();
  await settle();
  assert.equal(attempts, 2);
  assert.equal(pendingTimer, false);
  connection.stop();
});

test("a reconnect failure after going offline does not schedule another request", async () => {
  let online = true;
  let resolve!: (connected: boolean) => void;
  let timers = 0;
  const options = {
    isOnline: () => online,
    connect: () => new Promise<boolean>(settled => { resolve = settled; }),
    setTimer: () => { timers++; return 1 as unknown as ReturnType<typeof setTimeout>; }
  };
  const connection = startWildzSessionReconnect(options);
  await settle();
  online = false;
  connection.wake();
  resolve(false);
  await settle();
  assert.equal(timers, 0);
  connection.stop();
});

test("going offline before the queued connection begins prevents its request", async () => {
  let online = true;
  let attempts = 0;
  let timers = 0;
  const options = {
    isOnline: () => online,
    connect: async () => { attempts++; return false; },
    setTimer: () => { timers++; return 1 as unknown as ReturnType<typeof setTimeout>; }
  };
  const connection = startWildzSessionReconnect(options);
  online = false;
  await settle();
  assert.equal(attempts, 0);
  assert.equal(timers, 0);
  connection.stop();
});
