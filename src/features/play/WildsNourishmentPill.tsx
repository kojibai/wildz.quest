'use client';

import { useId, useMemo } from 'react';
import { Icons } from '@/components/icons';
import { useBuildGesture } from './creation/use-build-gesture';
import { projectWildsNourishmentQuickUse } from './wilds-nourishment-quick-use';
import type { WildsFoodItem, WildsNourishmentState } from './wilds-nourishment';

export type WildsNourishmentPillProps = Readonly<{
  state?: WildsNourishmentState;
  kaiUPulse: number;
  fuelPercent: number;
  onEat: (item: WildsFoodItem) => void;
  onOpen: () => void;
}>;

export function WildsNourishmentPill({ state, kaiUPulse, fuelPercent, onEat, onOpen, enabled, cancelSignal }: WildsNourishmentPillProps & { enabled: boolean; cancelSignal: number }) {
  const helpId = useId();
  const food = useMemo(() => projectWildsNourishmentQuickUse(state, kaiUPulse, fuelPercent), [state, kaiUPulse, fuelPercent]);
  const open = () => { if (enabled) onOpen(); };
  const gesture = useBuildGesture(open, cancelSignal);
  const eatGesture = useBuildGesture(open, cancelSignal, () => {
    if (enabled && food.item && !food.blocker) onEat(food.item);
  });
  return <div className={`wildz-nourishment-pill${!food.count ? ' is-empty' : ''}`} role="group" aria-label="Nourishment shortcuts">
    <button type="button" className="wildz-nourishment-count" aria-label="Open nourishment Satchel" disabled={!enabled}
      title="Food in Satchel · tap or swipe up" {...gesture}>
      <Icons.food size={16} aria-hidden="true" />
      <span key={food.count} aria-live="polite" aria-atomic="true" aria-label={`${food.count} food portions stored`}>{food.count}</span>
    </button>
    <button type="button" className="wildz-nourishment-eat" aria-label={`Eat one ${food.label.toLowerCase()}`}
      aria-describedby={helpId}
      title={food.blocker ?? `Eat one ${food.label.toLowerCase()}`} disabled={!enabled || Boolean(food.blocker)}
      {...eatGesture}>
      <Icons.eat size={15} aria-hidden="true" />
    </button>
    <span id={helpId} hidden>{food.blocker ?? 'Consume one stored portion to restore fuel.'}</span>
  </div>;
}
