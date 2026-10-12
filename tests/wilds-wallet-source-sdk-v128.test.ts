import assert from "node:assert/strict";
import { test } from "node:test";
import { createWildsWalletSourceSdkClientV128,isWildsWalletSourceSdkPathV128,WILDS_WALLET_RESOURCE_SOURCE_URL_V128 } from "../src/features/play/wallet/wilds-wallet-source-sdk-v128";
import {proxyWildsWalletSourceSdkV128,type WildsWalletSourceSdkProxyDependenciesV128} from '../src/lib/receiz/wilds-wallet-source-sdk-runtime';
import {NextRequest} from 'next/server';
import {ReceizHttpError,sha256ReceizBytes,transportReceizSealedArtifactV124} from '@receiz/sdk';

test("source transport is inert until a real published SDK request and keeps the exact registered application/token/idempotency",async()=>{
 const calls:Array<{url:string;init:RequestInit}>=[];
 const sdk=createWildsWalletSourceSdkClientV128({applicationId:"registered-wildz-client",accessToken:"actual-scoped-token",fetcher:async(url,init)=>{calls.push({url:String(url),init:init!});return Response.json({ok:true});}});
 assert.equal(calls.length,0);
 const body={applicationId:"registered-wildz-client",authoritySessionHandle:"actual-native-session",sourceArtifact:{exactBytesB64u:"c291cmNl"}};
 await sdk.request("/api/sdk/v1/sources/publish?applicationId=registered-wildz-client",{method:"POST",body,headers:{"x-idempotency-key":"same-source-attempt"}});
 assert.equal(calls[0]?.url,"/api/wilds/wallet/source-sdk");assert.equal(calls[0]?.init.credentials,"same-origin");assert.equal(calls[0]?.init.cache,"no-store");
 assert.deepEqual(JSON.parse(String(calls[0]?.init.body)),{path:"/api/sdk/v1/sources/publish",query:"applicationId=registered-wildz-client",method:"POST",body});
 assert.equal(new Headers(calls[0]?.init.headers).get("authorization"),"Bearer actual-scoped-token");
 assert.equal(new Headers(calls[0]?.init.headers).get("x-idempotency-key"),"same-source-attempt");
});

test("source bridge allows only the published purpose-bound paths and fixed public locator",async()=>{
 assert.equal(isWildsWalletSourceSdkPathV128(`/api/sdk/v1/subjects/receiz%3Asubject%3A${"a".repeat(64)}/state`,"GET","applicationId=registered-client"),true);
 assert.equal(isWildsWalletSourceSdkPathV128("/api/public-proof/by-url","GET",new URLSearchParams({url:WILDS_WALLET_RESOURCE_SOURCE_URL_V128}).toString()),true);
 for(const [path,method,query] of [["/api/sdk/v1/value/execute","POST",""],["/api/receiz/ownership/bearer-claim","POST",""],["/api/sdk/v1/subjects/admit","GET",""],["/api/sdk/v1/sources/publish","POST","applicationId=own&applicationId=other"],["/api/public-proof/by-url","GET",new URLSearchParams({url:"https://other.invalid/private"}).toString()],["/api/public-proof/registry/feed","POST","token=arbitrary"]])assert.equal(isWildsWalletSourceSdkPathV128(path!,method!,query!),false);
 let calls=0;const sdk=createWildsWalletSourceSdkClientV128({applicationId:"actual-client",fetcher:async()=>{calls++;return Response.json({});}});
 await assert.rejects(sdk.request("/api/sdk/v1/value/execute",{method:"POST",body:{}}),/path_invalid/);
 await assert.rejects(sdk.request("https://other.invalid/api/sdk/v1/subjects/admit",{method:"POST",body:{}}),/path_invalid/);
 assert.equal(calls,0);
});

