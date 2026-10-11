import assert from 'node:assert/strict';
import {test} from 'node:test';
import {NextRequest} from 'next/server';
import {GET} from '../app/api/wilds/clearance/source/route';
import {createWildsClearancePublicSdkV128} from '../src/lib/receiz/wilds-clearance-public-read-v128';
test('public clearance route forwards only fixed GET URLs without wallet or request credentials',async()=>{
 const original=globalThis.fetch,client=process.env.RECEIZ_CLIENT_ID,base=process.env.RECEIZ_BASE_URL;
 process.env.RECEIZ_CLIENT_ID='rc_SyntheticClient_ABC-123';process.env.RECEIZ_BASE_URL='https://receiz.com';
 const calls:{url:string;init?:RequestInit}[]=[];
 globalThis.fetch=async(url,init)=>{calls.push({url:String(url),init});return Response.json({ok:true,record:null});};
 const request=(query='')=>new NextRequest('https://wildz.quest/api/wilds/clearance/source'+query,{headers:{authorization:'fixture-never-forward',cookie:'fixture-never-forward'}});
 try{
  const configuration=await (await GET(request())).json();
  assert.doesNotThrow(()=>createWildsClearancePublicSdkV128(configuration));
  assert.deepEqual(configuration,{applicationId:'wildz'});assert.equal(calls.length,0);
  for(const query of ['?url=https://attacker.test/a','?url=https://wildz.quest/receiz/market-source-v128','?url=https://wildz.quest/receiz/resource-source-v128&extra=1'])assert.equal((await GET(request(query))).status,400);
  assert.equal(calls.length,0);assert.equal((await GET(request('?url='+encodeURIComponent('https://wildz.quest/receiz/resource-source-v128')))).status,200);
  assert.equal(calls.length,1);assert.equal(new URL(calls[0].url).pathname,'/api/public-proof/by-url');assert.equal(calls[0].init?.method,'GET');
  const headers=new Headers(calls[0].init?.headers);assert.equal(headers.has('authorization'),false);assert.equal(headers.has('cookie'),false);assert.equal(calls[0].init?.redirect,'error');
 }finally{globalThis.fetch=original;if(client===undefined)delete process.env.RECEIZ_CLIENT_ID;else process.env.RECEIZ_CLIENT_ID=client;if(base===undefined)delete process.env.RECEIZ_BASE_URL;else process.env.RECEIZ_BASE_URL=base;}
});
