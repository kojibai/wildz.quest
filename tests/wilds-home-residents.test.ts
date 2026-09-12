import test from "node:test";
import assert from "node:assert/strict";
import { projectWildsHomeResidents } from "../src/features/play/wilds-home-residents";
const base = { candidates:[{id:"c"},{id:"b"},{id:"a"},{id:"active"},{id:"foreign"}],ownedIds:["a","b","c","active"],excludedIds:["active"],shelterPosition:{x:0,z:0},player:{x:0,z:0},spaceId:"wildz.space.outer.v1" };
test("home residents cap at two owned companions and exclude active/support cards",()=>{
  assert.deepEqual(projectWildsHomeResidents(base).map(c=>c.id),["a","b"]);
  assert.deepEqual(projectWildsHomeResidents({...base,excludedIds:["active","a","b"]}).map(c=>c.id),["c"]);
  assert.deepEqual(projectWildsHomeResidents({...base,candidates:[{id:"a"},{id:"a"},{id:"foreign"}]}).map(c=>c.id),["a"]);
});
test("home residents unmount out of range or in interiors",()=>{
  assert.equal(projectWildsHomeResidents({...base,player:{x:30.1,z:0}}).length,0);
  assert.equal(projectWildsHomeResidents({...base,spaceId:"cave"}).length,0);
  assert.equal(projectWildsHomeResidents({...base,player:{x:NaN,z:0}}).length,0);
  assert.equal(projectWildsHomeResidents({...base,player:{x:30,z:0}}).length,2);
});
