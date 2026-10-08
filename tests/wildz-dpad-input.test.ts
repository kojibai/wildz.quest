import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { cameraRelativeMovement } from '../src/features/play/wilds-movement';

// Exercise the component's handlers and effects with a deterministic DOM/RAF
// boundary. React state commits can be held back to reproduce a busy render.
function mountDpad() {
  const slots: { value: any; deps?: unknown[]; cleanup?: () => void }[] = [];
  let cursor = 0, now = 0, nextFrame = 0, effects: (() => void)[] = [];
  const frames = new Map<number, (now: number) => void>();
  const inputs: { type: string; x: number; z: number }[] = [];
  const window = Object.assign(new EventTarget(), {
    requestAnimationFrame(callback: (now: number) => void) { frames.set(++nextFrame, callback); return nextFrame; },
    cancelAnimationFrame(id: number) { frames.delete(id); }
  });
  const document = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  const same = (a?: unknown[], b?: unknown[]) => Boolean(a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i])));
  const react = {
    useRef(value: unknown) { return (slots[cursor++] ??= { value: { current: value } }).value; },
    useState(value: unknown) {
      const slot = slots[cursor++] ??= { value };
      return [slot.value, (next: unknown) => { slot.value = typeof next === 'function' ? next(slot.value) : next; }];
    },
    useCallback(callback: unknown, deps: unknown[]) {
      const index = cursor++;
      if (!same(slots[index]?.deps, deps)) slots[index] = { value: callback, deps };
      return slots[index].value;
    },
    useEffect(effect: () => (() => void) | void, deps: unknown[]) {
      const index = cursor++;
      if (same(slots[index]?.deps, deps)) return;
      effects.push(() => {
        slots[index]?.cleanup?.();
        slots[index] = { value: undefined, deps, cleanup: effect() || undefined };
      });
    }
  };
  const output = ts.transpileModule(readFileSync('src/features/play/WildzDpad.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX }
  }).outputText;
  const testModule = { exports: {} as { WildzDpad: (props: unknown) => { props: any } } };
  runInNewContext(output, { module: testModule, exports: testModule.exports, window, document, performance: { now: () => now },
    require(name: string) {
      if (name === 'react') return react;
      if (name === 'react/jsx-runtime') return { jsx: (type: unknown, props: unknown) => ({ type, props }), jsxs: (type: unknown, props: unknown) => ({ type, props }) };
      if (name === './wilds-movement') return { cameraRelativeMovement };
      if (name === '@/components/icons') return { Icons: {} };
      throw Error(`Unexpected component dependency: ${name}`);
    }
  });
  let rectReads = 0;
  const button = {
    getBoundingClientRect() { rectReads++; return { left: 0, top: 0, width: 100, height: 100 }; },
    setPointerCapture() { throw Error('capture unavailable'); },
    hasPointerCapture() { return false; }, releasePointerCapture() {}
  };
  const knob = { style: { transform: '' } };
  const props = { cameraHeadingRef: { current: 0 }, movementMode: 'walk', cancelSignal: 0, onInput: (input: any) => inputs.push(input) };
  const render = () => {
    cursor = 0;
    const tree = testModule.exports.WildzDpad(props);
    for (const child of tree.props.children) if (child?.props?.className === 'wildz-dpad-knob') child.props.ref.current = knob;
    return tree.props;
  };
  const flush = () => { const pending = effects; effects = []; pending.forEach(effect => effect()); };
  const event = (pointerId = 1, extra = {}) => ({ pointerId, button: 0, buttons: 1, pointerType: 'touch', clientX: 92, clientY: 50,
    currentTarget: button, preventDefault() {}, stopPropagation() {}, ...extra });
  const send = (type: string, pointerId = 1, extra = {}) => document.dispatchEvent(Object.assign(new Event(type), { pointerId, ...extra }));
  const step = (elapsed = 60, callbackDelay = 0) => {
    now += elapsed;
    const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(now - callbackDelay));
  };
  const initial = render(); flush();
  return { initial, render, flush, frames, inputs, event, send, step, knob, props, rectReads: () => rectReads,
    unmount() { for (const slot of slots) slot?.cleanup?.(); } };
}

test('holding the D-pad starts its repeat clock before the next React commit', () => {
  const pad = mountDpad();
  pad.initial.onPointerDown(pad.event());
  assert.equal(pad.inputs.length, 1, 'initial movement is immediate');
  pad.step();
  assert.equal(pad.inputs.length, 2, 'holding repeats even while a render is pending');
  pad.unmount();
});

