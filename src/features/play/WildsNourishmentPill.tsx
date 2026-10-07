'use client';

import { useId, useMemo, useState } from 'react';
import { Icons } from '@/components/icons';
import { useBuildGesture } from './creation/use-build-gesture';
import { nextWildsNourishmentCategory, projectWildsNourishmentQuickUse, recentlyGatheredWildsNourishmentCategory } from './wilds-nourishment-quick-use';
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
  const foods = useMemo(() => ({
    fruit: projectWildsNourishmentQuickUse(state, kaiUPulse, fuelPercent, 'fruit'),
    vegetables: projectWildsNourishmentQuickUse(state, kaiUPulse, fuelPercent, 'vegetables'),
    meat: projectWildsNourishmentQuickUse(state, kaiUPulse, fuelPercent, 'meat')
  }), [state, kaiUPulse, fuelPercent]);
  let category = selection.category;
  if (selection.source !== state) {
    category = recentlyGatheredWildsNourishmentCategory(selection.source, state)
      ?? (selection.source?.ownerReceizId === state?.ownerReceizId ? selection.category : 'fruit');
    if (category === 'meat' && !foods.meat.count) category = foods.vegetables.count ? 'vegetables' : 'fruit';
    // Adjust this local selection before children commit, so collection paints its count immediately.
    setSelection({ source: state, category });
  }
  const food = foods[category];
  const open = () => { if (enabled) onOpen(); };
  const switchFood = (direction: 'left' | 'right') => { if (enabled) setSelection({ source: state, category: nextWildsNourishmentCategory(category, direction, foods.meat.count > 0) }); };
  const eat = () => {
    if (!enabled) return;
    if (food.item && !food.blocker) onEat(food.item);
  };
  const gesture = useBuildGesture(open, cancelSignal, eat, switchFood);
  const FoodIcon = category === 'fruit' ? Icons.food : category === 'meat' ? Icons.meat : Icons.vegetable;
  const categoryLabel = category === 'fruit' ? 'Fruit & berries' : category === 'meat' ? 'Meat' : 'Vegetables';
  const label = `Eat one ${food.label.toLowerCase()}`;
  return <div className={`wildz-nourishment-pill${!food.count ? ' is-empty' : ''}${food.blocker ? ' is-unavailable' : ''}`} role="group" aria-label="Nourishment shortcuts">
    <button type="button" className="wildz-nourishment-count" aria-label={label} disabled={!enabled} aria-describedby={helpId}
      title={`${categoryLabel} · ${food.count} stored. ${food.blocker ?? 'Tap to eat one.'} Swipe sideways to switch; up for Satchel.`}
      {...gesture} onKeyDown={event => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); event.stopPropagation(); switchFood(event.key === 'ArrowLeft' ? 'left' : 'right'); }
        else if (event.key === 'ArrowUp') { event.preventDefault(); event.stopPropagation(); open(); }
      }}>
      <FoodIcon size={18} aria-hidden="true" />
      <span key={`${category}:${food.count}`} aria-live="polite" aria-atomic="true" aria-label={`${food.count} food portions stored`}>{food.count}</span>
    </button>
    <span id={helpId} hidden>{categoryLabel}. {food.blocker ?? 'Tap to eat one stored portion.'} Swipe left or right to switch food{foods.meat.count ? ' between fruit, vegetables and meat' : ''}, or swipe up to open the nourishment Satchel. Arrow keys offer the same controls.</span>
  </div>;
}
