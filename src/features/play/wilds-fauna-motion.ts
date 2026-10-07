import { KAI_BREATH_INHALE_SHARE, KAI_PULSE_DURATION_MS } from './kai-klok-moment';
import type { WildsAnimalSpecies } from './wilds-animal-ecology';

const PHI = (1 + Math.sqrt(5)) / 2;
const TAU = Math.PI * 2;
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const ease = (n: number) => { const t = clamp(n); return t * t * t * (t * (t * 6 - 15) + 10); };
const derivative = (n: number) => n <= 0 || n >= 1 ? 0 : 30 * n * n * (n - 1) * (n - 1);
type Point = Readonly<{ x: number; z: number }>;
type Curve = Readonly<{ points: readonly Point[]; distances: Float64Array; length: number }>;
const seeds = new Map<string, number>();
const curves = new Map<string, Curve>();
function seedFor(id: string) {
  const cached = seeds.get(id); if (cached !== undefined) return cached;
  let seed = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) seed = Math.imul(seed ^ id.charCodeAt(i), 0x01000193);
  seeds.set(id, seed);
  while (seeds.size > 256) seeds.delete(seeds.keys().next().value!);
  return seed;
}
/** Include both index words: truncating absolute time to uint32 would reintroduce a time loop. */
function unit(seed: number, index: number, salt: number) {
  let n = Math.imul(seed ^ (index >>> 0) ^ salt, 0x85ebca6b);
  n ^= Math.imul(Math.floor(index / 0x1_0000_0000), 0x9e3779b9);
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  n = Math.imul(n ^ (n >>> 15), 0x846ca68b);
  return ((n ^ (n >>> 16)) >>> 0) / 0xffff_ffff;
}
function field(at: number, seed: number, salt: number) {
  const index = Math.floor(at), blend = ease(at - index);
  return (unit(seed, index, salt) * (1 - blend) + unit(seed, index + 1, salt) * blend) * 2 - 1;
}
function fieldDerivative(at: number, seed: number, salt: number) {
  const index = Math.floor(at);
  return (unit(seed, index + 1, salt) - unit(seed, index, salt)) * 2 * derivative(at - index);
}
function point(seed: number, index: number, salt: number): Point {
  const angle = unit(seed, index, salt) * TAU;
  const radius = Math.sqrt(unit(seed, index, salt + 1)) * .94;
  return { x: Math.sin(angle) * radius, z: Math.cos(angle) * radius };
}
function blend(a: Point, b: Point, amount: number): Point {
  return { x: a.x + (b.x - a.x) * amount, z: a.z + (b.z - a.z) * amount };
}
function onCurve(points: readonly Point[], t: number): Point {
  const [a, b, c, d] = points as readonly [Point, Point, Point, Point], u = 1 - t;
  return { x: u ** 3 * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t ** 3 * d.x,
    z: u ** 3 * a.z + 3 * u * u * t * b.z + 3 * u * t * t * c.z + t ** 3 * d.z };
}
function tangent(points: readonly Point[], t: number): Point {
  const [a, b, c, d] = points as readonly [Point, Point, Point, Point], u = 1 - t;
  return { x: 3 * u * u * (b.x - a.x) + 6 * u * t * (c.x - b.x) + 3 * t * t * (d.x - c.x),
    z: 3 * u * u * (b.z - a.z) + 6 * u * t * (c.z - b.z) + 3 * t * t * (d.z - c.z) };
}
function curve(id: string, seed: number, index: number): Curve {
  const key = `${id}|${index}`, cached = curves.get(key); if (cached) return cached;
  const start = point(seed, index, 11), end = point(seed, index + 1, 11);
  // Convex control points keep every curved path within the verified habitat.
  const points = [start, blend(start, end, .3), blend(end, start, .3), end];
  const bend = point(seed, index, 21);
  const bendWeight = Math.min(.2, Math.hypot(start.x - end.x, start.z - end.z) * .12);
  points[1] = blend(points[1]!, bend, bendWeight); points[2] = blend(points[2]!, bend, bendWeight);
  let length = 0, previous = start;
  const distances = new Float64Array(13);
  for (let i = 1; i <= 12; i++) { const next = onCurve(points, i / 12); length += Math.hypot(next.x - previous.x, next.z - previous.z); distances[i] = length; previous = next; }
  const result = { points, distances, length }; curves.set(key, result);
  while (curves.size > 512) curves.delete(curves.keys().next().value!);
  return result;
}

export type WildsFaunaLifePose = Readonly<{
  breath: number; locomotion: number; forage: number; headYaw: number; headPitch: number;
  ear: number; tail: number; blink: number; chew: number; stride: number; variant: number; size: number;
  footActivity?: number;
}>;