test("market source discovery permits its fixed native source locator without opening arbitrary URL access",()=>{
 assert.equal(isWildsWalletSourceSdkPathV128("/api/public-proof/by-url","GET",new URLSearchParams({url:"https://wildz.quest/receiz/market-source-v128"}).toString()),true);
 assert.equal(isWildsWalletSourceSdkPathV128("/api/public-proof/by-url","GET",new URLSearchParams({url:"https://wildz.quest/receiz/market-source-v128?private=1"}).toString()),false);
});
test("market archive discovery permits only a content-addressed page below the fixed public namespace",()=>{
 const allowed=`https://wildz.quest/receiz/market-source-v128/pages/${"a".repeat(64)}`;
 assert.equal(isWildsWalletSourceSdkPathV128("/api/public-proof/by-url","GET",new URLSearchParams({url:allowed}).toString()),true);
 for(const url of [allowed+"?private=1",allowed+"/extra",allowed.replace("a".repeat(64),"A".repeat(64)),allowed.replace("/pages/","/private/")])assert.equal(isWildsWalletSourceSdkPathV128("/api/public-proof/by-url","GET",new URLSearchParams({url}).toString()),false);
});

test("the native sealer retains the exact SDK multipart file and cannot smuggle a route/body field",async()=>{
 let forwarded:FormData|undefined;
 const sdk=createWildsWalletSourceSdkClientV128({applicationId:"actual-client",fetcher:async(_url,init)=>{forwarded=init?.body as FormData;return Response.json({});}});
 const file=new File([new Uint8Array([1,2,3])],"exact-source.json",{type:"application/json"}),form=new FormData();form.set("file",file);
 await sdk.request("/api/sdk/v1/assets/seal",{method:"POST",body:form});
 assert.deepEqual(new Uint8Array(await (forwarded!.get("file") as File).arrayBuffer()),new Uint8Array([1,2,3]));
 assert.equal(forwarded?.get("wildzSdkPath"),"/api/sdk/v1/assets/seal");assert.equal(forwarded?.get("wildzSdkMethod"),"POST");
});

test('SDK issuance verification reaches only the exact same-origin document verifier with its unchanged artifact File',async()=>{
 const calls:Array<{url:string;init:RequestInit}>=[],sdk=createWildsWalletSourceSdkClientV128({applicationId:'actual-client',baseUrl:'https://native.example',accessToken:'private-token',fetcher:async(url,init)=>{calls.push({url:String(url),init:init!});return Response.json({ok:false,errors:['test-verification-denial']});}});
 const form=new FormData();form.set('file',new File([new Uint8Array([4,5,6])],'issued.receizbundle',{type:'application/vnd.receiz.bundle+json'}));
 await sdk.request('/api/document-verify',{method:'POST',body:form});
 assert.equal(calls[0]?.url,'/api/document-verify');assert.equal(calls[0]?.init.body,form);assert.equal(calls[0]?.init.credentials,'same-origin');assert.equal(calls[0]?.init.redirect,'error');assert.equal(new Headers(calls[0]?.init.headers).has('authorization'),false);
 const file=(calls[0]?.init.body as FormData).get('file') as File;assert.equal(file.name,'issued.receizbundle');assert.equal(file.type,'application/vnd.receiz.bundle+json');assert.deepEqual(new Uint8Array(await file.arrayBuffer()),new Uint8Array([4,5,6]));
 for(const path of ['https://other.example/api/document-verify','/api/document-verify?applicationId=actual-client','/api/document-verify/extra'])await assert.rejects(sdk.request(path,{method:'POST',body:form}),/path_invalid/);
 for(const body of [JSON.stringify({file:'forged'}),(()=>{const changed=new FormData();changed.set('file','forged');return changed;})(),(()=>{const changed=new FormData();changed.set('file',file);changed.append('file',file);return changed;})(),(()=>{const changed=new FormData();changed.set('file',file);changed.set('wildzSdkPath','/private');return changed;})()])await assert.rejects(sdk.request('/api/document-verify',{method:'POST',body}),/file_required/);
 await assert.rejects(sdk.request('/api/document-verify',{method:'GET'}),/path_invalid/);assert.equal(calls.length,1);
});

