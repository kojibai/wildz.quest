import assert from "node:assert/strict";
import {test} from "node:test";
import {createWorkerWorkQueue} from "../src/features/play/worker-work-queue";
test("closed-panel work is skipped and heavy worker jobs never overlap across panel sessions",async()=>{
 const queue=createWorkerWorkQueue();let release!:()=>void;const blocked=new Promise<void>(resolve=>{release=resolve;});
 let live=0,maximum=0;const started:string[]=[];
 const first=queue(async()=>{started.push("first");maximum=Math.max(maximum,++live);await blocked;live--;});
 const canceled=queue(async()=>{started.push("closed");},()=>true);
 const next=queue(async()=>{started.push("next");maximum=Math.max(maximum,++live);live--;return 3;});
 await Promise.resolve();assert.deepEqual(started,["first"]);release();await first;assert.equal(await canceled,undefined);assert.equal(await next,3);
 assert.equal(maximum,1);assert.deepEqual(started,["first","next"]);
 await assert.rejects(queue(async()=>{throw Error("failed");}),/failed/);
 assert.equal(await queue(async()=>4),4);
});
