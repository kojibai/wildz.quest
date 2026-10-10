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

test("the native sealer retains the exact SDK multipart file and cannot smuggle a route/body field",async()=>{
 let forwarded:FormData|undefined;
 const sdk=createWildsWalletSourceSdkClientV128({applicationId:"actual-client",fetcher:async(_url,init)=>{forwarded=init?.body as FormData;return Response.json({});}});
 const file=new File([new Uint8Array([1,2,3])],"exact-source.json",{type:"application/json"}),form=new FormData();form.set("file",file);
 await sdk.request("/api/sdk/v1/assets/seal",{method:"POST",body:form});
 assert.deepEqual(new Uint8Array(await (forwarded!.get("file") as File).arrayBuffer()),new Uint8Array([1,2,3]));
 assert.equal(forwarded?.get("wildzSdkPath"),"/api/sdk/v1/assets/seal");assert.equal(forwarded?.get("wildzSdkMethod"),"POST");
});
