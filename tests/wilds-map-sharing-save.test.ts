import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";
import { mountPanelComponent, panelElements } from "./support/panel-component-harness";
import type { WildsExplorationAtlas } from "../src/features/play/wilds-exploration-atlas";

/** Keep the component, shared coordinator and native save rail real. Replace only
 * the costly map raster and device sealer boundaries, with distinguishable bytes. */
test("explicit Map Save retains the requested atlas while later discovery warmup is queued", async () => {
  const portKey = Symbol.for("wildz.test.map-save-pressure");
  const globals = globalThis as typeof globalThis & { [portKey]?: unknown };
  let release!: () => void, started!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const firstStarted = new Promise<void>(resolve => { started = resolve; });
  const built: string[] = [];
  globals[portKey] = {
    render: async (atlas: WildsExplorationAtlas) => {
      const label = atlas.siteKeys[0]!; built.push(label);
      if (label === "old") { started(); await gate; }
      return new Blob([label], { type: "image/png" });
    },
    seal: async ({ bytes, filename }: { bytes: Uint8Array; filename: string }) => ({ bytes, filename, mimeType: "image/png", blob: new Blob([bytes.slice().buffer], { type: "image/png" }) })
  };
  const hook = registerHooks({ resolve(specifier, context, nextResolve) {
    const source = specifier.endsWith("/wilds-map-image-render.js")
      ? 'export const renderWildsMapImage = (...args) => globalThis[Symbol.for("wildz.test.map-save-pressure")].render(...args);'
      : specifier.endsWith("/wildz-game-image-export.js")
        ? 'export const prepareWildzGameImage = (...args) => globalThis[Symbol.for("wildz.test.map-save-pressure")].seal(...args);' : null;
    return source ? { url: `data:text/javascript,${encodeURIComponent(source)}`, shortCircuit: true } : nextResolve(specifier, context);
  } });
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window"), navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  let id = 0;
  const frames = new Map<number, FrameRequestCallback>(), tasks = new Map<number, () => void>();
  const files: File[] = [];
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    requestAnimationFrame(callback: FrameRequestCallback) { frames.set(++id, callback); return id; },
    cancelAnimationFrame: (handle: number) => frames.delete(handle),
    setTimeout(callback: () => void) { tasks.set(++id, callback); return id; },
    clearTimeout: (handle: number) => tasks.delete(handle)
  } });
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { canShare: () => true, share: async (data: ShareData) => { files.push(...data.files ?? []); } } });
  const paint = () => { const work = [...frames.values()]; frames.clear(); work.forEach(callback => callback(0)); const later = [...tasks.values()]; tasks.clear(); later.forEach(callback => callback()); };
  const { WildsMapSharing } = await import("../src/features/play/WildsMapSharing");
  const panel = mountPanelComponent(WildsMapSharing);
  const atlas = (label: string): WildsExplorationAtlas => ({ version: 1, rows: [], siteKeys: [label] });
  const onImport = () => {};
  try {
    panel.render({ atlas: atlas("old"), onImport }); panel.flushEffects(); paint(); await firstStarted;
    const requested = atlas("requested");
    const tree = panel.render({ atlas: requested, onImport }); panel.flushEffects();
    const save = panelElements(tree).find(element => element.type === "button" && element.props["aria-label"] === "Save map image");
    assert.ok(save); (save.props.onClick as () => void)();
    panel.render({ atlas: atlas("new discovery"), onImport }); panel.flushEffects(); paint();
    release();
    for (let turn = 0; turn < 8; turn++) await new Promise(resolve => setImmediate(resolve));
    assert.equal(files.length, 1, "the explicit requested Map Save must reach device sharing");
    assert.equal(await files[0]!.text(), "requested");
    assert.deepEqual(built, ["old", "requested", "new discovery"]);
  } finally {
    release(); panel.unmount(); hook.deregister(); delete globals[portKey];
    if (windowDescriptor) Object.defineProperty(globalThis, "window", windowDescriptor); else Reflect.deleteProperty(globalThis, "window");
    if (navigatorDescriptor) Object.defineProperty(globalThis, "navigator", navigatorDescriptor); else Reflect.deleteProperty(globalThis, "navigator");
  }
});
