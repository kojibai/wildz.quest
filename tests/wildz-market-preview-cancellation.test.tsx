import assert from 'node:assert/strict';
import {test} from 'node:test';
import {WildzMarketCardPreview} from '../src/features/market/WildzMarketCardPreview';
import {mountMutableReact} from './helpers/react-mutation-renderer';

test('leaving a revisited flip preview aborts its current public-object read',async context=>{
 let requestSignal:AbortSignal|undefined;
 context.mock.method(globalThis,'fetch',async (_input:RequestInfo|URL,options?:RequestInit)=>{
  requestSignal=options?.signal??undefined;
  return new Promise<Response>((_resolve,reject)=>requestSignal?.addEventListener('abort',()=>reject(new DOMException('cancelled','AbortError')),{once:true}));
 });
 const card={assetId:`wilds:${'e'.repeat(24)}`,title:'Revisited companion',proofDigest:`sha256:${'f'.repeat(64)}`,ownerHandle:'revisited_preview.receiz.id',claimKaiUPulse:null,claimHead:null};
 const render=(nearby:boolean)=><WildzMarketCardPreview card={card} nearby={nearby} front={<span>Complete front</span>}/>;
 const view=await mountMutableReact(render(false));context.after(()=>view.unmount());
 await view.update(render(true));
 const button=view.nodes().find(node=>node.props?.['aria-label']==='Flip Revisited companion');assert.ok(button);
 (button.props!.onKeyDown as (event:unknown)=>void)({key:'Enter',preventDefault(){},currentTarget:{isConnected:true}});
 for(let frame=0;frame<4;frame++)await view.flush();
 assert.ok(requestSignal);assert.equal(requestSignal.aborted,false);
 await view.unmount();await new Promise<void>(resolve=>setImmediate(resolve));
 assert.equal(requestSignal.aborted,true);
});
