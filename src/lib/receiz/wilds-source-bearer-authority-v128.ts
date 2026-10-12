import 'server-only';
import {createReceizClient,receizBase64UrlDecode,RECEIZ_DEFAULT_BASE_URL} from '@receiz/sdk';
import {receizOAuthClientAuthorization} from './adapter';

const fail=():never=>{throw Error('The source grant belongs to another account, key, or scope.');};
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const scopes=(value:unknown)=>typeof value==='string'?[...new Set(value.trim().split(/\s+/).filter(Boolean))].sort():[];
type SourceAuthorityEnvironment=Readonly<{RECEIZ_CLIENT_ID?:string;RECEIZ_CLIENT_SECRET?:string;RECEIZ_BASE_URL?:string}>;

export async function assertWildsSourceBearerAuthorityV128(input:Readonly<{
 bearer:string;applicationId:string;baseUrl:string;ownerReceizId:string;keyId:string;
 requiredScopes:readonly string[];fetcher?:typeof fetch;
}>,environment:SourceAuthorityEnvironment={RECEIZ_CLIENT_ID:process.env.RECEIZ_CLIENT_ID,RECEIZ_CLIENT_SECRET:process.env.RECEIZ_CLIENT_SECRET,RECEIZ_BASE_URL:process.env.RECEIZ_BASE_URL}){
 // The configured source registration may be the same confidential client as
 // Wallet. Its server-held credentials belong only to that exact app/origin;
 // the device grant still supplies all owner, scope and key authority below.
 const nativeOrigin=new URL(input.baseUrl).origin,sameOrigin=nativeOrigin===new URL(environment.RECEIZ_BASE_URL||RECEIZ_DEFAULT_BASE_URL).origin;
 const authorization=environment.RECEIZ_CLIENT_ID?.trim()===input.applicationId&&sameOrigin?receizOAuthClientAuthorization(environment):undefined;
 const sdk=createReceizClient({baseUrl:input.baseUrl,fetchImpl:async(request,init)=>{
  const url=new URL(String(request));if(url.origin!==nativeOrigin||url.pathname!=='/api/oidc/introspect')fail();
  return (input.fetcher??fetch)(request,{...init,redirect:'error',cache:'no-store'});
 }});
 const checked=await sdk.identity.introspect({token:input.bearer,client_id:input.applicationId},authorization?{authorization}:undefined);
 if(!object(checked)||checked.active!==true||checked.token_type!=='access_token'
  ||checked.client_id!==input.applicationId||checked.sub!==input.ownerReceizId)fail();
 const granted=scopes(checked.scope);
 if(!input.requiredScopes.every(scope=>granted.includes(scope)))fail();
 // Receiz verifies the exact JWT signature/revocation before returning active.
 // OIDC introspection does not project actor_label. Read the key binding from
 // that verified token only after the service's active/account/app admission.
 let claims:unknown;
 try{
  const parts=input.bearer.split('.');
  if(parts.length!==3||!parts.every(part=>/^[A-Za-z0-9_-]+$/.test(part)))fail();
  claims=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(receizBase64UrlDecode(parts[1])));
 }catch{fail();}
 if(!object(claims)||claims.token_use!=='access'||claims.client_id!==checked.client_id
  ||claims.sub!==checked.sub||claims.actor_type!=='proof_authority_v123'||claims.actor_label!==input.keyId
  ||JSON.stringify(scopes(claims.scope))!==JSON.stringify(granted))fail();
}
