'use client';

import { useEffect, useRef } from 'react';
import { availableWildsFood, describeWildsFoodItem, wildsNourishmentDigestionAt, WILDS_NOURISHMENT_PACK_CAPACITY, type WildsFoodItem, type WildsNourishmentState, type projectWildsNourishmentPlants } from './wilds-nourishment';
import { PLAYER_BREATH_CAPACITY_MICRO } from './player-breath-energy';
import type { projectWildsWildAnimals, projectWildsOwnedLivestock } from './wilds-livestock';
import { wildsFoodEatingBlocker } from './wilds-nourishment-quick-use';

export type WildsNourishmentPlantProjection = ReturnType<typeof projectWildsNourishmentPlants>[number];
export type WildsWildAnimalProjection = ReturnType<typeof projectWildsWildAnimals>[number];
export type WildsOwnedLivestockProjection = ReturnType<typeof projectWildsOwnedLivestock>[number];
export type WildsNourishmentPanelProps = Readonly<{
  nourishment?: WildsNourishmentState;
  kaiUPulse: number;
  fuelPercent: number;
  plants?: readonly WildsNourishmentPlantProjection[];
  animals?: readonly WildsWildAnimalProjection[];
  livestock?: readonly WildsOwnedLivestockProjection[];
  player?: Readonly<{ x: number; z: number; y?: number }>;
  pending?: boolean;
  huntBlocker?: string | null;
  captureBlocker?: string | null;
  inspectedId?: string | null;
  focusStoredFoodSignal?: number;
  onGather?: (plant: WildsNourishmentPlantProjection) => void;
  onEat?: (item: WildsFoodItem) => void;
  onHunt?: (animal: WildsWildAnimalProjection) => void;
  onCapture?: (animal: WildsWildAnimalProjection) => void;
  onProduce?: (animal: WildsOwnedLivestockProjection) => void;
}>;
const NO_PLANTS: readonly WildsNourishmentPlantProjection[] = [];
const NO_ANIMALS: readonly WildsWildAnimalProjection[] = [];
const NO_LIVESTOCK: readonly WildsOwnedLivestockProjection[] = [];

