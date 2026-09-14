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
