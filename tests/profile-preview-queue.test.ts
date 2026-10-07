import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createProfilePreviewQueue } from '../src/features/profile/profile-preview-queue';

function fixture() {
  const frames = new Map<number, () => void>(); let nextId = 0;
  const queue = createProfilePreviewQueue(task => {
    const id = ++nextId; frames.set(id, task);
    return () => { frames.delete(id); };
  });
  const paint = () => { const next = frames.entries().next().value; if (next) { frames.delete(next[0]); next[1](); } };
  return { queue, frames, paint };
}

// Catch a visible-card batch executing in the opening input commit or a single following frame.
test('visible profile card details are queued one per rendering opportunity', () => {
  const { queue, frames, paint } = fixture(), rendered: number[] = [];
  for (let i = 0; i < 34; i++) queue.enqueue(() => rendered.push(i));
  assert.deepEqual(rendered, []);
  assert.equal(frames.size, 1);
  paint(); assert.deepEqual(rendered, [0]); assert.equal(frames.size, 1);
  paint(); assert.deepEqual(rendered, [0, 1]);
  for (let i = 2; i < 34; i++) paint();
  assert.deepEqual(rendered, Array.from({ length: 34 }, (_, i) => i));
  assert.equal(frames.size, 0);
});

// Catch hidden/closed profile tiles doing deferred genome and DOM work after dismissal.
test('closing the profile cancels every queued preview before further card work', () => {
  const { queue, frames, paint } = fixture(); let renders = 0;
  const cancellations = Array.from({ length: 34 }, () => queue.enqueue(() => renders++));
  paint(); assert.equal(renders, 1);
  for (const cancel of cancellations) cancel();
  assert.equal(frames.size, 0);
  paint(); assert.equal(renders, 1);
  queue.enqueue(() => renders++); paint();
  assert.equal(renders, 2, 'reopening can resume useful visible detail work');
});

// Catch removal of one card accidentally canceling other still-visible work.
test('canceling an offscreen preview preserves the next visible card task', () => {
  const { queue, paint } = fixture(), rendered: string[] = [];
  const cancel = queue.enqueue(() => rendered.push('hidden'));
  queue.enqueue(() => rendered.push('visible'));
  cancel(); cancel(); paint();
  assert.deepEqual(rendered, ['visible']);
});
