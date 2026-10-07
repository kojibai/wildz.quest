import assert from "node:assert/strict";
import { test } from "node:test";
import { Camera, Scene, type WebGLRenderer } from "three";
import * as preparation from "../src/features/play/wilds-shader-prewarm";

type Prepare = (renderer: WebGLRenderer, scene: Scene, camera: Camera,
  schedule: (task: () => void) => () => void, prepared: () => void) => () => void;
function fixture(supported = true) {
  // Only the external GPU boundary is doubled; no WebGL context exists in Node.
  const scene = new Scene(), camera = new Camera();
  const handles = [{}, {}];
  const programs = handles.map(program => ({ program }));
  const ready = new Set<object>(), queries: object[] = [];
  const tasks: { run: () => void; cancelled: boolean }[] = [];
  let submitted = 0, prepared = 0, contextLost = false;
  const renderer = {
    extensions: { has: () => supported, get: () => {
      assert.ok(supported, "unsupported extensions must not emit a renderer warning");
      return { COMPLETION_STATUS_KHR: 0x91b1 };
    } },
    info: { programs },
    getContext: () => ({
      isContextLost: () => contextLost,
      getProgramParameter: (program: object, parameter: number) => {
        assert.equal(parameter, 0x91b1, "only nonblocking completion may be queried");
        assert.ok(renderer.info.programs.some(entry => entry.program === program), "disposed programs cannot be queried");
        queries.push(program); return ready.has(program);
      }
    }),
    compile: (actualScene: Scene, actualCamera: Camera) => {
      assert.equal(actualScene, scene); assert.equal(actualCamera, camera); submitted++;
    }
  };
  const schedule = (run: () => void) => {
    const task = { run, cancelled: false }; tasks.push(task);
    return () => { task.cancelled = true; };
  };
  const runNext = () => {
    const task = tasks.shift(); assert.ok(task);
    if (!task.cancelled) task.run();
  };
  const start = () => {
    assert.ok("prepareWildsFirstDraw" in preparation, "startup must prepare shaders before the first draw");
    return (preparation.prepareWildsFirstDraw as Prepare)(renderer as unknown as WebGLRenderer,
      scene, camera, schedule, () => { prepared++; });
  };
  return { renderer, tasks, handles, ready, queries, start, runNext,
    counts: () => ({ submitted, prepared }), loseContext: () => { contextLost = true; } };
}

test("first draw waits for GPU completion without reading uniforms, drawing, or compiling extra variants", () => {
  const f = fixture(); const stop = f.start();
  assert.deepEqual(f.counts(), { submitted: 0, prepared: 0 });
  f.runNext();
  assert.deepEqual(f.counts(), { submitted: 1, prepared: 0 });
  f.ready.add(f.handles[0]!); f.runNext();
  assert.equal(f.counts().prepared, 0);
  f.ready.add(f.handles[1]!); f.runNext();
  assert.deepEqual(f.counts(), { submitted: 1, prepared: 1 });
  assert.equal(f.tasks.length, 0); stop();
});

test("browsers without parallel shader support keep their original immediate draw path", () => {
  const f = fixture(false); f.start();
  assert.deepEqual(f.counts(), { submitted: 0, prepared: 1 });
  assert.equal(f.tasks.length, 0); assert.equal(f.queries.length, 0);
});

test("unmount before submission cancels work and cannot reveal an old identity", () => {
  const f = fixture(); const stop = f.start(); const stale = f.tasks[0]!;
  stop(); stale.run();
  assert.deepEqual(f.counts(), { submitted: 0, prepared: 0 });
  assert.equal(stale.cancelled, true);
});

test("unmount while compiling cancels polling even if an already queued callback runs", () => {
  const f = fixture(); const stop = f.start(); f.runNext(); const stale = f.tasks[0]!;
  const queryCount = f.queries.length; stop(); stale.run();
  assert.equal(f.queries.length, queryCount); assert.equal(f.counts().prepared, 0);
  assert.equal(stale.cancelled, true);
});

test("materials disposed while compiling cannot leave readiness stuck or query dead programs", () => {
  const f = fixture(); f.start(); f.runNext();
  f.renderer.info.programs.splice(0); f.runNext();
  assert.equal(f.counts().prepared, 1); assert.equal(f.queries.length, 2);
});

test("optional preparation failures return control to the normal renderer", () => {
  const f = fixture(); f.renderer.compile = () => { throw new Error("driver unavailable"); };
  f.start(); f.runNext();
  assert.equal(f.counts().prepared, 1); assert.equal(f.tasks.length, 0);
});

test("context loss ends preparation instead of polling indefinitely", () => {
  const f = fixture(); f.start(); f.runNext(); f.loseContext(); f.runNext();
  assert.equal(f.counts().prepared, 1); assert.equal(f.tasks.length, 0);
});
