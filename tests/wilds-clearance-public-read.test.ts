import assert from 'node:assert/strict';
import {test} from 'node:test';
import '../src/lib/receiz/wilds-clearance-public-read-v128';
const path='../src/lib/receiz/wilds-clearance-public-read-v128.js';
async function load(){const api=await import(path).catch(()=>({}));assert.equal(typeof api.createWildsClearancePublicSdkV128,'function','display needs a signer-free fixed source read port');return api;}
test('public pile reads use only the fixed resource Original URL and no identity/cookies',async()=>{
 const api=await load(),calls:{url:string;init?:RequestInit}[]=[];
 const sdk=api.createWildsClearancePublicSdkV128({applicationId:'fixture',fetcher:async(url:string,init?:RequestInit)=>{calls.push({url,init});return Response.json({ok:true,record:null});}});
 await sdk.publicStore.restoreLatest({url:'https://wildz.quest/receiz/resource-source-v128',tenantHost:'wildz.quest'});
 assert.equal(calls.length,1);assert.match(calls[0].url,/^\/api\/wilds\/clearance\/source\?url=/);assert.equal(calls[0].init?.credentials,'omit');assert.equal(calls[0].init?.method,'GET');assert.equal(new Headers(calls[0].init?.headers).has('authorization'),false);
});
test('public pile transport refuses other namespaces, arbitrary URLs and all write methods',async()=>{
 const api=await load();for(const url of ['https://attacker.example/source','https://wildz.quest/receiz/market-source-v128','https://wildz.quest/receiz/resource-source-v128/pages/abc'])assert.equal(api.isWildsClearancePublicUrlV128(url),false);
 assert.equal(api.isWildsClearancePublicUrlV128('https://wildz.quest/receiz/resource-source-v128/pages/'+'a'.repeat(64)),true);
 const sdk=api.createWildsClearancePublicSdkV128({applicationId:'fixture',fetcher:async()=>{throw Error('unexpected network');}});
 await assert.rejects(sdk.publicStore.restoreLatest({url:'https://attacker.example/source'}),/path_invalid/);
 await assert.rejects(sdk.domains.verifiedReplayV124({applicationId:'fixture',domainId:'wildz.resources.v128',afterHead:null,expectedRegistryDigest:'a'.repeat(64),expectedReducerDigest:'b'.repeat(64)}),/path_invalid/);
});