test('actual SDK sealing keeps its native Accept header and exposes sanitized rejection diagnostics with the SDK error as cause',async()=>{
 let sent:RequestInit|undefined;const sdk=createWildsWalletSourceSdkClientV128({applicationId:'actual-client',accessToken:'private-token',fetcher:async(_url,init)=>{sent=init;return Response.json({error:'SEAL_PERMISSION_DENIED',private:'private-token payload-secret'},{status:403});}});
 await assert.rejects(sdk.assets.createProofObject({assetType:'proof_object',payload:{bytes:new Uint8Array([1]),mimeType:'application/json'}},{idempotencyKey:'exact-seal-attempt',filename:'wildz-resource-actor-test.receizbundle'}),cause=>{
  assert.ok(cause instanceof Error);assert.match(cause.message,/source-actor-seal/);assert.match(cause.message,/403/);assert.match(cause.message,/SEAL_PERMISSION_DENIED/);assert.doesNotMatch(cause.message,/private-token|payload-secret/);assert.ok(cause.cause instanceof Error);assert.equal(cause.cause.message,'artifact_seal_failed');return true;
 });
 assert.equal(new Headers(sent?.headers).get('accept'),'application/vnd.receiz.bundle+json, application/octet-stream');assert.equal(new Headers(sent?.headers).get('x-idempotency-key'),'exact-seal-attempt');
 const file=(sent?.body as FormData).get('file') as File;assert.equal(file.name,'wildz-resource-actor-test.receizbundle');assert.equal(file.type,'application/json');assert.deepEqual(new Uint8Array(await file.arrayBuffer()),new Uint8Array([1]));
});

test('native record rejection preserves its precise status and code alongside the original SDK record error',async()=>{
 const sdk=createWildsWalletSourceSdkClientV128({applicationId:'actual-client',fetcher:async()=>Response.json({error:'record_continuity_failed'},{status:502})});
 await assert.rejects(sdk.assets.createProofObject({assetType:'proof_object',payload:{bytes:new Uint8Array([1]),mimeType:'application/json'}},{idempotencyKey:'record-denial',filename:'wildz-resource-actor-test.receizbundle'}),cause=>{assert.ok(cause instanceof Error);assert.match(cause.message,/source-actor-seal.*502.*record_continuity_failed/);assert.ok(cause.cause instanceof Error);assert.equal(cause.cause.message,'artifact_record_failed');return true;});
});

test('valid native issuance uses the released SDK gate and retains the exact returned bytes and bound payload metadata',async()=>{
 const payload=new Uint8Array([1,2,3]),artifact=new Uint8Array([7,8,9]),payloadDigest=await sha256ReceizBytes(payload),paths:string[]=[];
 // Native sealing/verification are the external boundary. The real SDK still
 // validates owner, claim, Signature V4, integrity and exact payload binding.
 const sdk=createWildsWalletSourceSdkClientV128({applicationId:'actual-client',fetcher:async(url,init)=>{paths.push(String(url));if(String(url)==='/api/document-verify'){
  const file=(init?.body as FormData).get('file') as File;assert.deepEqual(new Uint8Array(await file.arrayBuffer()),artifact);
  return Response.json({ok:true,kind:'bundle',integrity:{ok:true,errors:[]},errors:[],warnings:[],bundle:{signatureV4:{version:1},nativeRecordSeal:{schema:'receiz.native_record_seal.v1',ownerReceizId:'owner.receiz.id',recordId:'record:test',payload:{filename:'source.json',mimeType:'application/json',sha256:payloadDigest}},receizClaimId:'claim:test',verifyPath:'/v/test',artifactSha256Basis:payloadDigest}});
 }return new Response(artifact,{headers:{'content-type':'application/vnd.receiz.bundle+json','content-disposition':'attachment; filename="actual.receizbundle"','x-receiz-continuity':'native-record-seal','x-receiz-owner':'owner.receiz.id','x-receiz-record-id':'record:test','x-receiz-claim-id':'claim:test','x-receiz-verify-path':'/v/test','x-receiz-signature-version':'4'}});}});
 const result=await sdk.assets.createProofObject({assetType:'proof_object',payload:{bytes:payload,mimeType:'application/json'}},{idempotencyKey:'native-bound-fixture',filename:'source.json'});
 assert.deepEqual(paths,['/api/wilds/wallet/source-sdk','/api/document-verify']);assert.equal(result.kind,'receiz.native-record-seal');assert.equal(result.payloadSha256,payloadDigest);assert.equal(result.continuity.ownerReceizId,'owner.receiz.id');assert.deepEqual(new Uint8Array(await result.artifact.arrayBuffer()),artifact);
 assert.equal((await transportReceizSealedArtifactV124(result)).artifactSha256,await sha256ReceizBytes(artifact));
});

