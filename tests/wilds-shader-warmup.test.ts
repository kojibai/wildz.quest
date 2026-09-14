import assert from "node:assert/strict";
import { test } from "node:test";
import { createWildsShaderWarmup } from "../src/features/play/wilds-shader-warmup";
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

test("first draw waits asynchronously for compilation; normal frames never compile again", async () => {
  let finish!: () => void, compiles = 0, draws = 0, invalidations = 0;
  const warmup = createWildsShaderWarmup(() => { compiles++; return new Promise<void>(resolve => { finish = resolve; }); }, () => invalidations++);
  const draw = () => draws++;
  for (let i = 0; i < 100; i++) warmup.frame(draw);
  await flush();
  assert.equal(compiles, 1); assert.equal(draws, 0);
  finish(); await flush();
  for (let i = 0; i < 100; i++) warmup.frame(draw);
  assert.equal(compiles, 1); assert.equal(draws, 100); assert.equal(invalidations, 1);
});
test("restored contexts ignore old compilation completion and prepare their own programs", async () => {
  const pending: (() => void)[] = []; let draws = 0, invalidations = 0;
  const warmup = createWildsShaderWarmup(() => new Promise<void>(resolve => pending.push(resolve)), () => invalidations++);
  warmup.frame(() => draws++); await flush(); warmup.reset();
  warmup.frame(() => draws++); await flush();
  pending[0]!(); await flush(); warmup.frame(() => draws++);
  assert.equal(draws, 0); assert.equal(invalidations, 0);
  pending[1]!(); await flush(); warmup.frame(() => draws++);
  assert.equal(draws, 1); assert.equal(invalidations, 1);
});
test("compile failure releases the normal renderer rather than leaving a permanently blank canvas", async () => {
  let draws = 0;
  const warmup = createWildsShaderWarmup(() => { throw new Error("driver"); }, () => {});
  warmup.frame(() => draws++); await flush(); warmup.frame(() => draws++);
  assert.equal(draws, 1);
});
