import { NextRequest, NextResponse } from "next/server";
import { createReceizCommerceAdapter } from "@/lib/receiz/adapter";
import { resolveWildsWalletReadAuthority } from "@/lib/receiz/wilds-wallet-route-authority";
import { readWildzProofSessionCookie } from "@/lib/receiz/wildz-proof-session";
import { WILDZ_RECEIZ_APPLICATION_ID } from "@/lib/receiz/wildz-application";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const paths=new Set(["/api/sdk/v1/identity/proof-authority/exchange","/api/sdk/v1/value/own-source","/api/sdk/v1/native-trades/identity-source","/api/sdk/v1/native-trades/ownership/basis","/api/sdk/v1/native-trades/ownership/prepare","/api/sdk/v1/native-trades/commit","/api/sdk/v1/native-trades/resolve","/api/sdk/v1/native-trades/recover","/api/sdk/v1/native-world","/api/sdk/v1/native-world/plan","/api/sdk/v1/native-world/package-source"]);
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{"cache-control":"no-store"}});
/** Same-origin transport of existing public SDK methods; native host proof and atomic laws remain authoritative. */
export async function POST(request:NextRequest){
 try{
  if(request.headers.get("origin")!==request.nextUrl.origin||!request.headers.get("content-type")?.startsWith("application/json"))return reply({error:"REQUEST_INVALID"},403);
  if(Number(request.headers.get("content-length"))>20_000_000)return reply({error:"REQUEST_INVALID"},413);
  const authority=await resolveWildsWalletReadAuthority(request),session=readWildzProofSessionCookie(request);
  if(session.authority!=="identity-key")return reply({error:"IDENTITY_REQUIRED"},401);
  const raw=await request.text();if(raw.length>20_000_000)return reply({error:"REQUEST_INVALID"},413);
  const body=JSON.parse(raw) as {path:string;method?:"GET"|"POST";body:Record<string,unknown>|null;bearerToken?:string};
  if(!body||typeof body!=="object"||Array.isArray(body)||Object.keys(body).some(k=>!["path","method","body","bearerToken"].includes(k))||typeof body.path!=="string")return reply({error:"REQUEST_INVALID"},400);
  const url=new URL(body.path,"https://native-sdk.invalid");
  if(url.origin!=="https://native-sdk.invalid"||!paths.has(url.pathname)||url.hash||[...url.searchParams.keys()].some(k=>k!=="applicationId")||url.searchParams.get("applicationId")&&url.searchParams.get("applicationId")!==WILDZ_RECEIZ_APPLICATION_ID)return reply({error:"REQUEST_INVALID"},400);
  const method=body.method??"POST";
  if(method!=="POST"&&method!=="GET"||method==="GET"&&(url.pathname!=="/api/sdk/v1/native-world"||body.body!==null)||method==="POST"&&(!body.body||typeof body.body!=="object"||Array.isArray(body.body))||body.body?.applicationId!==undefined&&body.body.applicationId!==WILDZ_RECEIZ_APPLICATION_ID)return reply({error:"REQUEST_INVALID"},400);
  if(url.pathname.endsWith("proof-authority/exchange")){
   const challenge=body.body?.challenge as {proof?:{keyId?:string}}|undefined;
   if(body.body?.applicationId!==WILDZ_RECEIZ_APPLICATION_ID||challenge?.proof?.keyId!==session.keyId)return reply({error:"IDENTITY_MISMATCH"},403);
  }
  if(body.bearerToken!==undefined){
   if(typeof body.bearerToken!=="string"||body.bearerToken.length>8192)return reply({error:"REQUEST_INVALID"},400);
   const actual=await createReceizCommerceAdapter({accessToken:body.bearerToken}).introspectAccessToken() as {active?:boolean;sub?:string;client_id?:string};
   if(actual.active!==true||actual.sub!==authority.ownerReceizId||actual.client_id!==WILDZ_RECEIZ_APPLICATION_ID)return reply({error:"IDENTITY_MISMATCH"},403);
  }
  const client=createReceizCommerceAdapter({accessToken:authority.accessToken}).client;
  return reply(await client.request(url.pathname+url.search,{method,...(method==="POST"?{body:body.body!}:{}),bearerToken:body.bearerToken??authority.accessToken}));
 }catch(cause){const status=cause&&typeof cause==="object"&&"status"in cause?Number(cause.status):503;return reply({error:"NATIVE_SDK_UNAVAILABLE"},status>=400&&status<=599?status:503);}
}
