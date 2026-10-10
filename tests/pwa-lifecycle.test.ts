import assert from "node:assert/strict";
import {test} from "node:test";
import {recordWildzLifecycle, readWildzLifecycle, WILDZ_LIFECYCLE_KEY} from "../src/features/pwa/pwa-lifecycle";

function store() {let saved = "";return {getItem:()=>saved,setItem:(key:string,value:string)=>{assert.equal(key,WILDZ_LIFECYCLE_KEY);saved=value;},raw:()=>saved};}
test("restart evidence distinguishes explicit updates and browser discards without diagnosing unexplained restarts as memory pressure",()=>{
 const storage=store();
 assert.equal(recordWildzLifecycle({event:"boot",at:1,navigation:"navigate"},storage).restart,"first-known-start");
 recordWildzLifecycle({event:"requested-reload",reason:"apply-update",at:2},storage);
 recordWildzLifecycle({event:"hidden",at:2.1},storage);
 recordWildzLifecycle({event:"pagehide",at:2.2},storage);
 assert.equal(recordWildzLifecycle({event:"boot",at:3,navigation:"reload"},storage).restart,"requested-reload");
 recordWildzLifecycle({event:"visible",at:4},storage);
 assert.equal(recordWildzLifecycle({event:"boot",at:5,navigation:"reload"},storage).restart,"unexplained-restart");
 assert.equal(recordWildzLifecycle({event:"boot",at:6,wasDiscarded:true},storage).restart,"browser-reported-discard");
 recordWildzLifecycle({event:"pagehide",at:7,persisted:false},storage);
 assert.equal(recordWildzLifecycle({event:"boot",at:8},storage).restart,"previous-pagehide");
});
test("lifecycle diagnostics stay bounded and cannot retain game, identity, URL or caller-shaped fields",()=>{
 const storage=store();
 for(let at=0;at<100;at++)recordWildzLifecycle({event:"graphics-context-lost",at,geometries:70,textures:6,...{secret:"private",url:"?accessToken=private",game:{inventory:["private"]}}},storage);
 assert.equal(readWildzLifecycle(storage).length,12);
 assert.equal(storage.raw().includes("private"),false);
 assert.ok(storage.raw().length<4000);
 const malformed={getItem:()=>"{bad",setItem:()=>{throw Error("quota");}};
 assert.equal(recordWildzLifecycle({event:"boot",at:1},malformed).restart,"first-known-start");
});
