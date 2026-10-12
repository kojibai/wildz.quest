import assert from 'node:assert/strict';
import {test} from 'node:test';
import {assertWildsSourceBearerAuthorityV128} from '../src/lib/receiz/wilds-source-bearer-authority-v128';

const keyId='a'.repeat(64),owner='source-owner',applicationId='wildz';
const scopes=['openid','profile','receiz:domains.write'];
const encode=(value:unknown)=>Buffer.from(JSON.stringify(value)).toString('base64url');
const token=(claims:Record<string,unknown>={})=>`${encode({alg:'ES256',typ:'JWT'})}.${encode({token_use:'access',client_id:applicationId,sub:owner,scope:scopes.join(' '),actor_type:'proof_authority_v123',actor_label:keyId,...claims})}.fixture-signature`;
const active={active:true,token_type:'access_token',client_id:applicationId,sub:owner,scope:scopes.join(' ')};
const run=(bearer=token(),introspection:unknown=active,fetcher?:typeof fetch,environment:Readonly<{RECEIZ_CLIENT_ID?:string;RECEIZ_CLIENT_SECRET?:string;RECEIZ_BASE_URL?:string}>={})=>assertWildsSourceBearerAuthorityV128({bearer,applicationId,baseUrl:'https://receiz.example',ownerReceizId:owner,keyId,requiredScopes:['receiz:domains.write'],fetcher:fetcher??(async()=>Response.json(introspection))},environment);

test('public native source admission uses the real SDK introspection without client credentials',async()=>{
 const bearer=token(),calls:string[]=[];
 await run(bearer,active,async(url,init)=>{
  assert.equal(String(url),'https://receiz.example/api/oidc/introspect');
  assert.equal(init?.method,'POST');
  const body=new URLSearchParams(String(init?.body));
  assert.equal(body.get('client_id'),applicationId);assert.equal(body.get('token'),bearer);
  assert.equal(body.has('client_secret'),false);assert.equal(new Headers(init?.headers).has('authorization'),false);
  calls.push('introspect');
  // The actual Receiz response omits actor_label. Its active verdict verifies
  // this exact token; the device-key binding is carried by the verified JWT.
  return Response.json(active);
 });
 assert.deepEqual(calls,['introspect']);
});

test('the configured confidential source client authenticates native introspection with the same server-only Wallet Basic helper',async()=>{
 const environment={RECEIZ_CLIENT_ID:applicationId,RECEIZ_CLIENT_SECRET:'server-only:credential',RECEIZ_BASE_URL:'https://receiz.example'},expected=`Basic ${Buffer.from('wildz:server-only:credential').toString('base64')}`;let requests=0;
 await run(token(),active,async(url,init)=>{
  requests++;assert.equal(String(url),'https://receiz.example/api/oidc/introspect');
  if(new Headers(init?.headers).get('authorization')!==expected)return Response.json({error:'invalid_client'},{status:401});
  assert.equal(init?.redirect,'error');
  const body=new URLSearchParams(String(init?.body));assert.equal(body.get('client_id'),'wildz');assert.equal(body.has('client_secret'),false);assert.doesNotMatch(String(init?.body),/server-only|credential/);return Response.json(active);
 },environment);
 assert.equal(requests,1);
});

test('confidential credentials cannot be reused for a different application or native origin',async()=>{
 for(const environment of [
  {RECEIZ_CLIENT_ID:'another-registered-app',RECEIZ_CLIENT_SECRET:'private-credential',RECEIZ_BASE_URL:'https://receiz.example'},
  {RECEIZ_CLIENT_ID:applicationId,RECEIZ_CLIENT_SECRET:'private-credential',RECEIZ_BASE_URL:'https://another-native.example'},
 ])await run(token(),active,async(_url,init)=>{assert.equal(new Headers(init?.headers).has('authorization'),false);assert.doesNotMatch(String(init?.body),/private-credential/);return Response.json(active);},environment);
});

test('matching client ID normalization preserves the exact configured secret bytes',async()=>{
 const expected=`Basic ${Buffer.from('wildz: secret with spaces ', 'utf8').toString('base64')}`;
 await run(token(),active,async(_url,init)=>new Headers(init?.headers).get('authorization')===expected?Response.json(active):Response.json({error:'invalid_client'},{status:401}),{RECEIZ_CLIENT_ID:' wildz ',RECEIZ_CLIENT_SECRET:' secret with spaces ',RECEIZ_BASE_URL:'https://receiz.example'});
});

test('source admission rejects inactive tokens and account, application, key, actor or scope mismatches',async()=>{
 for(const [bearer,introspection] of [
  [token(),{...active,active:false}],
  [token(),{...active,sub:'other-owner'}],
  [token(),{...active,client_id:'another-app'}],
  [token(),{...active,scope:'openid profile'}],
  [token({actor_label:'b'.repeat(64)}),active],
  [token({actor_type:'other-actor'}),active],
  [token({client_id:'another-app'}),active],
  [token({sub:'other-owner'}),active],
  [token({scope:'openid profile'}),active],
  ['malformed',active],
 ] as const)await assert.rejects(()=>run(bearer,introspection),/source grant belongs to another account, key, or scope/i);
});
