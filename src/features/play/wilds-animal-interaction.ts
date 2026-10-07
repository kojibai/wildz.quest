import type { WildsFaunaLifePose } from './wilds-fauna-motion';
import type { WildsWildAnimal } from './wilds-animal-ecology';
import type { WildsLivestockState } from './wilds-livestock';

export const WILDS_HUNT_PRESENTATION_MS = 900;
type Point = Readonly<{ x: number; y: number; z: number }>;
export type WildsAnimalHuntRequest = Readonly<{
  animal: WildsWildAnimal;
  ownerReceizId: string;
  spaceId: string;
  requestedKaiUPulse: number;
  before: WildsLivestockState | undefined;
  hunterAssetId: string | null;
  reducedMotion?: boolean;
  from: Point;
  position: Point;
  heading: number;
  gait: number;
  pose: WildsFaunaLifePose;
}>;
export type WildsAnimalHuntPresentation = WildsAnimalHuntRequest & Readonly<{ startedAtMs: number }>;

/** Rejected, repeated and foreign hunts never create a reward animation. */
export function confirmWildsAnimalHunt(request: WildsAnimalHuntRequest, livestock: WildsLivestockState | undefined, startedAtMs: number): WildsAnimalHuntPresentation | null {
  const source = livestock?.animals[request.animal.animalId];
  return !request.before?.animals[request.animal.animalId] && source?.status === 'hunted'
    && source.ownerReceizId === request.ownerReceizId && livestock?.ownerReceizId === request.ownerReceizId
    && source.settledKaiUPulse >= request.requestedKaiUPulse
    ? { ...request, startedAtMs } : null;
}

export type WildsHuntAnimationFrame = { active: boolean; flight: number; impact: number; scale: number; lean: number; lift: number };
export function createWildsHuntAnimationFrame(): WildsHuntAnimationFrame {
  return { active: false, flight: 0, impact: 0, scale: 1, lean: 0, lift: 0 };
}
/** One bounded presentation clock; it never schedules or postpones gameplay actions. */
export function writeWildsHuntAnimationFrame(out: WildsHuntAnimationFrame, elapsedMs: number, reducedMotion = false) {
  out.active = elapsedMs >= 0 && elapsedMs < WILDS_HUNT_PRESENTATION_MS;
  out.flight = reducedMotion ? 1 : Math.max(0, Math.min(1, elapsedMs / 280));
  out.impact = !reducedMotion && elapsedMs >= 280 && elapsedMs < 580 ? Math.sin((elapsedMs - 280) / 300 * Math.PI) : 0;
  const dissolve = Math.max(0, Math.min(1, (elapsedMs - 580) / 320));
  out.scale = !out.active ? 0 : reducedMotion ? 1 : 1 - dissolve * dissolve * (3 - 2 * dissolve);
  out.lean = out.impact ? -out.impact * .45 : 0;
  out.lift = out.impact * .035;
  return out;
}
