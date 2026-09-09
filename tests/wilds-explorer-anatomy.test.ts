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
