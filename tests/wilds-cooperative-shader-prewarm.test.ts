import assert from "node:assert/strict";
import { test } from "node:test";
import { ACESFilmicToneMapping, Camera, Mesh, MeshStandardMaterial, NoToneMapping, PointLight, Scene, WebGLRenderTarget, type Object3D, type WebGLRenderer } from "three";
import * as shaders from "../src/features/play/wilds-shader-prewarm";

type Prepare = (renderer: WebGLRenderer, scene: Scene, camera: Camera, target: WebGLRenderTarget,
  signal: AbortSignal, schedule: (task: () => void) => () => void, done: () => void) => () => void;

function fixture() {
  const scene = new Scene(), camera = new Camera(), target = new WebGLRenderTarget(1, 1);
  const parent = new Mesh(undefined, new MeshStandardMaterial());
  const child = new Mesh(undefined, new MeshStandardMaterial());
  parent.add(child); scene.add(parent, new PointLight());
  const tasks: { run: () => void; cancelled: boolean }[] = [];
  const submitted: { object: Object3D; tone: number; target: WebGLRenderTarget | null }[] = [];
  const programs: { program: object }[] = [], ready = new Set<object>();
  let renderTarget: WebGLRenderTarget | null = null, completed = 0, contextLost = false;
  const controller = new AbortController();
  // Only the GPU boundary is doubled. Use actual Three scene ownership and traversal.
  const renderer = {
    extensions: { has: () => true, get: () => ({ COMPLETION_STATUS_KHR: 0x91b1 }) },
    info: { programs }, toneMapping: ACESFilmicToneMapping,
    getRenderTarget: () => renderTarget, getActiveCubeFace: () => 0, getActiveMipmapLevel: () => 0,
    setRenderTarget: (next: WebGLRenderTarget | null) => { renderTarget = next; },
    getContext: () => ({ isContextLost: () => contextLost,
      getProgramParameter: (program: object, parameter: number) => {
        assert.equal(parameter, 0x91b1); assert.ok(programs.some(entry => entry.program === program));
        return ready.has(program);
      } }),
    compile: (source: Object3D, actualCamera: Camera, targetScene: Scene) => {
      assert.equal(actualCamera, camera); assert.equal(targetScene, scene);
      source.traverse(object => {
        if (!(object instanceof Mesh)) return;
        submitted.push({ object, tone: renderer.toneMapping, target: renderTarget });
        programs.push({ program: {} });
      });
    }
  };
  const schedule = (run: () => void) => {
    const task = { run, cancelled: false }; tasks.push(task);
    return () => { task.cancelled = true; };
  };
  const next = () => { const task = tasks.shift(); assert.ok(task); if (!task.cancelled) task.run(); };
  const completeGPU = () => { for (const { program } of programs) ready.add(program); };
  const start = () => {
    const prepare = (shaders as unknown as Record<string, unknown>).prewarmWildsSceneShadersCooperatively;
    assert.equal(typeof prepare, "function", "post-HUD shader work must yield between GPU submissions");
    return (prepare as Prepare)(renderer as unknown as WebGLRenderer, scene, camera, target,
      controller.signal, schedule, () => { completed++; });
  };
  return { scene, parent, child, renderer, programs, target, tasks, submitted, controller, next, completeGPU, start,
    completed: () => completed, loseContext: () => { contextLost = true; } };
}

test("post-HUD prewarm submits one object per paint and waits for its GPU programs before the next", () => {
  const f = fixture(); f.start();
  assert.equal(f.submitted.length, 0); f.next();
  assert.deepEqual(f.submitted, [
    { object: f.parent, tone: ACESFilmicToneMapping, target: null },
    { object: f.parent, tone: NoToneMapping, target: f.target }
  ]);
  assert.equal(f.parent.parent, f.scene); assert.equal(f.child.parent, f.parent);
  assert.equal(f.renderer.getRenderTarget(), null); assert.equal(f.renderer.toneMapping, ACESFilmicToneMapping);
  f.next(); assert.equal(f.submitted.length, 2); assert.equal(f.completed(), 0);
  f.completeGPU(); f.next(); assert.equal(f.submitted.length, 4);
  assert.equal(f.submitted[2]!.object, f.child); assert.equal(f.submitted[3]!.object, f.child);
  f.completeGPU(); f.next(); assert.equal(f.completed(), 1); assert.equal(f.tasks.length, 0);
});

test("cancelled preparation cannot submit queued shaders or retain a scheduled task", () => {
  const f = fixture(); const stop = f.start(); const queued = f.tasks[0]!;
  f.controller.abort(); queued.run(); stop();
  assert.equal(queued.cancelled, true); assert.equal(f.submitted.length, 0); assert.equal(f.completed(), 0);
});

test("disposed programs and removed objects do not strand or resurrect shader preparation", () => {
  const f = fixture(); f.start(); f.next(); f.programs.splice(0); f.parent.remove(f.child);
  f.next(); assert.equal(f.submitted.length, 2); assert.equal(f.completed(), 1);
});

test("cancellation during submission cannot queue another GPU batch", () => {
  const f = fixture(); const compile = f.renderer.compile;
  f.renderer.compile = (...args) => { compile(...args); f.controller.abort(); };
  f.start(); f.next();
  assert.equal(f.submitted.length, 1); assert.equal(f.tasks.length, 0); assert.equal(f.completed(), 0);
});

test("unsupported parallel compilation leaves the normal rendering path immediate", () => {
  const f = fixture(); f.renderer.extensions.has = () => false; f.start();
  assert.equal(f.submitted.length, 0); assert.equal(f.tasks.length, 0); assert.equal(f.completed(), 1);
});

test("context loss or compilation failure leaves rendering in control with its original settings", () => {
  for (const lost of [true, false]) {
    const f = fixture(); f.start();
    if (lost) f.loseContext();
    else f.renderer.compile = () => { throw Error("optional GPU preparation unavailable"); };
    f.next(); assert.equal(f.completed(), 1); assert.equal(f.tasks.length, 0);
    assert.equal(f.renderer.getRenderTarget(), null); assert.equal(f.renderer.toneMapping, ACESFilmicToneMapping);
  }
});
