import assert from 'node:assert/strict';
import { test } from 'node:test';
import { creationBuildGesture, createCreationBuildGesture } from '../src/features/play/creation/build-gesture';
test('Build opens from a tap or companion-sized upward swipe',()=>{const origin={x:100,y:200};assert.equal(creationBuildGesture(origin,{x:103,y:203}),'open');assert.equal(creationBuildGesture(origin,{x:104,y:140}),'open');assert.equal(creationBuildGesture(origin,{x:170,y:190}),'cancel');assert.equal(creationBuildGesture(origin,{x:104,y:270}),'cancel');assert.equal(creationBuildGesture(origin,{x:103,y:185}),'cancel');});

test('interrupted pill gestures cannot eat or open from a residual pointer click', () => {
  const gesture = createCreationBuildGesture();
  gesture.start(1, { x: 100, y: 200 }, 0);
  gesture.cancel();
  assert.equal(gesture.release(1, { x: 100, y: 200 }), null);
  assert.equal(gesture.click(1), null);
  assert.equal(gesture.click(1), null);
  assert.ok(gesture.start(2, { x: 100, y: 200 }, 0));
  assert.equal(gesture.release(2, { x: 100, y: 200 }), 'tap');
  assert.equal(gesture.click(1), null, 'Native click after pointerup must not eat twice');
});
test('food taps and upward swipes remain separate actions and keyboard use remains available', () => {
  const gesture = createCreationBuildGesture();
  gesture.start(1, { x: 100, y: 200 }, 0);
  assert.equal(gesture.release(1, { x: 103, y: 204 }), 'tap');
  gesture.start(2, { x: 100, y: 200 }, 0);
  assert.equal(gesture.release(2, { x: 104, y: 140 }), 'swipe');
  assert.equal(gesture.click(1), null);
  gesture.start(3, { x: 100, y: 200 }, 0);
  assert.equal(gesture.release(3, { x: 165, y: 200 }), null);
  assert.equal(gesture.click(1), null);
  gesture.start(4, { x: 100, y: 200 }, 0);
  gesture.lostCapture();
  assert.equal(gesture.release(4, { x: 100, y: 200 }), null);
  assert.equal(gesture.click(1), null);
  assert.equal(gesture.click(0), 'tap');
});
test('a second pointer cannot eat while the first pointer owns the food gesture', () => {
  const gesture = createCreationBuildGesture();
  assert.ok(gesture.start(1, { x: 100, y: 200 }, 0));
  assert.equal(gesture.start(2, { x: 100, y: 200 }, 0), false);
  assert.equal(gesture.release(2, { x: 100, y: 200 }), null);
  assert.equal(gesture.click(1), null);
  assert.equal(gesture.release(1, { x: 100, y: 200 }), 'tap');
});

test('food selection swipes never become eating taps or change the default Build gesture', () => {
  const gesture = createCreationBuildGesture();
  for (const [dx, expected] of [[-60, 'left'], [60, 'right']] as const) {
    gesture.start(1, { x: 100, y: 200 }, 0);
    assert.equal(gesture.release(1, { x: 100 + dx, y: 204 }, true), expected);
    assert.equal(gesture.click(1), null);
  }
  gesture.start(1, { x: 100, y: 200 }, 0);
  assert.equal(gesture.release(1, { x: 160, y: 204 }), null);
  gesture.start(1, { x: 100, y: 200 }, 0);
  assert.equal(gesture.release(1, { x: 118, y: 204 }, true), null);
  gesture.start(1, { x: 354, y: 456 }, 0);
  assert.equal(gesture.release(1, { x: 388, y: 456 }, true), 'right', 'A thumb swipe must fit before the phone edge');
  gesture.start(1, { x: 100, y: 200 }, 0);
  gesture.cancel();
  assert.equal(gesture.release(1, { x: 160, y: 204 }, true), null);
});
