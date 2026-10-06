import test from 'node:test';
import assert from 'node:assert/strict';
import { drawWildsFauna, type WildsFaunaDraw } from '../src/features/play/wilds-fauna-model';
import { createWildsAppleGeometry, createWildsFoodLeafGeometry, createWildsNourishmentTexture } from '../src/features/play/wilds-nourishment-materials';
import type { WildsAnimalSpecies } from '../src/features/play/wilds-animal-ecology';

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
