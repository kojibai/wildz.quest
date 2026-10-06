'use client';

import { availableWildsFood, describeWildsFoodItem, wildsNourishmentDigestionAt, type WildsFoodItem, type WildsNourishmentState, type projectWildsNourishmentPlants } from './wilds-nourishment';
import { PLAYER_BREATH_CAPACITY_MICRO } from './player-breath-energy';
import type { projectWildsWildAnimals, projectWildsOwnedLivestock } from './wilds-livestock';

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
  player, pending = false, huntBlocker = null, captureBlocker = null, onGather, onEat, onHunt, onCapture, onProduce }: WildsNourishmentPanelProps) {
  const food = availableWildsFood(nourishment), digestion = wildsNourishmentDigestionAt(nourishment, kaiUPulse);
  const groups = new Map<string, { first: WildsFoodItem; count: number; label: string; fuelBreaths: number }>();
  if (nourishment) for (const item of food) {
    const description = describeWildsFoodItem(item, nourishment);
    if (!description) continue;
    const group = groups.get(item.foodKind);
    if (group) group.count++; else groups.set(item.foodKind, { first: item, count: 1, label: description.label, fuelBreaths: description.fuelBreaths });
  }
  const nearbyPlants = plants.filter(plant => plant.distance <= 8).slice(0, 6);
  const nearbyAnimals = animals.filter(animal => animal.status === 'wild' && animal.distance <= 8).slice(0, 4);
  const nearbyLivestock = livestock.filter(animal => !player || Math.hypot(player.x - animal.position.x, player.z - animal.position.z) <= 8).slice(0, 8);
  const fuel = Number.isFinite(fuelPercent) ? Math.max(0, Math.min(100, fuelPercent)) : 100;
  return <section className="wilds-steward-craft wilds-nourishment-panel" aria-label="Food and husbandry">
    <header className="wilds-steward-craft-header">
      <span><small>Food & farm</small><strong>{food.length ? `${food.length} food in your pack` : 'Gather something to eat'}</strong></span>
      <span aria-label={`${Math.round(fuel)} percent fuel, ${Math.round(digestion.fullnessPercent)} percent fullness`}>
        <small>{Math.round(fuel)}% fuel · {Math.round(digestion.fullnessPercent)}% fullness</small>
        <meter aria-label="Digestion fullness" max={100} min={0} value={digestion.fullnessPercent} />
      </span>
    </header>
    <p className="wilds-satchel-note">Food restores fuel. Strain eases with rest, and sleep restores fatigue. Your body needs Kai time between meals.</p>
    {groups.size ? <div className="wilds-steward-tool-grid wilds-food-pack" aria-label="Stored food">
      {[...groups.entries()].map(([kind, group]) => {
        const amount = Math.min(Math.round((100 - fuel) / 100 * PLAYER_BREATH_CAPACITY_MICRO), Math.round(group.fuelBreaths * 1_000_000));
        const blocker = fuel >= 100 ? 'Your fuel is full. Keep this food for later.'
          : amount > digestion.remainingFuelMicroBreaths ? 'Let your meal digest before eating more.' : !onEat ? 'Eating is unavailable.' : null;
        return <article key={kind}><span><strong>{group.label}</strong><small>{group.count} stored · {Math.round(group.fuelBreaths / (PLAYER_BREATH_CAPACITY_MICRO / 1_000_000) * 100)}% fuel each</small></span>
          <button type="button" disabled={pending || Boolean(blocker)} title={blocker ?? `Eat one ${group.label.toLowerCase()}`} onClick={() => onEat?.(group.first)}>Eat one</button></article>;
      })}
    </div> : <p className="wilds-satchel-note">Pick fruit from a tree, gather berries or vegetables, or collect nourishment from animals.</p>}
    <section className="wilds-steward-workshop" aria-label="Nearby nourishment plants">
      <header><span><small>Wild plants</small><strong>Gather within reach</strong></span></header>
      {nearbyPlants.length ? <div className="wilds-steward-tool-grid">{nearbyPlants.map(plant => {
        const blocker = !plant.remaining ? 'This crop is depleted. It grows back with Kai days.' : !plant.canGather ? 'Move closer on the ground to gather.' : !onGather ? 'Gathering is unavailable.' : null;
        return <article key={plant.sourceId}><span><strong>{plant.label}</strong><small>{plant.remaining}/{plant.capacity} left · {plant.distance.toFixed(1)} m</small></span>
          <button disabled={pending || Boolean(blocker)} title={blocker ?? 'Gather one finite portion'} type="button" onClick={() => onGather?.(plant)}>Gather</button></article>;
      })}</div> : <p className="wilds-satchel-note">Explore beyond the trails to find fruit trees and wild plants.</p>}
    </section>
    {nearbyAnimals.length ? <section className="wilds-steward-workshop" aria-label="Wild landscape animals"><header><span><small>Landscape animals</small><strong>Hunt or raise livestock</strong></span></header>
      <div className="wilds-steward-tool-grid">{nearbyAnimals.map(animal => {
        const reachBlocker = !animal.canInteract ? 'Move within reach on the same ground.' : null;
        const huntReason = reachBlocker ?? huntBlocker ?? (!onHunt ? 'An equipped axe or ready companion ability is needed.' : null);
        const captureReason = reachBlocker ?? captureBlocker ?? (!onCapture ? 'Build a functional garden, habitat, or shelter nearby.' : null);
        return <article key={animal.animalId}><span><strong>{animal.label}</strong><small>{animal.distance.toFixed(1)} m · {animal.capturable ? 'Can live on your farm' : 'Wild game'}</small></span>
          <div><button type="button" disabled={pending || Boolean(huntReason)} title={huntReason ?? 'Hunt this individual for one portion of meat'} onClick={() => onHunt?.(animal)}>Hunt</button>
            {animal.capturable ? <button type="button" disabled={pending || Boolean(captureReason)} title={captureReason ?? 'Lead this individual into your nearby farm'} onClick={() => onCapture?.(animal)}>Capture livestock</button> : null}</div></article>;
      })}</div></section> : null}
    {nearbyLivestock.length ? <section className="wilds-steward-workshop" aria-label="Productive livestock"><header><span><small>Your farm</small><strong>Eggs & milk</strong></span></header>
      <div className="wilds-steward-tool-grid">{nearbyLivestock.map(animal => {
        const inReach = !player || (Math.hypot(player.x - animal.position.x, player.z - animal.position.z) <= 4 && (player.y === undefined || Math.abs(player.y - animal.position.y) <= 1.8));
        const blocker = !inReach ? 'Approach your farm to collect its produce.' : !animal.canProduce ? 'One full Kai day of husbandry comes before the first yield. Only one yield is available per Kai day.' : !onProduce ? 'Collection is unavailable.' : null;
        return <article key={animal.animalId}><span><strong>{animal.label}</strong><small>{animal.product === 'wild-eggs' ? 'Eggs' : 'Milk'} · {animal.canProduce ? 'Ready to collect' : 'Growing with Kai time'}</small></span>
          <button type="button" disabled={pending || Boolean(blocker)} title={blocker ?? 'Collect one finite yield'} onClick={() => onProduce?.(animal)}>Collect {animal.product === 'wild-eggs' ? 'eggs' : 'milk'}</button></article>;
      })}</div></section> : null}
  </section>;
}
