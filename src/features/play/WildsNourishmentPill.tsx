'use client';

import { useId, useMemo, useState } from 'react';
import { Icons } from '@/components/icons';
import { useBuildGesture } from './creation/use-build-gesture';
import { projectWildsNourishmentQuickUse, recentlyGatheredWildsNourishmentCategory } from './wilds-nourishment-quick-use';
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
  const [selection, setSelection] = useState(() => ({ source: state, category: recentlyGatheredWildsNourishmentCategory(undefined, state) ?? 'fruit' }));
  let category = selection.category;
  if (selection.source !== state) {
    category = recentlyGatheredWildsNourishmentCategory(selection.source, state)
      ?? (selection.source?.ownerReceizId === state?.ownerReceizId ? selection.category : 'fruit');
    // Adjust this local selection before children commit, so collection paints its count immediately.
    setSelection({ source: state, category });
  }
  const foods = useMemo(() => ({
    fruit: projectWildsNourishmentQuickUse(state, kaiUPulse, fuelPercent, 'fruit'),
    vegetables: projectWildsNourishmentQuickUse(state, kaiUPulse, fuelPercent, 'vegetables')
  }), [state, kaiUPulse, fuelPercent]);
  const food = foods[category];
  const open = () => { if (enabled) onOpen(); };
  const switchFood = () => { if (enabled) setSelection({ source: state, category: category === 'fruit' ? 'vegetables' : 'fruit' }); };
  const eat = () => {
    if (!enabled) return;
    if (food.item && !food.blocker) onEat(food.item);
    else open();
  };
  const gesture = useBuildGesture(open, cancelSignal, eat, switchFood);
  const FoodIcon = category === 'fruit' ? Icons.food : Icons.vegetable;
  const label = food.blocker ? `Open ${category} in nourishment Satchel` : `Eat one ${food.label.toLowerCase()}`;
  return <div className={`wildz-nourishment-pill${!food.count ? ' is-empty' : ''}${food.blocker ? ' is-unavailable' : ''}`} role="group" aria-label="Nourishment shortcuts">
    <button type="button" className="wildz-nourishment-count" aria-label={label} disabled={!enabled} aria-describedby={helpId}
      title={`${category === 'fruit' ? 'Fruit & berries' : 'Vegetables'} · ${food.count} stored. ${food.blocker ?? 'Tap to eat one.'} Swipe sideways to switch; up for Satchel.`}
      {...gesture} onKeyDown={event => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); event.stopPropagation(); switchFood(); }
        else if (event.key === 'ArrowUp') { event.preventDefault(); event.stopPropagation(); open(); }
      }}>
      <FoodIcon size={18} aria-hidden="true" />
      <span key={`${category}:${food.count}`} aria-live="polite" aria-atomic="true" aria-label={`${food.count} food portions stored`}>{food.count}</span>
    </button>
    <span id={helpId} hidden>{category === 'fruit' ? 'Fruit and berries.' : 'Vegetables.'} {food.blocker ?? 'Tap to eat one stored portion.'} Swipe left or right to switch food, or swipe up to open the nourishment Satchel. Arrow keys offer the same controls.</span>
  </div>;
}
