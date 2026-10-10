"use client";
import { createReceizClient } from "@receiz/sdk";
import { WILDZ_RECEIZ_APPLICATION_ID } from "@/lib/receiz/wildz-application";
/** The SDK constructs and validates every native request; this transport only preserves same-origin session binding. */
export function createWildsWalletNativeSdkClient(accessToken?:string){
 return createReceizClient({applicationId:WILDZ_RECEIZ_APPLICATION_ID,accessToken,baseUrl:"https://native-sdk.invalid",fetchImpl:async(input,init)=>{
  const url=new URL(typeof input==="string"?input:input instanceof URL?input.href:input.url);
  const method=init?.method??"GET";
  if(url.origin!=="https://native-sdk.invalid"||method!=="POST"&&method!=="GET"||method==="POST"&&typeof init?.body!=="string"||method==="GET"&&(url.pathname!=="/api/sdk/v1/native-world"||init?.body!==undefined))throw Error("wilds_native_sdk_request_invalid");
  const authorization=new Headers(init?.headers).get("authorization");
  return fetch("/api/wilds/wallet/native-sdk",{method:"POST",credentials:"same-origin",cache:"no-store",headers:{"content-type":"application/json"},body:JSON.stringify({path:url.pathname+url.search,method,body:method==="POST"?JSON.parse(init!.body as string):null,...(authorization?.startsWith("Bearer ")?{bearerToken:authorization.slice(7)}:{})})});
 }});
}
