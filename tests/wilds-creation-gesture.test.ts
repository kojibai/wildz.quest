import assert from 'node:assert/strict';
import { test } from 'node:test';
import { creationBuildGesture } from '../src/features/play/creation/build-gesture';
test('Build opens from a tap or companion-sized upward swipe',()=>{const origin={x:100,y:200};assert.equal(creationBuildGesture(origin,{x:103,y:203}),'open');assert.equal(creationBuildGesture(origin,{x:104,y:140}),'open');assert.equal(creationBuildGesture(origin,{x:170,y:190}),'cancel');assert.equal(creationBuildGesture(origin,{x:104,y:270}),'cancel');assert.equal(creationBuildGesture(origin,{x:103,y:185}),'cancel');});
