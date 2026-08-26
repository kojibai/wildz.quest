import assert from "node:assert/strict";
import test from "node:test";
import { createWildzGameplayPublisher } from "../src/lib/performance/wildz-gameplay-publisher";

type FakeTimer = { active: boolean; callback: () => void };

function fakeClock() {
  const timers: FakeTimer[] = [];
  return {
    setTimer(callback: () => void) {
      const timer = { active: true, callback };
      timers.push(timer);
      return timer;
    },
    clearTimer(timer: FakeTimer) { timer.active = false; },
    run() {
      const timer = timers.find((candidate) => candidate.active);
      assert.ok(timer);
      timer.active = false;
      timer.callback();
    }
  };
}

test("continuous locomotion publishes only the latest authoritative state per cadence", async () => {
  const clock = fakeClock();
  const published: number[] = [];
  const publisher = createWildzGameplayPublisher<number, FakeTimer>({
    publish(value) { published.push(value); },
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer
  });

  for (let position = 1; position <= 100; position += 1) publisher.schedule(position, false);
  assert.deepEqual(published, []);

  clock.run();
  await publisher.flush();
  assert.deepEqual(published, [100]);
});

test("identity and constructed-world truth bypasses locomotion cadence", async () => {
  const clock = fakeClock();
  const published: number[] = [];
  const publisher = createWildzGameplayPublisher<number, FakeTimer>({
    publish(value) { published.push(value); },
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer
  });

  publisher.schedule(1, false);
  publisher.schedule(2, true);
  await publisher.flush();

  assert.deepEqual(published, [2]);
});