/** Projections and callbacks only: the reducer owns every finite source transition. */
export function WildsNourishmentPanel({ nourishment, kaiUPulse, fuelPercent, plants = NO_PLANTS, animals = NO_ANIMALS, livestock = NO_LIVESTOCK,
  player, pending = false, huntBlocker = null, captureBlocker = null, inspectedId = null, focusStoredFoodSignal = 0, onGather, onEat, onHunt, onCapture, onProduce }: WildsNourishmentPanelProps) {
  const inspectedRow = useRef<HTMLElement | null>(null);
  const foodHeader = useRef<HTMLElement | null>(null);
  useEffect(() => { if (focusStoredFoodSignal) foodHeader.current?.scrollIntoView({ block: 'start' }); }, [focusStoredFoodSignal]);
  const inspectedCategory = plants.some(plant => plant.sourceId === inspectedId) ? 'plant'
    : livestock.some(animal => animal.animalId === inspectedId) ? 'livestock'
    : animals.some(animal => animal.animalId === inspectedId && animal.status === 'wild') ? 'wild' : null;
  useEffect(() => { if (inspectedId) inspectedRow.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [inspectedId, inspectedCategory]);
  const food = availableWildsFood(nourishment), digestion = wildsNourishmentDigestionAt(nourishment, kaiUPulse);
  const packBlocker = food.length >= WILDS_NOURISHMENT_PACK_CAPACITY ? 'Your food pack is full. Eat a portion to make room.' : null;
  const groups = new Map<string, { first: WildsFoodItem; count: number; label: string; fuelBreaths: number }>();
  if (nourishment) for (const item of food) {
    const description = describeWildsFoodItem(item, nourishment);
    if (!description) continue;
    const group = groups.get(item.foodKind);
    if (group) group.count++; else groups.set(item.foodKind, { first: item, count: 1, label: description.label, fuelBreaths: description.fuelBreaths });
  }
  const selectedFirst = (a: string, b: string) => Number(b === inspectedId) - Number(a === inspectedId);
  const nearbyPlants = plants.filter(plant => plant.distance <= 8 || plant.sourceId === inspectedId)
    .sort((a, b) => selectedFirst(a.sourceId, b.sourceId)).slice(0, 6);
  const nearbyAnimals = animals.filter(animal => animal.status === 'wild' && (animal.distance <= 8 || animal.animalId === inspectedId))
    .sort((a, b) => selectedFirst(a.animalId, b.animalId)).slice(0, 4);
  const nearbyLivestock = livestock.filter(animal => animal.animalId === inspectedId || !player || Math.hypot(player.x - animal.position.x, player.z - animal.position.z) <= 8)
    .sort((a, b) => selectedFirst(a.animalId, b.animalId)).slice(0, 8);
  const fuel = Number.isFinite(fuelPercent) ? Math.max(0, Math.min(100, fuelPercent)) : 100;
  return <section className="wilds-steward-craft wilds-nourishment-panel" aria-label="Food and husbandry">
    <header ref={foodHeader} className="wilds-steward-craft-header">
      <span><small>Food & farm</small><strong>{food.length ? `${food.length} food in your pack` : 'Gather something to eat'}</strong></span>
      <span aria-label={`${Math.round(fuel)} percent fuel, ${Math.round(digestion.fullnessPercent)} percent fullness`}>
        <small>{Math.round(fuel)}% fuel · {Math.round(digestion.fullnessPercent)}% fullness</small>
        <meter aria-label="Digestion fullness" max={100} min={0} value={digestion.fullnessPercent} />
      </span>
    </header>
    <p className="wilds-satchel-note">Food restores fuel. Strain eases with rest, and sleep restores fatigue. Your body needs Kai time between meals.</p>
    {groups.size ? <div className="wilds-steward-tool-grid wilds-food-pack" aria-label="Stored food">
      {[...groups.entries()].map(([kind, group]) => {
        const blocker = wildsFoodEatingBlocker(group.first, nourishment!, kaiUPulse, fuel, digestion.remainingFuelMicroBreaths) ?? (!onEat ? 'Eating is unavailable.' : null);
        return <article key={kind}><span><strong>{group.label}</strong><small>{group.count} stored · {Math.round(group.fuelBreaths / (PLAYER_BREATH_CAPACITY_MICRO / 1_000_000) * 100)}% fuel each</small></span>
          <button type="button" disabled={pending || Boolean(blocker)} title={blocker ?? `Eat one ${group.label.toLowerCase()}`} onClick={() => onEat?.(group.first)}>Eat one</button></article>;
      })}
    </div> : <p className="wilds-satchel-note">Tap reachable fruit, berries or vegetables to gather. Tap an animal to inspect it, then choose Hunt or Capture. Eat gathered food here.</p>}
    <section className="wilds-steward-workshop" aria-label="Nearby nourishment plants">
      <header><span><small>Wild plants</small><strong>Gather within reach</strong></span></header>
      {nearbyPlants.length ? <div className="wilds-steward-tool-grid">{nearbyPlants.map(plant => {
        const blocker = !plant.remaining ? 'This crop is depleted. It grows back with Kai days.' : !plant.canGather ? 'Move closer on the ground to gather.' : packBlocker ?? (!onGather ? 'Gathering is unavailable.' : null);
        const selected = inspectedId === plant.sourceId;
        return <article key={plant.sourceId} aria-label={selected ? `Selected ${plant.label}` : undefined} className={selected ? 'wilds-nourishment-selected' : undefined} ref={selected ? inspectedRow : undefined}>
          <span><strong>{plant.label}</strong><small>{plant.remaining}/{plant.capacity} left · {plant.distance.toFixed(1)} m</small></span>
          <button disabled={pending || Boolean(blocker)} title={blocker ?? 'Gather one finite portion'} type="button" onClick={() => onGather?.(plant)}>Gather</button>
          {selected ? <p className="wilds-nourishment-hint">{blocker ?? 'Gather one portion into your pack, then choose Eat one.'}</p> : null}</article>;
      })}</div> : <p className="wilds-satchel-note">Explore beyond the trails to find fruit trees and wild plants.</p>}
    </section>
    {nearbyAnimals.length ? <section className="wilds-steward-workshop" aria-label="Wild landscape animals"><header><span><small>Landscape animals</small><strong>Hunt or raise livestock</strong></span></header>
      <p className="wilds-satchel-note">These are landscape wildlife. Discoverable creature companions have their own glowing signals.</p>
      <div className="wilds-steward-tool-grid">{nearbyAnimals.map(animal => {
        const reachBlocker = !animal.canInteract ? 'Move within reach on the same ground.' : null;
        const huntReason = reachBlocker ?? packBlocker ?? huntBlocker ?? (!onHunt ? 'An equipped axe or ready companion ability is needed.' : null);
        const captureReason = reachBlocker ?? captureBlocker ?? (!onCapture ? 'Build a functional garden, habitat, or shelter nearby.' : null);
        const selected = inspectedId === animal.animalId;
        return <article key={animal.animalId} aria-label={selected ? `Selected ${animal.label}` : undefined} className={selected ? 'wilds-nourishment-selected' : undefined} ref={selected ? inspectedRow : undefined}><span><strong>{animal.label}</strong><small>{animal.distance.toFixed(1)} m · {animal.capturable ? 'Can live on your farm' : 'Wild game'}</small></span>
          <div><button type="button" disabled={pending || Boolean(huntReason)} title={huntReason ?? 'Hunt this individual for one portion of meat'} onClick={() => onHunt?.(animal)}>Hunt</button>
            {animal.capturable ? <button type="button" disabled={pending || Boolean(captureReason)} title={captureReason ?? 'Lead this individual into your nearby farm'} onClick={() => onCapture?.(animal)}>Capture livestock</button> : null}</div>
          {selected ? <p className="wilds-nourishment-hint">{reachBlocker ?? <>{huntReason ?? 'Hunt uses your active companion or equipped axe and yields one portion of meat.'}{animal.capturable ? ` ${captureReason ?? 'Capture leads this animal to your nearby farm.'}` : ''}</>}</p> : null}</article>;
      })}</div></section> : null}
    {nearbyLivestock.length ? <section className="wilds-steward-workshop" aria-label="Productive livestock"><header><span><small>Your farm</small><strong>Eggs & milk</strong></span></header>
      <div className="wilds-steward-tool-grid">{nearbyLivestock.map(animal => {
        const inReach = !player || (Math.hypot(player.x - animal.position.x, player.z - animal.position.z) <= 4 && (player.y === undefined || Math.abs(player.y - animal.position.y) <= 1.8));
        const blocker = !inReach ? 'Approach your farm to collect its produce.' : !animal.canProduce ? 'One full Kai day of husbandry comes before the first yield. Only one yield is available per Kai day.' : packBlocker ?? (!onProduce ? 'Collection is unavailable.' : null);
        const selected = inspectedId === animal.animalId;
        return <article key={animal.animalId} aria-label={selected ? `Selected ${animal.label}` : undefined} className={selected ? 'wilds-nourishment-selected' : undefined} ref={selected ? inspectedRow : undefined}><span><strong>{animal.label}</strong><small>{animal.product === 'wild-eggs' ? 'Eggs' : 'Milk'} · {animal.canProduce ? 'Ready to collect' : 'Growing with Kai time'}</small></span>
          <button type="button" disabled={pending || Boolean(blocker)} title={blocker ?? 'Collect one finite yield'} onClick={() => onProduce?.(animal)}>Collect {animal.product === 'wild-eggs' ? 'eggs' : 'milk'}</button>
          {selected ? <p className="wilds-nourishment-hint">{blocker ?? 'Collect one portion into your food pack.'}</p> : null}</article>;
      })}</div></section> : null}
  </section>;
}
