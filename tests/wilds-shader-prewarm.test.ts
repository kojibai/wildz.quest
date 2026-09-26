import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ACESFilmicToneMapping, Camera, DoubleSide, LinearSRGBColorSpace, Mesh, MeshStandardMaterial, NoToneMapping, PointLight, Scene, Texture, WebGLRenderTarget } from "three";
import { prewarmWildsSceneShaders, wildsSceneShaderSignature } from "../src/features/play/wilds-shader-prewarm";

function fixture() {
  const original = new WebGLRenderTarget(2, 2);
  const transmission = new WebGLRenderTarget(1, 1);
  let target: WebGLRenderTarget | null = original;
  const calls: { target: WebGLRenderTarget | null; tone: number }[] = [];
  const restored: unknown[][] = [];
  const renderer = {
    extensions: { has: () => true },
    toneMapping: ACESFilmicToneMapping,
    getRenderTarget: () => target,
    getActiveCubeFace: () => 3,
    getActiveMipmapLevel: () => 2,
    setRenderTarget: (next: WebGLRenderTarget | null, ...rest: number[]) => { target = next; restored.push([next, ...rest]); },
    compile: () => { calls.push({ target, tone: renderer.toneMapping }); return new Set(); }
  } as unknown as Parameters<typeof prewarmWildsSceneShaders>[0];
  return { original, transmission, renderer, calls, restored, scene: new Scene(), camera: new Camera(), controller: new AbortController() };
}

describe("background shader link preparation", () => {
  it("queues both variants without a draw or wait and restores renderer state synchronously", () => {
    const f = fixture();
    assert.equal(prewarmWildsSceneShaders(f.renderer, f.scene, f.camera, f.transmission, f.controller.signal), undefined);
    assert.deepEqual(f.calls, [{ target: f.original, tone: ACESFilmicToneMapping }, { target: f.transmission, tone: NoToneMapping }]);
    assert.equal(f.transmission.texture.colorSpace, LinearSRGBColorSpace);
    assert.equal(f.renderer.getRenderTarget(), f.original);
    assert.equal(f.renderer.toneMapping, ACESFilmicToneMapping);
    assert.deepEqual(f.restored.at(-1), [f.original, 3, 2]);
  });
  it("restores target and tone when variant submission throws", () => {
    const f = fixture();
    f.renderer.compile = () => { if (f.renderer.getRenderTarget() === f.transmission) throw new Error("compile failed"); return new Set(); };
    assert.throws(() => prewarmWildsSceneShaders(f.renderer, f.scene, f.camera, f.transmission, f.controller.signal), /compile failed/);
    assert.equal(f.renderer.getRenderTarget(), f.original);
    assert.equal(f.renderer.toneMapping, ACESFilmicToneMapping);
  });
  it("does no work when cancelled or parallel compilation is unavailable", () => {
    for (const cancelled of [false, true]) {
      const f = fixture();
      if (cancelled) f.controller.abort();
      else f.renderer.extensions.has = () => false;
      prewarmWildsSceneShaders(f.renderer, f.scene, f.camera, f.transmission, f.controller.signal);
      assert.equal(f.calls.length, 0);
      assert.equal(f.restored.length, 0);
    }
  });
  it("does not submit a second variant after cancellation", () => {
    const f = fixture();
    f.renderer.compile = () => { f.controller.abort(); return new Set(); };
    prewarmWildsSceneShaders(f.renderer, f.scene, f.camera, f.transmission, f.controller.signal);
    assert.equal(f.restored.length, 0);
  });
  it("ignores animated uniforms and compile-driven material versions but detects new light topology", () => {
    const scene = new Scene(), material = new MeshStandardMaterial({ transparent: true, side: DoubleSide });
    const mesh = new Mesh(undefined, material), light = new PointLight();
    scene.add(mesh, light);
    const initial = wildsSceneShaderSignature(scene);
    material.needsUpdate = true; material.color.set("red"); mesh.position.x = 10; light.intensity = 0;
    assert.equal(wildsSceneShaderSignature(scene), initial);
    material.map = new Texture();
    assert.notEqual(wildsSceneShaderSignature(scene), initial);
    material.map.dispose(); material.map = null;
    light.visible = false;
    assert.notEqual(wildsSceneShaderSignature(scene), initial);
    light.visible = true;
    assert.equal(wildsSceneShaderSignature(scene), initial);
    scene.add(new PointLight());
    assert.notEqual(wildsSceneShaderSignature(scene), initial);
    mesh.geometry.dispose(); material.dispose();
  });
});

it("submits the initial shader batch after scene commit and before the first draw", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile("src/features/play/WildsShaderPrewarm.tsx", "utf8");
  assert.match(source, /useLayoutEffect\(\(\) =>/);
  const layout = source.slice(source.indexOf("useLayoutEffect(() =>"));
  assert.ok(layout.indexOf("prewarmWildsSceneShaders(gl, scene, camera, target, controller.signal)")
    < layout.indexOf("const schedule ="), "initial linking must start before deferred maintenance");
  assert.doesNotMatch(source, /compileAsync|gl\.render\(/);
});
