import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createLatestOnlySaveScheduler } from "../src/lib/receiz/wildz-save-scheduler";

type FakeTimer = { active: boolean; callback: () => void };

function fakeClock() {
  const timers: FakeTimer[] = [];
  return {
    setTimer(callback: () => void) {
      const timer = { active: true, callback };
      timers.push(timer);
      return timer;
    },
    clearTimer(timer: FakeTimer) {
      timer.active = false;
    },
    activeTimerCount() {
      return timers.filter((timer) => timer.active).length;
    },
    timerCount() {
      return timers.length;
    },
    runLatest() {
      let timer: FakeTimer | undefined;
      for (let index = timers.length - 1; index >= 0; index -= 1) {
        if (timers[index]?.active) {
          timer = timers[index];
          break;
        }
      }
      assert.ok(timer, "expected a scheduled trailing save");
      timer.active = false;
      timer.callback();
    }
  };
}

test("one hundred movement updates persist only the latest full Vault state", async () => {
  const clock = fakeClock();
  const writes: number[] = [];
  const scheduler = createLatestOnlySaveScheduler<number, FakeTimer>({
    delayMs: 400,
    write: async (value: number) => { writes.push(value); },
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer
  });

  for (let update = 1; update <= 100; update += 1) scheduler.schedule(update);
  assert.deepEqual(writes, []);
  assert.equal(clock.activeTimerCount(), 1);
  assert.equal(clock.timerCount(), 1, "movement bursts must not cancel and recreate a timer for every input");

  clock.runLatest();
  await scheduler.flush();
  assert.deepEqual(writes, [100]);
});

test("updates arriving during a save collapse to one latest trailing write", async () => {
  const clock = fakeClock();
  const writes: number[] = [];
  let releaseFirst!: () => void;
  const firstWrite = new Promise<void>((resolve) => { releaseFirst = resolve; });
  const scheduler = createLatestOnlySaveScheduler<number, FakeTimer>({
    delayMs: 400,
    write: async (value: number) => {
      writes.push(value);
      if (value === 1) await firstWrite;
    },
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer
  });

  scheduler.schedule(1);
  clock.runLatest();
  await Promise.resolve();
  scheduler.schedule(2);
  scheduler.schedule(3);
  clock.runLatest();
  releaseFirst();
  await scheduler.flush();

  assert.deepEqual(writes, [1, 3]);
});

test("a rejected write retains the latest snapshot for a later flush", async () => {
  const clock = fakeClock();
  const writes: number[] = [];
  let attempts = 0;
  const scheduler = createLatestOnlySaveScheduler<number, FakeTimer>({
    delayMs: 400,
    write: async (value: number) => {
      writes.push(value);
      attempts += 1;
      if (attempts === 1) throw new Error("indexed_db_temporarily_unavailable");
    },
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer
  });

  scheduler.schedule(98);
  clock.runLatest();
  await assert.rejects(scheduler.flush(), /indexed_db_temporarily_unavailable/);
  assert.equal(scheduler.hasPending(), true);

  await scheduler.flush();
  assert.deepEqual(writes, [98, 98]);
  assert.equal(scheduler.hasPending(), false);
});

test("a newer snapshot supersedes a failed in-flight snapshot", async () => {
  const clock = fakeClock();
  const writes: number[] = [];
  let rejectFirst!: (error: Error) => void;
  const firstWrite = new Promise<void>((_resolve, reject) => { rejectFirst = reject; });
  const scheduler = createLatestOnlySaveScheduler<number, FakeTimer>({
    delayMs: 400,
    write: async (value: number) => {
      writes.push(value);
      if (value === 1) await firstWrite;
    },
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer
  });

  scheduler.schedule(1);
  clock.runLatest();
  await Promise.resolve();
  scheduler.schedule(2);
  rejectFirst(new Error("first_snapshot_failed"));
  await assert.rejects(scheduler.flush(), /first_snapshot_failed/);
  await scheduler.flush();

  assert.deepEqual(writes, [1, 2]);
  assert.equal(scheduler.hasPending(), false);
});

test("card truth stays queued for durable Vault persistence while movement uses runtime checkpoints", () => {
  const shell = readFileSync("src/features/shell/WildzApp.tsx", "utf8");
  assert.match(shell, /previousCardPins/);
  assert.match(shell, /nextCardPins/);
  assert.match(shell, /if \(cardTruthChanged\) vaultSavePendingRef\.current = true/);
  assert.match(shell, /kind: vaultSavePendingRef\.current \? "vault" : "runtime"/);
  assert.doesNotMatch(shell, /if \(cardTruthChanged\) void scheduler\?\.flush\(\)/);
});
