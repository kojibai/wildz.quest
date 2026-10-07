import assert from "node:assert/strict";
import { test } from "node:test";
import { startWildsVisibleDisplayClock } from "../src/features/play/wilds-visible-display-clock";

test("display ticks stop while hidden, catch up once on return, and never multiply timers", () => {
  let hidden = false, sequence = 0, reads = 0;
  const timers = new Map<number, () => void>();
  const clock = startWildsVisibleDisplayClock({
    hidden: () => hidden, read: () => { reads++; },
    schedule: (tick: () => void) => { const id = ++sequence; timers.set(id, tick); return id; },
    cancel: (id: number) => { timers.delete(id); }
  });
  assert.equal(reads, 1); assert.equal(timers.size, 1);
  hidden = true; clock.visibilityChanged();
  assert.equal(reads, 1); assert.equal(timers.size, 0);
  clock.visibilityChanged();
  hidden = false; clock.visibilityChanged();
  assert.equal(reads, 2, "the authoritative clock catches up elapsed sleep in one read");
  clock.visibilityChanged();
  assert.equal(reads, 2); assert.equal(timers.size, 1);
  const [id, tick] = [...timers][0]!; timers.delete(id); tick();
  assert.equal(reads, 3); assert.equal(timers.size, 1);
  const late = [...timers.values()][0]!;
  clock.dispose(); late(); clock.visibilityChanged();
  assert.equal(timers.size, 0); assert.equal(reads, 3);
});

test("mounting hidden performs no recurring display work and a hidden racing tick stays stopped", () => {
  let hidden = true, reads = 0, callback: (() => void) | null = null;
  const clock = startWildsVisibleDisplayClock({ hidden: () => hidden, read: () => { reads++; },
    schedule: tick => { callback = tick; return 1; }, cancel: () => { callback = null; } });
  assert.equal(reads, 0); assert.equal(callback, null);
  hidden = false; clock.visibilityChanged();
  assert.equal(reads, 1);
  const racing = callback as unknown as () => void;
  hidden = true; racing();
  assert.equal(reads, 1); assert.equal(callback, null);
  clock.dispose();
});
