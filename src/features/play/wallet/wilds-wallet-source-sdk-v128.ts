import { createReceizClient } from "@receiz/sdk";

const SOURCE_DIAGNOSTIC_STAGES = ['source-session','source-request','source-grant','native-seal','source-actor-seal','source-subject-seal','creature-original-seal','creature-bearer-seal','creature-projection-seal','replay-segment-seal','source-custody-seal','issued-artifact-verification'] as const;
export type WildsWalletSourceSdkDiagnosticV128 = Readonly<{stage:typeof SOURCE_DIAGNOSTIC_STAGES[number];status?:number;code:string}>;
export function wildsWalletSourceFailureCodeV128(value:unknown):string|undefined {
  if(typeof value==='string')return /^[A-Za-z][A-Za-z0-9_]{2,80}$/.test(value)?value:undefined;
  if(value&&typeof value==='object'&&!Array.isArray(value)){const record=value as Record<string,unknown>;return wildsWalletSourceFailureCodeV128(record.code)??wildsWalletSourceFailureCodeV128(record.error)??(value instanceof Error?wildsWalletSourceFailureCodeV128(value.message):undefined);}
}
export function wildsWalletSourceSealStageV128(filename:string):WildsWalletSourceSdkDiagnosticV128['stage'] {
  if(filename.startsWith('wildz-resource-actor-'))return 'source-actor-seal';
  if(filename.startsWith('wildz-resource-subject-'))return 'source-subject-seal';
  if(filename.startsWith('wildz-creature-held-'))return 'creature-original-seal';
  if(filename.startsWith('wildz-creature-projection-'))return 'creature-projection-seal';
  if(filename.startsWith('wildz-creature-'))return 'creature-bearer-seal';
  if(filename.startsWith('wildz-resource-source-'))return 'replay-segment-seal';
  if(/^wildz-(?:market|resource)-custody-/.test(filename))return 'source-custody-seal';
  return 'native-seal';
}
/** Diagnostics contain only stable stage/status/code, never upstream messages,
 * private payloads, credentials or source bytes. The response is left intact. */
export async function readWildsWalletSourceSdkDiagnosticV128(response:Response,stage:WildsWalletSourceSdkDiagnosticV128['stage']):Promise<WildsWalletSourceSdkDiagnosticV128> {
  const declared=response.headers.get('x-wildz-source-stage');
  if(SOURCE_DIAGNOSTIC_STAGES.some(value=>value===declared))stage=declared as WildsWalletSourceSdkDiagnosticV128['stage'];
  const payload=response.ok?null:await response.clone().json().catch(()=>null);
  return {stage,status:response.status,code:wildsWalletSourceFailureCodeV128(payload)??(response.ok?'native_seal_response_invalid':'native_source_http_rejected')};
}
export class WildsWalletSourceSdkErrorV128 extends Error {
  readonly code:string;
  constructor(readonly diagnostic:WildsWalletSourceSdkDiagnosticV128,cause:unknown){
    super(`${diagnostic.stage}${diagnostic.status===undefined?'':` HTTP ${diagnostic.status}`}: ${diagnostic.code}`,{cause});
    this.name='WildsWalletSourceSdkErrorV128';this.code=wildsWalletSourceFailureCodeV128(cause)??diagnostic.code;
  }
}

export const WILDS_WALLET_RESOURCE_SOURCE_URL_V128 = "https://wildz.quest/receiz/resource-source-v128";
export const WILDS_WALLET_MARKET_SOURCE_URL_V128 = "https://wildz.quest/receiz/market-source-v128";
export const isWildsWalletMarketSourcePageUrlV128 = (value:string) => /^https:\/\/wildz\.quest\/receiz\/market-source-v128\/pages\/[a-f0-9]{64}$/.test(value);
export const isWildsWalletResourceSourcePageUrlV128 = (value:string) => /^https:\/\/wildz\.quest\/receiz\/resource-source-v128\/pages\/[a-f0-9]{64}$/.test(value);
export function isWildsWalletSourceSdkPathV128(path: string, method: string, query: string): boolean {
  const params = new URLSearchParams(query);
  if (path === "/api/public-proof/by-url" && method === "GET") return params.size === 1 && ([WILDS_WALLET_RESOURCE_SOURCE_URL_V128, WILDS_WALLET_MARKET_SOURCE_URL_V128].includes(params.get("url") ?? "") || isWildsWalletMarketSourcePageUrlV128(params.get("url") ?? "") || isWildsWalletResourceSourcePageUrlV128(params.get("url") ?? ""));
  if (params.size > 1 || params.size === 1 && (!params.has("applicationId") || !params.get("applicationId"))) return false;
  if (method === "GET") return /^\/api\/sdk\/v1\/subjects\/receiz(?::|%3A)subject(?::|%3A)[a-f0-9]{64}\/state$/i.test(path);
  return method === "POST" && ["/api/sdk/v1/identity/proof-authority/exchange", "/api/sdk/v1/subjects/admit", "/api/sdk/v1/sources/publish", "/api/sdk/v1/runtime/authority-sessions/open", "/api/sdk/v1/domains/verified-replay", "/api/sdk/v1/assets/seal", "/api/public-proof/registry/feed"].includes(path);
}

