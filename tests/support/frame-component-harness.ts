import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as THREE from 'three';

/** Run the actual component with deterministic React/Fiber scheduling and real
 * Three transforms. Only lifecycle/render boundaries are substituted. */
export function mountFrameComponent(path: string, names: string[], environment: Record<string, unknown> = {}) {
  const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declaration = source.statements.find(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text ?? ''));
  if (!declaration || !ts.isFunctionDeclaration(declaration)) throw Error(`Component missing: ${names.join(', ')}`);
  const slots: { value: any; deps?: unknown[]; cleanup?: () => void }[] = [];
  let cursor = 0;
  const frames = new Map<number, { priority: number; callback: (...args: any[]) => void }>();
  let effects: (() => void)[] = [];
  const same = (a?: unknown[], b?: unknown[]) => Boolean(a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i])));
  const effect = (callback: () => (() => void) | void, deps: unknown[]) => {
    const index = cursor++;
    if (same(slots[index]?.deps, deps)) return;
    effects.push(() => { slots[index]?.cleanup?.(); slots[index] = { value: undefined, deps, cleanup: callback() || undefined }; });
  };
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  const code = ts.transpileModule(`${declaration.getText(source)}\nmodule.exports = ${declaration.name!.text};`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX }
  }).outputText;
  const testModule = { exports: {} as unknown as (...args: any[]) => any };
  runInNewContext(code, {
    THREE, module: testModule, exports: testModule.exports,
    useRef(value: unknown) { return (slots[cursor++] ??= { value: { current: value } }).value; },
    useMemo(callback: () => unknown, deps: unknown[]) {
      const index = cursor++;
      if (!same(slots[index]?.deps, deps)) slots[index] = { value: callback(), deps };
      return slots[index].value;
    },
    useEffect: effect, useLayoutEffect: effect,
    useFrame(callback: (...args: any[]) => void, priority = 0) { frames.set(cursor++, { callback, priority }); },
    require(name: string) { if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx }; throw Error(`Unexpected dependency: ${name}`); },
    ...environment
  });
  return {
    slots,
    invoke(...args: any[]) { return testModule.exports(...args); },
    render(props: any) { cursor = 0; return testModule.exports(props); },
    flushEffects() { const pending = effects; effects = []; pending.forEach(callback => callback()); },
    frame(state: unknown = {}, delta = 1 / 60) {
      [...frames.values()].sort((a, b) => a.priority - b.priority).forEach(({ callback }) => callback(state, delta));
    },
    unmount() { slots.forEach(slot => slot.cleanup?.()); }
  };
}
