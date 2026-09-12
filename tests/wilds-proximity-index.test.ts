import assert from "node:assert/strict";
import { test } from "node:test";
import { createWildsProximityIndex } from "../src/features/play/wilds-proximity-index";

test("indexed nearby objects match exact radius filtering across positive and negative cell boundaries", () => {
  const points = Array.from({ length: 2500 }, (_, i) => ({ id: `point:${i}`, position: { x: (i % 50 - 25) * 16, z: (Math.floor(i / 50) - 25) * 16 } }));
  const index = createWildsProximityIndex(points, item => item.id);
  for (const position of [{x:0,z:0}, {x:63.9,z:64}, {x:64,z:64}, {x:-64.01,z:-1}, {x:400,z:-400}]) {
    const expected = points.filter(p => Math.hypot(p.position.x-position.x,p.position.z-position.z) <= 110).sort((a,b)=>a.id.localeCompare(b.id));
    assert.deepEqual(index.near(position), expected);
  }
});

test("movement within a cell reuses candidates and still checks the exact 110 metre boundary", () => {
  const inside = {id:"inside",position:{x:110,z:0}}, outside = {id:"outside",position:{x:110.1,z:0}};
  const index = createWildsProximityIndex([inside,outside], item=>item.id);
  assert.deepEqual(index.near({x:0,z:0}), [inside]);
  assert.deepEqual(index.near({x:0.2,z:0}), [inside,outside]);
  assert.equal(index.stats().candidateBuilds, 1);
  index.near({x:64,z:0});
  assert.equal(index.stats().candidateBuilds, 2);
  assert.deepEqual(index.near({x:NaN,z:0}), []);
});
