import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createWildsClearancePublicWorkerReader} from '../src/features/play/wilds-clearance-public-worker-client';
class WorkerFixture extends EventTarget {
 static instances:WorkerFixture[]=[];terminated=0;requests:{id:number}[]=[];
 constructor(){super();WorkerFixture.instances.push(this);}
 postMessage(value:{id:number}){this.requests.push(value);}
 terminate(){this.terminated++;}
 reply(value:unknown,unchanged=false){this.dispatchEvent(new MessageEvent('message',{data:{id:this.requests.at(-1)!.id,ok:true,value,unchanged}}));}
}
test('public worker coalesces reads, reuses compact projections and releases idle or cancelled workers',async()=>{
 const original=globalThis.Worker;globalThis.Worker=WorkerFixture as unknown as typeof Worker;
 try{
  const reader=createWildsClearancePublicWorkerReader(),one=reader.read(),same=reader.read(),worker=WorkerFixture.instances.at(-1)!;
  assert.equal(one,same);assert.equal(worker.requests.length,1);worker.reply({buildingClearances:{},clearanceTaken:{}});const compact=await one;
  const two=reader.read();worker.reply(null,true);assert.equal(await two,compact);reader.dispose();assert.equal(worker.terminated,1);
  const controller=new AbortController(),pending=reader.read(controller.signal),next=WorkerFixture.instances.at(-1)!;controller.abort();await assert.rejects(pending,/cancelled/);assert.equal(next.terminated,1);
  const last=reader.read();const third=WorkerFixture.instances.at(-1)!;reader.dispose();await assert.rejects(last,/cancelled/);assert.equal(third.terminated,1);
 }finally{globalThis.Worker=original;}
});