/** A random-access simulation from absolute Kai time, not a replaying animation clip.
 * Decisions, breathing, attention and stride variation use independent continuous
 * fields. No frame history, network request, per-breath persistence or wall clock. */
export function projectWildsFaunaMotion(id: string, species: WildsAnimalSpecies, kaiUPulse: number, radius: number) {
  if (!Number.isSafeInteger(kaiUPulse) || kaiUPulse < 0 || !Number.isFinite(radius) || radius < 0) throw Error('wilds_animal_time_invalid');
  const seed = seedFor(id), pulse = kaiUPulse / 1_000_000;
  const span = species === 'ground-bird' ? PHI : species === 'hare' ? PHI * 1.2 : PHI * PHI;
  const clock = pulse / span + unit(seed, 0, 31) + .16 * field(pulse / (span * PHI), seed, 32);
  const index = Math.floor(clock), progress = clock - index;
  const start = .18 + unit(seed, index, 33) * .1, end = .65 + unit(seed, index, 34) * .23;
  const travel = clamp((progress - start) / (end - start)), t = ease(travel);
  const path = curve(id, seed, index), local = onCurve(path.points, t), direction = tangent(path.points, t);
  let heading = Math.atan2(direction.x, direction.z);
  if (progress < start) {
    const before = tangent(curve(id, seed, index - 1).points, 1), previous = Math.atan2(before.x, before.z);
    const turn = Math.atan2(Math.sin(heading - previous), Math.cos(heading - previous));
    heading = previous + turn * ease(progress / start);
  }
  const clockRate = 1 / span + .16 * fieldDerivative(pulse / (span * PHI), seed, 32) / (span * PHI);
  const speed = Math.hypot(direction.x, direction.z) * radius * derivative(travel) * clockRate / (end - start) / (KAI_PULSE_DURATION_MS / 1000);
  // Slow farm travel still needs a full planted-foot step. Blend only at the
  // start/end of movement, rather than damping every stride by walking speed.
  const footActivity = ease(speed / .035);
  const locomotion = ease(speed / (species === 'hare' ? .7 : .45));
  const breathRate = species === 'ground-bird' ? PHI * PHI : species === 'hare' ? PHI : 1;
  const breathClock = pulse * breathRate + unit(seed, 0, 41) + .06 * field(pulse / PHI, seed, 42);
  const phase = breathClock - Math.floor(breathClock);
  const breath = phase < KAI_BREATH_INHALE_SHARE ? ease(phase / KAI_BREATH_INHALE_SHARE)
    : 1 - ease((phase - KAI_BREATH_INHALE_SHARE) / (1 - KAI_BREATH_INHALE_SHARE));
  const forage = (1 - locomotion) * ease((field(pulse / (PHI * PHI), seed, 43) + .8) / 1.4);
  const blinkClock = pulse / PHI + unit(seed, 0, 44), blinkIndex = Math.floor(blinkClock), blinkPhase = blinkClock - blinkIndex;
  const blink = unit(seed, blinkIndex, 45) > .35 && blinkPhase > .45 && blinkPhase < .52
    ? Math.sin((blinkPhase - .45) / .07 * Math.PI) ** 2 : 0;
  const stride = (species === 'meadow-goat' ? .24 : species === 'ground-bird' ? .12 : .3) * PHI
    * Math.max(.2, Math.min(1, radius / .9)) * (1 + .12 * field(pulse / PHI, seed, 46));
  const sample = Math.min(11, Math.floor(t * 12)), blend = t * 12 - sample;
  const travelled = path.distances[sample]! + (path.distances[sample + 1]! - path.distances[sample]!) * blend;
  const gait = unit(seed, index, 47) * TAU + travelled * radius * .62 / stride * TAU;
  const pose: WildsFaunaLifePose = { breath, locomotion, forage, footActivity,
    headYaw: field(pulse / PHI, seed, 48) * .3 * (1 - locomotion * .5),
    headPitch: field(pulse * PHI, seed, 49) * .045, ear: field(pulse * PHI * PHI, seed, 50) * .12,
    tail: field(pulse / PHI, seed, 51) * .22, blink, chew: field(pulse * PHI * PHI, seed, 52) * forage,
    stride, variant: unit(seed, 0, 53), size: .94 + unit(seed, 0, 54) * .12 };
  return { offset: { x: local.x * radius, z: local.z * radius }, heading, speed,
    moving: locomotion > .01, gait, grazing: forage > .55, pose };
}
