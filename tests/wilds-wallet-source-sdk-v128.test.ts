import assert from "node:assert/strict";
import { test } from "node:test";
import { createWildsWalletSourceSdkClientV128,isWildsWalletSourceSdkPathV128,WILDS_WALLET_RESOURCE_SOURCE_URL_V128 } from "../src/features/play/wallet/wilds-wallet-source-sdk-v128";

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