test('concurrent SDK seal failures retain their own diagnostics and never expose an arbitrary upstream message',async()=>{
 const sdk=createWildsWalletSourceSdkClientV128({applicationId:'actual-client',fetcher:async(_url,init)=>{const key=new Headers(init?.headers).get('x-idempotency-key');await Promise.resolve();return Response.json({error:key==='first-attempt'?'FIRST_DENIAL':'private-key=secret raw body'},{status:key==='first-attempt'?401:503});}});
 const results=await Promise.allSettled(['first-attempt','second-attempt'].map(idempotencyKey=>sdk.assets.createProofObject({assetType:'proof_object',payload:{bytes:new Uint8Array([1]),mimeType:'application/json'}},{idempotencyKey,filename:'wildz-market-custody-test.receizbundle'})));
 for(const result of results)assert.equal(result.status,'rejected');
 const first=(results[0] as PromiseRejectedResult).reason as Error,second=(results[1] as PromiseRejectedResult).reason as Error;assert.match(first.message,/401.*FIRST_DENIAL/);assert.match(second.message,/503/);assert.doesNotMatch(second.message,/FIRST_DENIAL|private-key|secret|raw body/);
});

test('a binary native seal response reaches SDK issuance verification and its actual verification denial remains authoritative',async()=>{
 const paths:string[]=[],sdk=createWildsWalletSourceSdkClientV128({applicationId:'actual-client',fetcher:async(url)=>{paths.push(String(url));if(String(url)==='/api/document-verify')return Response.json({ok:false,errors:['fixture-verification-denial'],warnings:[]},{status:422});return new Response(new Uint8Array([7,8,9]),{headers:{'content-type':'application/vnd.receiz.bundle+json','content-disposition':'attachment; filename="actual.receizbundle"','x-receiz-continuity':'native-record-seal','x-receiz-owner':'owner.receiz.id','x-receiz-record-id':'record:test','x-receiz-claim-id':'claim:test','x-receiz-verify-path':'/v/test','x-receiz-signature-version':'4'}});}});
 await assert.rejects(sdk.assets.createProofObject({assetType:'proof_object',payload:{bytes:new Uint8Array([1]),mimeType:'application/json'}},{idempotencyKey:'binary-native-response',filename:'wildz-resource-actor-test.receizbundle'}),cause=>{assert.ok(cause instanceof Error);assert.match(cause.message,/issued-artifact-verification.*422/);assert.ok(cause.cause instanceof Error);assert.equal(cause.cause.message,'artifact_verification_failed');return true;});
 assert.deepEqual(paths,['/api/wilds/wallet/source-sdk','/api/document-verify']);
});