/** The released SDK still builds, signs and verifies each real request. Only
 * transport changes to a bounded same-origin port. Tokens stay in memory. */
export function createWildsWalletSourceSdkClientV128(input: Readonly<{ applicationId: string; accessToken?: string; baseUrl?: string; fetcher?: typeof fetch }>) {
  const origin = new URL(input.baseUrl ?? "https://receiz.com").origin;
  const createSdk=(capture?:(value:WildsWalletSourceSdkDiagnosticV128)=>void)=>createReceizClient({ applicationId: input.applicationId, baseUrl: origin, ...(input.accessToken ? { accessToken:input.accessToken } : {}), fetchImpl: async (request, init) => {
    const url = new URL(String(request)), method = init?.method ?? "GET", query = url.search.slice(1);
    if(url.origin!==origin)throw Error('wildz_resource_sdk_path_invalid');
    if(url.pathname==='/api/document-verify'){
      if(method!=='POST'||query||url.hash||url.username||url.password)throw Error('wildz_resource_sdk_path_invalid');
      if(!(init?.body instanceof FormData)||[...init.body.keys()].join(',')!=='file'||!(init.body.get('file') instanceof File))throw Error('wildz_resource_sdk_file_required');
      const response=await (input.fetcher??fetch)('/api/document-verify',{method:'POST',body:init.body,credentials:'same-origin',cache:'no-store',redirect:'error'});
      if(capture&&!response.ok)capture(await readWildsWalletSourceSdkDiagnosticV128(response,'issued-artifact-verification'));
      return response;
    }
    if (!isWildsWalletSourceSdkPathV128(url.pathname, method, query)) throw Error("wildz_resource_sdk_path_invalid");
    const headers = new Headers();
    const actualHeaders = new Headers(init?.headers);
    for (const name of ["accept", "authorization", "x-idempotency-key", "idempotency-key"]) { const value = actualHeaders.get(name); if (value) headers.set(name, value); }
    let body: BodyInit;
    if (init?.body instanceof FormData) {
      const form = new FormData();
      for (const [name, value] of init.body.entries()) form.append(name, value);
      form.set("wildzSdkPath", url.pathname); form.set("wildzSdkQuery", query); form.set("wildzSdkMethod", method);
      body = form;
    } else {
      if (init?.body !== undefined && init.body !== null && typeof init.body !== "string") throw Error("wildz_resource_sdk_body_invalid");
      const native = init?.body ? JSON.parse(init.body) : null;
      body = JSON.stringify({ path: url.pathname, query, method, body: native }); headers.set("content-type", "application/json");
    }
    const file=init?.body instanceof FormData?init.body.get('file'):null,stage=wildsWalletSourceSealStageV128(file instanceof File?file.name:'');
    try{
      const response=await (input.fetcher ?? fetch)("/api/wilds/wallet/source-sdk", { method: "POST", headers, body, credentials: "same-origin", cache: "no-store", redirect: "error" });
      if(capture&&url.pathname==='/api/sdk/v1/assets/seal')capture(await readWildsWalletSourceSdkDiagnosticV128(response,stage));
      return response;
    }catch(cause){if(capture&&url.pathname==='/api/sdk/v1/assets/seal')capture({stage,code:'native_seal_transport_failed'});throw cause;}
  } });
  const sdk=createSdk();
  const createProofObject:typeof sdk.assets.createProofObject=async(payload,options)=>{
    // A separate transport closure prevents concurrent source seals from
    // borrowing another operation's error. Issuance remains the released SDK.
    let diagnostic:WildsWalletSourceSdkDiagnosticV128|undefined;
    const issuer=createSdk(value=>{diagnostic=value;});
    try{return await issuer.assets.createProofObject(payload,options);}
    catch(cause){if(diagnostic&&cause instanceof Error&&(['artifact_seal_failed','artifact_record_failed'].includes(cause.message)||diagnostic.stage==='issued-artifact-verification'))throw new WildsWalletSourceSdkErrorV128(diagnostic,cause);throw cause;}
  };
  const assets={...sdk.assets,createProofObject};
  return new Proxy(sdk,{get(target,key,receiver){
    if(key==='assets')return assets;
    if(key==='createProofObject')return createProofObject;
    const value=Reflect.get(target,key,receiver);return typeof value==='function'?value.bind(target):value;
  }});
}
