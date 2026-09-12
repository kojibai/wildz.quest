import assert from "node:assert/strict";
import { test } from "node:test";
import { createWildsWorldRefreshCoordinator } from "../src/features/play/wilds-world-refresh-coordinator";

test("refresh bursts share a running request and drain one latest follow-up", async () => {
  const queue = createWildsWorldRefreshCoordinator();
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const calls: string[] = [];
  const first = queue.run(async () => { calls.push("first"); await gate; });
  await Promise.resolve();
  const second = queue.run(async () => { calls.push("obsolete"); });
  const third = queue.run(async () => { calls.push("latest"); });
  assert.equal(first, second);
  assert.equal(second, third);
  release();
  await first;
  assert.deepEqual(calls, ["first", "latest"]);
});

test("a failed refresh does not discard a queued newer request or poison later runs", async () => {
  const queue = createWildsWorldRefreshCoordinator();
  let reject!: (error: Error) => void;
  const first = queue.run(() => new Promise<void>((_, fail) => { reject = fail; }));
  await Promise.resolve();
  let recovered = false;
  queue.run(async () => { recovered = true; });
  reject(new Error("offline"));
  await first;
  assert.ok(recovered);
  await assert.rejects(queue.run(async () => { throw new Error("failed"); }), /failed/);
  await queue.run(async () => undefined);
});

test("cleanup cancels the queued follow-up without interrupting an active request", async () => {
  const queue = createWildsWorldRefreshCoordinator();
  let release!: () => void;
  let followed = false;
  const first = queue.run(() => new Promise<void>(resolve => { release = resolve; }));
  await Promise.resolve();
  queue.run(async () => { followed = true; });
  queue.cancelPending();
  release();
  await first;
  assert.equal(followed, false);
  await queue.run(async () => { followed = true; });
  assert.ok(followed);
});