function proxyFixture(native:Response,grantDenied:unknown=false){
 const diagnostics:unknown[]=[],calls:Array<{url:string;init:RequestInit}>=[],grants:unknown[]=[];
 const dependencies:WildsWalletSourceSdkProxyDependenciesV128={applicationId:()=> 'registered-client',resolveContext:async()=>({authority:{ownerReceizId:'current-account',profileHandle:'owner.receiz.id'},proof:{keyId:'a'.repeat(64)},session:{origin:'https://native.example',cookie:'private-cookie'}} as Awaited<ReturnType<WildsWalletSourceSdkProxyDependenciesV128['resolveContext']>>),assertBearer:async input=>{grants.push(input);if(grantDenied)throw grantDenied instanceof Error?grantDenied:Error('private-token sensitive denial');},fetcher:async(url,init)=>{calls.push({url:String(url),init:init!});return native;},reportFailure:value=>{diagnostics.push(value);}};
 const form=new FormData();form.set('file',new File([new Uint8Array([1,2,3])],'wildz-resource-actor-test.receizbundle',{type:'application/vnd.receiz.portable-asset.v1+json'}));form.set('wildzSdkPath','/api/sdk/v1/assets/seal');form.set('wildzSdkQuery','');form.set('wildzSdkMethod','POST');
 const request=new NextRequest('https://wildz.quest/api/wilds/wallet/source-sdk',{method:'POST',headers:{authorization:'Bearer private-token',accept:'application/vnd.receiz.bundle+json, application/octet-stream','x-idempotency-key':'same-source-attempt'},body:form});
 return {dependencies,request,diagnostics,calls,grants};
}

test('the server reports native seal status and safe code without changing original rejection bytes or weakening grant admission',async()=>{
 const native=Response.json({error:'seal_unavailable',private:'private-token private-cookie payload-secret'},{status:503}),f=proxyFixture(native),response=await proxyWildsWalletSourceSdkV128(f.request,f.dependencies);
 assert.deepEqual(f.diagnostics,[{stage:'source-actor-seal',status:503,code:'seal_unavailable'}]);assert.equal(response.status,503);assert.equal(await response.text(),'{"error":"seal_unavailable","private":"private-token private-cookie payload-secret"}');assert.equal(response.headers.get('x-wildz-source-stage'),'source-actor-seal');
 assert.deepEqual(f.grants,[{bearer:'private-token',applicationId:'registered-client',baseUrl:'https://native.example',ownerReceizId:'current-account',keyId:'a'.repeat(64),requiredScopes:['receiz:record','receiz:seal']}]);
 assert.equal(f.calls[0]?.url,'https://native.example/api/sdk/v1/assets/seal');assert.equal(new Headers(f.calls[0]?.init.headers).get('accept'),'application/vnd.receiz.bundle+json, application/octet-stream');assert.equal(new Headers(f.calls[0]?.init.headers).get('x-idempotency-key'),'same-source-attempt');
 const file=(f.calls[0]?.init.body as FormData).get('file') as File;assert.equal(file.name,'wildz-resource-actor-test.receizbundle');assert.equal(file.type,'application/vnd.receiz.portable-asset.v1+json');assert.deepEqual(new Uint8Array(await file.arrayBuffer()),new Uint8Array([1,2,3]));assert.doesNotMatch(JSON.stringify(f.diagnostics),/private-token|private-cookie|payload-secret/);
});

test('a server grant rejection emits sanitized stage diagnostics and performs no native request',async()=>{
 const f=proxyFixture(Response.json({}),true),response=await proxyWildsWalletSourceSdkV128(f.request,f.dependencies);
 assert.equal(response.status,409);assert.deepEqual(f.calls,[]);assert.deepEqual(f.diagnostics,[{stage:'source-grant',status:409,code:'source_grant_rejected'}]);assert.doesNotMatch(await response.text(),/private-token|sensitive/);
});

test('a native introspection HTTP failure retains its original status and safe code while keeping private payload out of logs',async()=>{
 const f=proxyFixture(Response.json({}),new ReceizHttpError(503,{error:'introspection_unavailable',private:'payload-secret'})),response=await proxyWildsWalletSourceSdkV128(f.request,f.dependencies);
 assert.equal(response.status,503);assert.deepEqual(f.calls,[]);assert.deepEqual(f.diagnostics,[{stage:'source-grant',status:503,code:'introspection_unavailable'}]);assert.doesNotMatch(await response.text(),/payload-secret/);
});

