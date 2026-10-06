import test from 'node:test';
import assert from 'node:assert/strict';
import { projectWildsWildAnimalPosition, wildsWildAnimalsForTile, type WildsWildAnimal } from '../src/features/play/wilds-animal-ecology';
import { KAI_N_DAY_MICRO, KAI_PULSE_DURATION_MS } from '../src/features/play/kai-klok-moment';

const animals: WildsWildAnimal[] = [];
for (let z = -4; z <= 4; z++) for (let x = -4; x <= 4; x++) animals.push(...wildsWildAnimalsForTile(x, z));
const species = ['ground-bird', 'meadow-goat', 'hare'] as const;
const base = Number(KAI_N_DAY_MICRO) * 100;
const distance = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

test('wildlife does not replay the former fourteen-breath route or its longer combined cycle', () => {
  for (const kind of species) {
    const animal = animals.find(a => a.species === kind)!;
    for (const formerPeriod of [14_000_000, 140_000_000]) {
      const route = Array.from({ length: 24 }, (_, i) => projectWildsWildAnimalPosition(animal, base + i * 250_000).position);
      const later = Array.from({ length: 24 }, (_, i) => projectWildsWildAnimalPosition(animal, base + formerPeriod + i * 250_000).position);
      assert.ok(route.some((p, i) => distance(p, later[i]!) > .05), `${kind} replayed a fixed ${formerPeriod / 1_000_000}-breath route`);
    }
  }
});

test('full animal identity distinguishes movement even in the same habitat', () => {
  for (const kind of species) {
    const peers = animals.filter(a => a.species === kind && a.animalId.endsWith(':0'));
    assert.ok(peers.length >= 2);
    const first = peers[0]!, second = { ...peers[1]!, anchor: first.anchor };
    let distinct = 0;
    for (let i = 0; i < 40; i++) {
      if (distance(projectWildsWildAnimalPosition(first, base + i * 300_000).position,
        projectWildsWildAnimalPosition(second, base + i * 300_000).position) > .02) distinct++;
    }
    assert.ok(distinct > 20, `${kind} synchronized unrelated individuals`);
  }
});

test('direct restoration and skipped frames select the same absolute Kai animal motion', () => {
  const animal = animals[0]!, when = base + 71_234_567;
  const direct = projectWildsWildAnimalPosition(animal, when);
  for (const pulse of [when + 100_000_000, 0, when - 5_000_000, Number.MAX_SAFE_INTEGER]) projectWildsWildAnimalPosition(animal, pulse);
  assert.deepEqual(projectWildsWildAnimalPosition(animal, when), direct);
});

test('visible movement and heading remain continuous across pauses, Kai days, and old loop seams', () => {
  const interval = Math.round(50 / KAI_PULSE_DURATION_MS * 1_000_000);
  for (const kind of species) {
    const animal = animals.find(a => a.species === kind)!;
    for (const start of [base - 1_000_000, 19_900_000, base + 7_000_000]) {
      let previous = projectWildsWildAnimalPosition(animal, start);
      for (let i = 1; i < 1200; i++) {
        const next = projectWildsWildAnimalPosition(animal, start + interval * i);
        assert.ok(distance(previous.position, next.position) < .1, `${kind} teleported`);
        const turn = Math.atan2(Math.sin(next.heading - previous.heading), Math.cos(next.heading - previous.heading));
        assert.ok(Math.abs(turn) < .35, `${kind} snapped its heading`);
        previous = next;
      }
    }
  }
});
