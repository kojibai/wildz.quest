import assert from "node:assert/strict";
import { test } from "node:test";
import { createWildsCrewBattleRecallQueue } from "../src/features/play/wilds-crew-battle-recall";
const flush = () => new Promise<void>(resolve => setImmediate(resolve));
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
function fixture() {
  let scope = "owner-a";
  const stored = new Set<string>(), writes: Array<[string, string, boolean]> = [], errors: unknown[] = [];
  let action: (id: string) => Promise<boolean> = async () => true, calls = 0;
  const queue = createWildsCrewBattleRecallQueue({ readScope: () => scope,
    readPending: id => stored.has(`${scope}:${id}`),
    writePending: (id, value) => { writes.push([scope, id, value]); if (value) stored.add(`${scope}:${id}`); else stored.delete(`${scope}:${id}`); },
    recall: id => { calls++; return action(id); }, onError: error => { errors.push(error); } });
  return { queue, stored, writes, errors, calls: () => calls, scope: (value: string) => { scope = value; }, action: (value: typeof action) => { action = value; } };
}

test("battle-held return does not execute early; repeated release runs one recall and clears only after success", async () => {
  const f = fixture(), result = deferred<boolean>(); f.action(() => result.promise);
  f.queue.request("creature"); assert.equal(f.calls(), 0); assert.ok(f.stored.has("owner-a:creature"));
  f.queue.resume("creature"); f.queue.resume("creature"); await flush();
  assert.equal(f.calls(), 1); assert.ok(f.stored.has("owner-a:creature"));
  result.resolve(true); await flush(); assert.equal(f.stored.size, 0);
  f.queue.resume("creature"); await flush(); assert.equal(f.calls(), 1);
});

test("false or failed recall retains the requested return for the next release", async () => {
  const f = fixture(); f.queue.request("creature"); f.action(async () => false);
  f.queue.resume("creature"); await flush(); assert.ok(f.stored.has("owner-a:creature"));
  f.action(async () => { throw new Error("IDB unavailable"); }); f.queue.resume("creature"); await flush();
  assert.ok(f.stored.has("owner-a:creature")); assert.equal(f.errors.length, 1);
  f.action(async () => true); f.queue.resume("creature"); await flush();
  assert.equal(f.stored.size, 0); assert.equal(f.calls(), 3);
});

test("a reloaded queue resumes the persisted request without another Return click", async () => {
  const f = fixture(); f.stored.add("owner-a:creature");
  f.queue.resume("creature"); await flush(); assert.equal(f.calls(), 1); assert.equal(f.stored.size, 0);
});

test("old owner completion cannot erase a new owner's queued return or report its errors", async () => {
  const f = fixture(), old = deferred<boolean>(); f.action(() => old.promise);
  f.queue.request("creature"); f.queue.resume("creature"); await flush();
  f.scope("owner-b"); f.queue.request("creature"); old.resolve(true); await flush();
  assert.ok(f.stored.has("owner-a:creature")); assert.ok(f.stored.has("owner-b:creature"));
  assert.equal(f.writes.filter(([, , value]) => !value).length, 0);
  f.action(async () => true); f.queue.resume("creature"); await flush();
  assert.ok(f.stored.has("owner-a:creature")); assert.equal(f.stored.has("owner-b:creature"), false);
});

test("scope change before queued microtask and disposal prevent stale recall", async () => {
  const f = fixture(); f.queue.request("creature"); f.queue.resume("creature"); f.scope("owner-b"); await flush();
  assert.equal(f.calls(), 0);
  f.scope("owner-a"); f.queue.resume("creature"); f.queue.dispose(); await flush(); assert.equal(f.calls(), 0);
  assert.ok(f.stored.has("owner-a:creature"));
});

test("storage write error preserves in-memory return intent until recall succeeds", async () => {
  let calls = 0, storageWorks = false; const errors: unknown[] = [];
  const queue = createWildsCrewBattleRecallQueue({ readScope: () => "owner", readPending: () => false,
    writePending: () => { if (!storageWorks) throw new Error("storage unavailable"); },
    recall: async () => { calls++; return true; }, onError: error => { errors.push(error); } });
  queue.request("creature"); queue.resume("creature"); await flush(); assert.equal(calls, 1); assert.equal(errors.length, 2);
  storageWorks = true; queue.resume("creature"); await flush(); assert.equal(calls, 2);
  queue.resume("creature"); await flush(); assert.equal(calls, 2);
});
