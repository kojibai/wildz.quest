import { LinearSRGBColorSpace, NoToneMapping, type Camera, type Scene, type WebGLRenderer, type WebGLRenderTarget } from "three";

type PrewarmRenderer = Pick<WebGLRenderer, "extensions" | "compile" | "getRenderTarget" | "getActiveCubeFace" | "getActiveMipmapLevel" | "setRenderTarget" | "toneMapping">;

/** Prepare only the initial display programs, between paints. Poll native GPU
 * completion without reflecting uniforms or reading mutable material state.
 * The normal renderer still owns the first full draw and world readiness. */
export function prepareWildsFirstDraw(
  renderer: Pick<WebGLRenderer, "extensions" | "compile" | "getContext" | "info">,
  scene: Scene,
  camera: Camera,
  schedule: (task: () => void) => () => void,
  onPrepared: () => void
): () => void {
  let cancelled = false, finished = false;
  let cancelScheduled: (() => void) | undefined;
  let pending: WebGLProgram[] = [];
  const finish = () => {
    if (cancelled || finished) return;
    finished = true;
    pending = [];
    onPrepared();
  };
  const stop = () => { cancelled = true; cancelScheduled?.(); pending = []; };
  try {
    if (!renderer.extensions.has("KHR_parallel_shader_compile")) { finish(); return stop; }
    const extension = renderer.extensions.get("KHR_parallel_shader_compile") as KHR_parallel_shader_compile | null;
    if (!extension) { finish(); return stop; }
    const context = renderer.getContext();
    const check = () => {
      cancelScheduled = undefined;
      if (cancelled || finished) return;
      try {
        if (context.isContextLost()) { finish(); return; }
        const live = new Set(renderer.info.programs?.map(program => program.program));
        pending = pending.filter(program => live.has(program)
          && !context.getProgramParameter(program, extension.COMPLETION_STATUS_KHR));
        if (pending.length === 0) finish();
        else cancelScheduled = schedule(check);
      } catch { finish(); }
    };
    cancelScheduled = schedule(() => {
      cancelScheduled = undefined;
      if (cancelled) return;
      try {
        if (context.isContextLost()) { finish(); return; }
        renderer.compile(scene, camera);
        pending = (renderer.info.programs ?? []).map(program => program.program as WebGLProgram).filter(Boolean);
        check();
      } catch { finish(); }
    });
  } catch { finish(); }
  return stop;
}

/** Three r182 compile() queues getProgram/acquireProgram without reflecting
 * uniforms. With KHR_parallel_shader_compile this submits linking ahead of use;
 * compileAsync adds material polling that races with streamed material disposal.
 * Never draw, reflect uniforms, poll completion, or use an extension fallback. */
export function prewarmWildsSceneShaders(
  renderer: PrewarmRenderer,
  scene: Scene,
  camera: Camera,
  transmissionTarget: WebGLRenderTarget,
  signal: AbortSignal
): void {
  if (signal.aborted || !renderer.extensions.has("KHR_parallel_shader_compile")) return;
  renderer.compile(scene, camera);
  if (signal.aborted) return;

  // Three's transmission pass draws opaque materials into linear working color
  // space with tone mapping disabled. Compile that same variant without a draw.
  const target = renderer.getRenderTarget();
  const cubeFace = renderer.getActiveCubeFace();
  const mipLevel = renderer.getActiveMipmapLevel();
  const toneMapping = renderer.toneMapping;
  try {
    transmissionTarget.texture.colorSpace = LinearSRGBColorSpace;
    renderer.setRenderTarget(transmissionTarget);
    renderer.toneMapping = NoToneMapping;
    renderer.compile(scene, camera);
  } finally {
    renderer.toneMapping = toneMapping;
    renderer.setRenderTarget(target, cubeFace, mipLevel);
  }
}

/** Changes that can introduce a new program. Excludes animated transforms,
 * colors/intensities, and uniform-only clock updates. */
export function wildsSceneShaderSignature(scene: Scene): string {
  // Two independent 32-bit streams keep the retained signature small. Visit
  // existing values directly: no per-mesh arrays, strings, or joined buffers.
  let first = 0x811c9dc5, second = 0x9e3779b9, count = 0;
  const numberBits = new DataView(new ArrayBuffer(8));
  const word = (value: number) => {
    first = Math.imul(first ^ value, 0x01000193);
    second = Math.imul(second ^ value, 0x85ebca6b);
    second = (second << 13) | (second >>> 19);
  };
  const text = (value: string) => {
    word(value.length);
    for (let index = 0; index < value.length; index++) word(value.charCodeAt(index));
  };
  const materialEntry = (material: import("three").Material, objectFlags: number) => {
    const surface = material as import("three").MeshPhysicalMaterial;
    count++;
    word(1);
    text(material.uuid);
    text(material.type);
    word(material.side);
    word(objectFlags | (+material.transparent << 2) | (+material.depthWrite << 3)
      | (+material.toneMapped << 4) | (+!!surface.transmission << 5) | (+!!surface.clearcoat << 6));
    numberBits.setFloat64(0, material.alphaTest);
    word(numberBits.getUint32(0));
    word(numberBits.getUint32(4));
    // Material version is deliberately excluded: compile() itself changes it
    // for double-sided transparent passes. Texture IDs catch late maps.
    word(surface.map?.id ?? -1);
    word(surface.normalMap?.id ?? -1);
    word(surface.alphaMap?.id ?? -1);
  };
  scene.traverse(object => {
    const mesh = object as typeof object & {
      material?: import("three").Material | import("three").Material[];
      isInstancedMesh?: boolean;
      isSkinnedMesh?: boolean;
    };
    if (!mesh.material) return;
    const objectFlags = +!!mesh.isInstancedMesh | (+!!mesh.isSkinnedMesh << 1);
    if (Array.isArray(mesh.material)) {
      for (const material of mesh.material) materialEntry(material, objectFlags);
    } else materialEntry(mesh.material, objectFlags);
  });
  scene.traverseVisible(object => {
    const light = object as import("three").Light;
    if (!light.isLight) return;
    count++;
    word(2);
    text(light.type);
    word(+light.castShadow);
    word(light.layers.mask);
  });
  return `${first >>> 0}:${second >>> 0}:${count}`;
}