test('late frame callbacks preserve the original held-movement cadence', () => {
  const pad = mountDpad();
  pad.initial.onPointerDown(pad.event());
  pad.step(60, 10);
  assert.equal(pad.inputs.length, 2);
  pad.step(50, 10);
  assert.equal(pad.inputs.length, 3, 'callback delay must not slow down travel');
  pad.unmount();
});

test('dragging out of the D-pad center starts movement without waiting for the repeat clock', () => {
  const pad = mountDpad();
  pad.initial.onPointerDown(pad.event(1, { clientX: 50, clientY: 50 }));
  assert.equal(pad.inputs.length, 0);
  pad.step(5);
  pad.initial.onPointerMove(pad.event());
  assert.equal(pad.inputs.length, 1, 'the first meaningful drag is immediate');
  pad.step(20);
  assert.equal(pad.inputs.length, 1, 'immediate feedback must not add repeat steps');
  pad.step(30);
  assert.equal(pad.inputs.length, 2);
  pad.unmount();
});

test('the outside-capture fallback starts a centered drag immediately and avoids duplicate React events', () => {
  const pad = mountDpad();
  pad.initial.onPointerDown(pad.event(1, { clientX: 50, clientY: 50 }));
  pad.send('pointermove', 1, { clientX: 92, clientY: 50, pointerType: 'touch', buttons: 1 });
  pad.initial.onPointerMove(pad.event());
  assert.equal(pad.inputs.length, 1);
  for (let i = 0; i < 20; i++) pad.initial.onPointerMove(pad.event());
  assert.equal(pad.inputs.length, 1, 'pointer event frequency must not increase travel speed');
  pad.unmount();
});

test('D-pad keyboard movement reads the latest camera heading and travel mode', () => {
  const pad = mountDpad();
  pad.props.cameraHeadingRef.current = Math.PI / 2;
  pad.props.movementMode = 'run';
  const handlers = pad.render();
  let prevented = false, stopped = false;
  handlers.onKeyDown({ key: 'ArrowUp', preventDefault() { prevented = true; }, stopPropagation() { stopped = true; } });
  assert.equal(pad.inputs.length, 1);
  assert.equal(pad.inputs[0].x, -1);
  assert.ok(Math.abs(pad.inputs[0].z) < 1e-12);
  assert.equal((pad.inputs[0] as any).mode, 'run');
  assert.equal(prevented, true); assert.equal(stopped, true);
  pad.unmount();
});

test('release outside the D-pad stops movement when pointer capture is unavailable', () => {
  const pad = mountDpad();
  pad.initial.onPointerDown(pad.event()); pad.render(); pad.flush();
  pad.send('pointerup');
  pad.step();
  assert.equal(pad.inputs.length, 1);
  assert.equal(pad.render()['aria-pressed'], false);
  assert.equal(pad.knob.style.transform, 'translate(0px, 0px)');
  assert.equal(pad.frames.size, 0);
  pad.unmount();
});

test('another finger cannot stop the owning gesture, but its cancellation stops immediately', () => {
  const pad = mountDpad();
  pad.initial.onPointerDown(pad.event()); pad.render(); pad.flush();
  pad.send('pointerup', 2); pad.step();
  assert.equal(pad.inputs.length, 2);
  pad.send('pointercancel'); pad.step();
  assert.equal(pad.inputs.length, 2);
  assert.equal(pad.frames.size, 0);
  pad.unmount();
});

test('D-pad drag reuses its initial bounds instead of measuring layout on every move', () => {
  const pad = mountDpad();
  pad.initial.onPointerDown(pad.event());
  for (let i = 0; i < 100; i++) pad.initial.onPointerMove(pad.event(1, { clientX: i }));
  assert.equal(pad.rectReads(), 1);
  pad.unmount();
});

test('a missed mouse release recovers on the next move and right clicks never start travel', () => {
  const pad = mountDpad();
  pad.initial.onPointerDown(pad.event(1, { pointerType: 'mouse', button: 2, buttons: 2 }));
  assert.equal(pad.inputs.length, 0);
  pad.initial.onPointerDown(pad.event(1, { pointerType: 'mouse' })); pad.render(); pad.flush();
  pad.send('pointermove', 1, { pointerType: 'mouse', buttons: 0 }); pad.step();
  assert.equal(pad.inputs.length, 1);
  assert.equal(pad.frames.size, 0);
  pad.unmount();
});

test('unmount cancels movement even while the active state commit is pending', () => {
  const pad = mountDpad();
  pad.initial.onPointerDown(pad.event()); pad.unmount(); pad.step();
  assert.equal(pad.inputs.length, 1);
  assert.equal(pad.frames.size, 0);
});
