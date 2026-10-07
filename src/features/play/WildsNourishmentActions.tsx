'use client';

import { Icons } from '@/components/icons';
import type { WildsNourishmentPlantProjection, WildsOwnedLivestockProjection, WildsWildAnimalProjection } from './WildsNourishmentPanel';

export type WildsNourishmentActionSource = WildsNourishmentPlantProjection | WildsWildAnimalProjection | WildsOwnedLivestockProjection;
export type WildsNourishmentActionsProps = Readonly<{
  source: WildsNourishmentActionSource;
  player: Readonly<{ x: number; y?: number; z: number }>;
  huntBlocker: string | null;
  captureBlocker: string | null;
  packFull: boolean;
  onClose: () => void;
  onHunt: (animal: WildsWildAnimalProjection) => void;
  onCapture: (animal: WildsWildAnimalProjection) => void;
  onProduce: (animal: WildsOwnedLivestockProjection) => void;
  onGather: (plant: WildsNourishmentPlantProjection) => void;
}>;

/** A compact world action, with movement controls left available. */
export function WildsNourishmentActions({ source, player, huntBlocker, captureBlocker, packFull, onClose, onHunt, onCapture, onProduce, onGather }: WildsNourishmentActionsProps) {
  if ('sourceId' in source) {
    const blocker = !source.remaining ? 'This crop grows back with Kai days.' : !source.canGather ? 'Move closer on the ground.' : packFull ? 'Eat a portion to make room.' : null;
    return <section className="wilds-animal-actions" aria-label={`${source.label} actions`} onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}
      onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); onClose(); } }}>
      <header><span><strong>{source.label}</strong><small>{source.distance.toFixed(1)} m · {source.remaining} left</small></span><button type="button" className="wilds-animal-close" aria-label="Close food actions" onClick={onClose}><Icons.close size={15} /></button></header>
      <div className="wilds-animal-action-buttons"><button type="button" aria-label={`Gather ${source.label}`} disabled={Boolean(blocker)} title={blocker ?? 'Gather one portion into your food pack'} onClick={() => onGather(source)}><Icons.food size={18} /><span>Gather</span></button></div>
      {blocker ? <p>{blocker}</p> : null}
    </section>;
  }
  const animal = source;
  const wild = 'status' in animal;
  const distance = Math.hypot(player.x - animal.position.x, player.z - animal.position.z);
  const inReach = wild ? animal.canInteract : distance <= 4 && (player.y === undefined || Math.abs(player.y - animal.position.y) <= 1.8);
  const reachReason = inReach ? null : 'Move closer on the same ground.';
  const packReason = packFull ? 'Your food pack is full. Eat a portion to make room.' : null;
  const huntReason = reachReason ?? packReason ?? huntBlocker;
  const captureReason = reachReason ?? captureBlocker;
  const produceReason = reachReason ?? packReason ?? (!wild && !animal.canProduce ? 'Produce grows after a full Kai day of husbandry.' : null);
  const captureNote = captureReason?.startsWith('Finish a nearby') ? 'Needs a nearby farm.' : captureReason;
  return <section className="wilds-animal-actions" aria-label={`${animal.label} actions`}
    onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}
    onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); onClose(); } }}>
    <header><Icons.roam size={20} aria-hidden="true" /><span><strong>{animal.label}</strong><small>{distance.toFixed(1)} m · {wild ? 'Wildlife' : 'Your livestock'}</small></span>
      <button type="button" className="wilds-animal-close" aria-label="Close animal actions" onClick={onClose}><Icons.close size={17} /></button></header>
    <div className="wilds-animal-action-buttons">
      {wild ? <>
        <button type="button" aria-label={`Hunt ${animal.label}`} disabled={Boolean(huntReason)} title={huntReason ?? 'Hunt for one portion of meat'} onClick={() => onHunt(animal)}><Icons.meat size={18} /><span>Hunt</span></button>
        {animal.capturable ? <button type="button" aria-label={`Capture ${animal.label}`} disabled={Boolean(captureReason)} title={captureReason ?? 'Lead into your nearby farm'} onClick={() => onCapture(animal)}><Icons.roam size={18} /><span>Capture</span></button> : null}
      </> : <button type="button" disabled={Boolean(produceReason)} title={produceReason ?? 'Collect one portion into your food pack'} onClick={() => onProduce(animal)}><Icons.food size={18} /><span>{animal.product === 'wild-eggs' ? 'Eggs' : 'Milk'}</span></button>}
    </div>
    {(wild ? huntReason : produceReason) ? <p>{wild ? huntReason : produceReason}</p> : null}
    {wild && animal.capturable && captureReason && captureReason !== reachReason ? <small className="wilds-animal-capture-reason">Capture: {captureNote}</small> : null}
  </section>;
}
