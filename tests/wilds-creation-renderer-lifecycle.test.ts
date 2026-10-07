import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';
import * as jsxRuntime from 'react/jsx-runtime';
import * as renderGeometry from '../src/features/play/creation/render-geometry';
import * as materialLibrary from '../src/features/play/creation/material-library';
import * as sceneRuntime from '../src/features/play/creation/scene-runtime';
import * as preview from '../src/features/play/creation/preview';
import * as residency from '../src/features/play/creation/residency';
import { wildsQualityProfileForTier } from '../src/features/play/wilds-quality-profile';

test('mounting the creation renderer schedules its first scene refresh with a valid browser receiver', () => {
  const effects: (() => (() => void) | void)[] = [], deferred: (() => void)[] = [];
  let runtime: ReturnType<typeof sceneRuntime.createCreationSceneRuntime> | null = null;
  const react = {
    memo: (component: unknown) => component,
    useMemo: (factory: () => unknown) => factory(),
    useCallback: (callback: unknown) => callback,
    useRef: (current: unknown) => ({ current }),
    useState: (value: unknown) => [typeof value === 'function' ? value() : value, () => {}],
    useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot(),
    useEffect: (effect: () => (() => void) | void) => { effects.push(effect); }
  };
  const gl = { capabilities: { getMaxAnisotropy: () => 2 }, info: { render: { calls: 0, triangles: 0 } } };
  const modules: Record<string, unknown> = {
    react, 'react/jsx-runtime': jsxRuntime,
    '@react-three/fiber': { useThree: (select: (state: { gl: typeof gl }) => unknown) => select({ gl }), useFrame: () => {} },
    './render-geometry': renderGeometry, './material-library': materialLibrary,
    './scene-runtime': { ...sceneRuntime, createCreationSceneRuntime(input: Parameters<typeof sceneRuntime.createCreationSceneRuntime>[0]) {
      runtime = sceneRuntime.createCreationSceneRuntime(input);
      return runtime;
    } }, './preview': preview, './residency': residency
  };
  const testModule = { exports: {} as { default: (input: unknown) => unknown } };
  const output = ts.transpileModule(readFileSync('src/features/play/creation/WildsCreations.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
  }).outputText;
  // Native Window methods reject an arbitrary object receiver. Node's own
  // queueMicrotask accepts one, so the ordinary scene tests cannot catch this.
  const browserQueueMicrotask = function (this: unknown, work: () => void) {
    if (this !== undefined) throw new TypeError('Illegal invocation');
    deferred.push(work);
  };
  Function('module', 'exports', 'require', 'queueMicrotask', output)(testModule, testModule.exports, (name: string) => {
    if (!(name in modules)) throw Error(`Unexpected renderer dependency: ${name}`);
    return modules[name];
  }, browserQueueMicrotask);
  testModule.exports.default({ source: { projections: [], definitions: {} }, worldId: 'wilds:global:v3', spaceId: 'wildz.space.outer.v1', position: { x: 0, y: 0, z: 0 }, profile: wildsQualityProfileForTier('low', false), onNavigation: () => {} });
  const cleanups: (() => void)[] = [];
  assert.doesNotThrow(() => {
    for (const effect of effects) {
      const cleanup = effect();
      if (cleanup) cleanups.push(cleanup);
    }
    while (deferred.length) deferred.shift()!();
  });
  assert.equal(runtime!.snapshot().revision, 1, 'the scheduled refresh must publish the first scene snapshot');
  assert.ok(cleanups.length > 0);
  cleanups.forEach(cleanup => cleanup());
  while (deferred.length) deferred.shift()!();
});
