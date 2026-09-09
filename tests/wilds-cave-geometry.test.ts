import assert from "node:assert/strict";
import {test} from "node:test";
import {createWildsCaveBatch,naturalWildsCaveWalls} from "../src/features/play/wilds-cave-geometry";
test("cave batch preserves exact physical bounds with one geometry and finite texture coordinates",()=>{
  const boxes=Array.from({length:90},(_,i)=>({center:{x:i*.5,y:-4,z:20},halfExtents:{x:.25,y:.08,z:1.5}}));
  const {geometry,origin}=createWildsCaveBatch(boxes,"floor");
  geometry.computeBoundingBox();
  assert.equal(geometry.groups.length,0,"no separate material draw groups");
  assert.equal(geometry.boundingBox!.min.x+origin.x,-.25);
  assert.equal(geometry.boundingBox!.max.x+origin.x,44.75);
  assert.ok([...geometry.getAttribute("uv").array].every(Number.isFinite));
  geometry.dispose();
});
test("natural cave walls leave overlapping chamber connections open",()=>{
  const floors=[{center:{x:0,y:0,z:0},halfExtents:{x:3,y:.1,z:3}},{center:{x:5,y:0,z:0},halfExtents:{x:3,y:.1,z:3}}];
  const walls=naturalWildsCaveWalls(floors,[]);
  assert.ok(walls.length>0);
  assert.ok(!walls.some(w=>w.center.x>1.5&&w.center.x<3.5&&Math.abs(w.center.z)<2.5),"connection remains clear");
});
