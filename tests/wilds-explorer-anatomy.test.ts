import assert from "node:assert/strict";
import {test} from "node:test";
import {projectWildsExplorerAnatomy} from "../src/features/play/wilds-explorer-anatomy";
import {createWildsExplorerFace,createWildsExplorerTorso} from "../src/features/play/wilds-explorer-face";
test("explorer faces derive deterministically from canonical identity coordinates",()=>{
  assert.deepEqual(projectWildsExplorerAnatomy("Explorer.receiz.id"),projectWildsExplorerAnatomy("@explorer"));
  const profiles=Array.from({length:100},(_,i)=>projectWildsExplorerAnatomy(`explorer_${i}`));
  assert.equal(new Set(profiles.map(p=>JSON.stringify(p))).size,100);
  assert.ok(profiles.every(p=>p.jaw>=.76&&p.jaw<=.98&&p.height>=.98&&p.height<=1.02));
});
test("detailed faces stay batched and remote geometry uses fewer vertices",()=>{
  const anatomy=projectWildsExplorerAnatomy("explorer");
  const local=createWildsExplorerFace(anatomy,"#b97856","#241a17"),remote=createWildsExplorerFace(anatomy,"#b97856","#241a17",true),body=createWildsExplorerTorso(anatomy);
  assert.equal(local.groups.length,0);assert.equal(remote.groups.length,0);
  assert.ok(local.getAttribute("position").count>remote.getAttribute("position").count);
  assert.ok(local.getAttribute("color").count===local.getAttribute("position").count);
  for(const geometry of [local,remote,body]){assert.ok([...geometry.getAttribute("position").array].every(Number.isFinite));geometry.dispose();}
});

test("explorer eyelids can fully close in the existing face draw without changing skull vertices", () => {
  const geometry = createWildsExplorerFace(projectWildsExplorerAnatomy("alder"), "#b97856", "#241a17");
  const positions = geometry.getAttribute("position");
  const closed = geometry.getAttribute("faceClosed");
  assert.ok(closed, "face geometry needs its closed eyelid pose");
  assert.equal(closed.count, positions.count);
  let changed = 0;
  for (let i = 0; i < positions.count; i++) {
    assert.ok(Number.isFinite(closed.getY(i)));
    if (Math.abs(closed.getY(i) - positions.getY(i)) > .0001) changed++;
    if (positions.getY(i) > .12) assert.equal(closed.getY(i), positions.getY(i));
  }
  assert.ok(changed > 40, "both eyelids must have an animated closing surface");
  assert.equal(geometry.groups.length, 0);
  assert.ok(geometry.index!.count / 3 <= 2348, "facial detail must fit the previous local triangle budget");
  geometry.dispose();
});

test("new facial detail remains stable across canonical identity aliases and differs across explorers", () => {
  const anatomy = projectWildsExplorerAnatomy("Explorer.receiz.id");
  assert.ok("detail" in anatomy, "explorer should have individual facial detail");
  assert.deepEqual(anatomy, projectWildsExplorerAnatomy("@explorer"));
  const profiles = Array.from({ length: 256 }, (_, i) => projectWildsExplorerAnatomy(`face_${i}`));
  assert.ok(profiles.every(p => "detail" in p));
  assert.equal(new Set(profiles.map(p => JSON.stringify((p as typeof anatomy).detail))).size, 256);
});