test("resource archive lookup remains confined to its own fixed content-addressed pages",()=>{
 const url=`https://wildz.quest/receiz/resource-source-v128/pages/${"b".repeat(64)}`;
 assert.equal(isWildsWalletSourceSdkPathV128("/api/public-proof/by-url","GET",new URLSearchParams({url}).toString()),true);
 for(const changed of [url+"?private=1",url+"/extra",url.replace("b".repeat(64),"B".repeat(64)),url.replace("/pages/","/private/")])assert.equal(isWildsWalletSourceSdkPathV128("/api/public-proof/by-url","GET",new URLSearchParams({url:changed}).toString()),false);
});

test("source publication admits namespace-specific archive pages and shared exact byte pages only",async()=>{
 const {assertWildsWalletSourceArchivePageV128}=await import("../src/lib/receiz/wilds-wallet-source-sdk-runtime");
 const {describeWildsResourceSourceArchivePageV128}=await import("../src/lib/receiz/wilds-resource-source-archive-v128");
 const {createWildzMarketSourceArchivePageV128,describeWildzMarketSourceArchivePageV128}=await import("../src/lib/receiz/wildz-market-source-archive-v128");
 const {locateWildzMarketSourceOriginalV128,describeWildzMarketSourceBytesPageV128}=await import("../src/lib/receiz/wildz-market-source-original-locator-v128");
 const {sha256ReceizBytes}=await import("@receiz/sdk");
 const source={schema:"receiz.sealed-artifact-bytes.v124" as const,artifactSha256:"a".repeat(64),payloadSha256:"b".repeat(64),filename:"source.receizbundle",mimeType:"application/vnd.receiz.bundle+json",exactBytesB64u:"c291cmNl"};
 const reference=await locateWildzMarketSourceOriginalV128({...source,artifactSha256:await sha256ReceizBytes(new TextEncoder().encode("source"))},async()=>{});
 const resourcePage={schema:"wildz.resource-source-page.v128",predecessorPage:null,sourceArtifacts:[reference]};
 const resourceUrl=`https://wildz.quest/receiz/resource-source-v128/pages/${describeWildsResourceSourceArchivePageV128(resourcePage).digest}`;
 assert.doesNotThrow(()=>assertWildsWalletSourceArchivePageV128("wildz.resources.v128",resourceUrl,resourcePage));
 const marketPage=createWildzMarketSourceArchivePageV128([source]);
 const marketUrl=`https://wildz.quest/receiz/market-source-v128/pages/${describeWildzMarketSourceArchivePageV128(marketPage).digest}`;
 assert.doesNotThrow(()=>assertWildsWalletSourceArchivePageV128("wildz.market.v128",marketUrl,marketPage));
 assert.throws(()=>assertWildsWalletSourceArchivePageV128("wildz.resources.v128",resourceUrl,marketPage));
 assert.throws(()=>assertWildsWalletSourceArchivePageV128("wildz.market.v128",marketUrl,resourcePage));
 const bytePage={schema:"wildz.market-source-bytes-page.v128",part:"c291cmNl"},digest=describeWildzMarketSourceBytesPageV128(bytePage).digest;
 for(const [namespace,stem]of[["wildz.resources.v128","resource"],["wildz.market.v128","market"]]){
  const url=`https://wildz.quest/receiz/${stem}-source-v128/pages/${digest}`;
  assert.doesNotThrow(()=>assertWildsWalletSourceArchivePageV128(namespace!,url,bytePage));
  assert.throws(()=>assertWildsWalletSourceArchivePageV128(namespace!,url,{...bytePage,part:"YWx0ZXJlZA"}));
  assert.throws(()=>assertWildsWalletSourceArchivePageV128(namespace!,`${url}?private=1`,bytePage));
 }
});
