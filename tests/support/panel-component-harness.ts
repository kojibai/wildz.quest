import * as React from "react";

/** Execute the real component and its handlers with deterministic hook slots.
 * Children remain real React elements; no module or product behavior is mocked.
 * The test owns scheduling because server rendering never runs mount effects. */
export function mountPanelComponent<Props>(component: (props: Props) => React.ReactNode) {
  type Slot = { value?: unknown; deps?: readonly unknown[]; cleanup?: () => void };
  const slots: Slot[] = [];
  let cursor = 0;
  let effects: (() => void)[] = [];
  const same = (a?: readonly unknown[], b?: readonly unknown[]) => Boolean(a && b && a.length === b.length && a.every((value, index) => Object.is(value, b[index])));
  const memo = (callback: () => unknown, deps?: readonly unknown[]) => {
    const index = cursor++;
    if (!same(slots[index]?.deps, deps)) slots[index] = { value: callback(), deps };
    return slots[index]!.value;
  };
  const dispatcher = {
    useState(value: unknown) {
      const index = cursor++;
      const slot = slots[index] ??= { value: typeof value === "function" ? value() : value };
      return [slot.value, (next: unknown) => { slot.value = typeof next === "function" ? next(slot.value) : next; }];
    },
    useRef: (value: unknown) => memo(() => ({ current: value }), []),
    useMemo: memo,
    useCallback: (callback: unknown, deps?: readonly unknown[]) => memo(() => callback, deps),
    useEffect(callback: () => void | (() => void), deps?: readonly unknown[]) {
      const index = cursor++;
      if (same(slots[index]?.deps, deps)) return;
      effects.push(() => {
        slots[index]?.cleanup?.();
        slots[index] = { deps, cleanup: callback() || undefined };
      });
    }
  };
  const internals = (React as unknown as { __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: { H: unknown } }).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  return {
    render(props: Props) {
      cursor = 0;
      const previous = internals.H;
      try { internals.H = dispatcher; return component(props); }
      finally { internals.H = previous; }
    },
    flushEffects() { const pending = effects; effects = []; pending.forEach(effect => effect()); },
    unmount() { slots.forEach(slot => slot.cleanup?.()); }
  };
}

export function panelElements(node: React.ReactNode): React.ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(panelElements);
  if (!React.isValidElement<Record<string, unknown>>(node)) return [];
  return [node, ...panelElements(node.props.children as React.ReactNode)];
}
