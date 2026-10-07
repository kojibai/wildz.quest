import test from 'node:test';
import assert from 'node:assert/strict';
import { drawWildsFauna, type WildsFaunaDraw } from '../src/features/play/wilds-fauna-model';
import { createWildsAppleGeometry, createWildsFoodLeafGeometry, createWildsNourishmentTexture } from '../src/features/play/wilds-nourishment-materials';
import type { WildsAnimalSpecies } from '../src/features/play/wilds-animal-ecology';
import { projectWildsFaunaMotion } from '../src/features/play/wilds-fauna-motion';
import { KAI_PULSE_DURATION_MS } from '../src/features/play/kai-klok-moment';

function pose(species: WildsAnimalSpecies, gait: number, moving: boolean, grazing=false) {
  const parts: Parameters<WildsFaunaDraw>[]=[];
  drawWildsFauna(species,gait,moving,grazing,(...part)=>parts.push(part));return parts;
}
test('all landscape species have articulated movement rather than rigid sliding',()=>{
  for(const species of ['ground-bird','meadow-goat','hare'] as const) {
    const first=pose(species,0,true),step=pose(species,Math.PI/2,true);
    assert.equal(first.length,step.length);assert.notDeepEqual(first,step);
    assert.deepEqual(pose(species,0,false),pose(species,Math.PI/2,false));
    assert.notDeepEqual(pose(species,0,false),pose(species,0,false,true));
    assert.ok(first.length<64);
    for(const part of first) { assert.ok(part.slice(1,7).every(v=>typeof v==='number'&&Number.isFinite(v)));assert.ok(part.slice(4,7).every(v=>Number(v)>0)); }
  }
});
test('fruit has a stem dimple and locally generated skin, while leaves have curved geometry',()=>{
  const apple=createWildsAppleGeometry(),leaf=createWildsFoodLeafGeometry();
  try {
    const pos=apple.getAttribute('position');
    assert.ok(Array.from({length:pos.count},(_,i)=>pos.getY(i)).every(y=>Math.abs(y)<.95));
    assert.ok(leaf.getAttribute('position').count>6);
    assert.ok(pos.count<256);
    for(const kind of ['coat','fruit','leaf'] as const) {
      const texture=createWildsNourishmentTexture(kind);
      assert.equal(texture.image.width,64);assert.equal(texture.image.height,64);
      assert.ok(new Set(texture.image.data).size>20);texture.dispose();
    }
  } finally {apple.dispose();leaf.dispose();}
});

function livingPose(species: WildsAnimalSpecies, time: number, radius: number) {
  const motion = projectWildsFaunaMotion(`test:${species}`, species, time, radius);
  const parts: Parameters<WildsFaunaDraw>[] = [];
  drawWildsFauna(species, motion.gait, motion.moving, motion.grazing,
    (...part) => parts.push(part), motion.pose);
  return parts;
}
test('resting fauna keep breathing and attending while their planted feet remain stable', () => {
  for (const species of ['ground-bird','meadow-goat','hare'] as const) {
    const first = livingPose(species, 1_234_567_890, 0), next = livingPose(species, 1_234_967_890, 0);
    assert.equal(first.length, next.length);
    assert.notDeepEqual(first, next, `${species} froze while resting`);
    const feet = species === 'meadow-goat' ? '#514b40' : species === 'ground-bird' ? '#b9863b' : '#bcaa8e';
    assert.deepEqual(first.filter(part => part[7] === feet), next.filter(part => part[7] === feet), `${species} shuffled planted feet`);
  }
});

test('slow farm goats and hares visibly lift and advance their feet while travelling', () => {
  for (const species of ['meadow-goat','hare'] as const) {
    const feet = species === 'meadow-goat' ? '#514b40' : '#bcaa8e';
    const positions: number[][] = [];
    for (let index = 0; index < 1_000; index++) {
      const parts = livingPose(species, 100_000_000 + index * 10_000, .35).filter(part => part[7] === feet);
      parts.forEach((part, foot) => (positions[foot] ??= []).push(Number(part[3])));
    }
    assert.ok(positions.some(values => Math.max(...values) - Math.min(...values) > .06), `${species} slid through its farm with almost motionless feet`);
  }
});

test('birds bend both upper and lower legs as their alternating feet step', () => {
  const legs = pose('ground-bird', Math.PI / 2, true).filter(part => part[0] === 'limb' && part[7] === '#c79345');
  assert.equal(legs.length, 4, 'each bird needs an articulated thigh and shin');
  assert.notEqual(legs[0]![8], legs[1]![8], 'the bird knee must bend');
});
test('anatomy blends smoothly between walking, scanning, and feeding instead of snapping head height', () => {
  const interval = Math.round(50 / KAI_PULSE_DURATION_MS * 1_000_000);
  for (const species of ['ground-bird','meadow-goat','hare'] as const) {
    let previous = livingPose(species, 19_900_000, .9);
    for (let i = 1; i < 1000; i++) {
      const next = livingPose(species, 19_900_000 + i * interval, .9);
      for (let part = 0; part < next.length; part++) {
        const eye = ['#24211a','#2f291f','#221f19'].includes(next[part]![7]);
        assert.ok(Math.hypot(Number(next[part]![1]) - Number(previous[part]![1]), Number(next[part]![2]) - Number(previous[part]![2]),
          Number(next[part]![3]) - Number(previous[part]![3])) < (eye ? .055 : .12), `${species} snapped anatomy at part ${part}`);
      }
      previous = next;
    }
  }
});
