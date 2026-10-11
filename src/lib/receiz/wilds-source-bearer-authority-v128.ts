import {createReceizClient,receizBase64UrlDecode} from '@receiz/sdk';

const fail=():never=>{throw Error('The source grant belongs to another account, key, or scope.');};
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const scopes=(value:unknown)=>typeof value==='string'?[...new Set(value.trim().split(/\s+/).filter(Boolean))].sort():[];

export async function assertWildsSourceBearerAuthorityV128(input:Readonly<{
 bearer:string;applicationId:string;baseUrl:string;ownerReceizId:string;keyId:string;
 requiredScopes:readonly string[];fetcher?:typeof fetch;
}>){
 // This native client is public and uses the existing device proof grant.
 // Wallet's confidential OAuth credentials belong to its separate audience.
 const sdk=createReceizClient({baseUrl:input.baseUrl,fetchImpl:input.fetcher});
 const checked=await sdk.identity.introspect({token:input.bearer,client_id:input.applicationId});
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
