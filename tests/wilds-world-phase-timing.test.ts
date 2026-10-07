import assert from 'node:assert/strict';
import { test } from 'node:test';
import { listenWildsPlaytestEvents } from '../src/features/play/wilds-playtest-events';
import { createWildsPlaytestRecording, exportWildsPlaytest, markWildsPlaytest } from '../src/features/play/wilds-playtest';

test('overlapping local world phases retain their own durations and no command payload', () => {
  const recording = createWildsPlaytestRecording(0), target = new EventTarget();
  const stop = listenWildsPlaytestEvents(target, (action, outcome, durationMs) => markWildsPlaytest(recording, action, outcome, 100, durationMs));
  for (const durationMs of [80, 25]) target.dispatchEvent(new CustomEvent('wildz:local-playtest-mark:v1', {
    detail: { action: 'world-worker', outcome: 'success', durationMs, actorId: 'must-not-record', projection: { secret: true } }
  }));
  stop();
  assert.deepEqual(recording.events.map(event => event.durationMs), [80, 25]);
  assert.equal(JSON.stringify(exportWildsPlaytest(recording, false)).includes('must-not-record'), false);
  assert.deepEqual(exportWildsPlaytest(recording, false).actionTimings[0], { action: 'world-worker', completed: 2, failures: 0, p95Ms: 80, worstMs: 80 });
});

test('local phase timing rejects invalid durations and phases that began before recording', () => {
  const recording = createWildsPlaytestRecording(100), target = new EventTarget();
  const stop = listenWildsPlaytestEvents(target, (action, outcome, durationMs) => markWildsPlaytest(recording, action, outcome, 200, durationMs));
  for (const durationMs of [-1, Infinity, 'secret', 101]) target.dispatchEvent(new CustomEvent('wildz:local-playtest-mark:v1', { detail: { action: 'world-prewarm', outcome: 'success', durationMs } }));
  assert.deepEqual(recording.events, []);
  stop();
});
