import assert from 'node:assert/strict';
import {test} from 'node:test';
import {openWildsResourcePackageExchangeBrowserV128, type WildsResourceExchangeBrowserDependenciesV128} from '../src/lib/receiz/wilds-resource-exchange-browser-v128';
import {loadWildsResourceSourceConfigurationV128, WildsResourceSourceConfigurationErrorV128} from '../src/lib/receiz/wilds-resource-source-configuration-v128';
import type {WildsResourceSourceConfigurationDependenciesV128} from '../src/lib/receiz/wilds-resource-source-configuration-v128';
import {NextRequest} from 'next/server';
import {wildsWalletSourceSdkConfigV128,proxyWildsWalletSourceSdkV128} from '../src/lib/receiz/wilds-wallet-source-sdk-runtime';
import type {WildzReceizChatSession} from '../src/lib/receiz/wildz-receiz-chat-session';
import {GET as walletAuthorityChallenge} from '../app/api/auth/wildz/wallet-authority/route';

const keyId='a'.repeat(64), expected={applicationId:'wildz',baseUrl:'https://receiz.example'};
function fixture(responses:Array<Response|Error>){
 const calls:string[]=[];
 const dependencies:WildsResourceSourceConfigurationDependenciesV128={
  fetcher:async(url,init)=>{
   calls.push('configuration');assert.equal(String(url),'/api/wilds/wallet/source-sdk');
   assert.equal(init?.credentials,'same-origin');assert.equal(init?.cache,'no-store');
   const next=responses.shift();if(next instanceof Error)throw next;assert.ok(next);return next;
  },
  authorize:async key=>{assert.equal(key,keyId);calls.push('authorize');return true;},
  reconnect:async key=>{assert.equal(key,keyId);calls.push('reconnect');return true;},
 };
 return {calls,dependencies};
}

test('native source metadata binds the existing application regardless of OAuth client setting',async()=>{
 const previous=process.env.RECEIZ_CLIENT_ID;
 const session={origin:expected.baseUrl} as WildzReceizChatSession;
 try{
  for(const client of [undefined,'separate-oauth-client']){
   if(client===undefined)delete process.env.RECEIZ_CLIENT_ID;else process.env.RECEIZ_CLIENT_ID=client;
   assert.deepEqual(await wildsWalletSourceSdkConfigV128(new NextRequest('https://wildz.quest/api/wilds/wallet/source-sdk'),async()=>session),expected);
  }
 }finally{if(previous===undefined)delete process.env.RECEIZ_CLIENT_ID;else process.env.RECEIZ_CLIENT_ID=previous;}
});

test('source metadata and actual source edges still require admitted current-account authority',async()=>{
 const request=new NextRequest('https://wildz.quest/api/wilds/wallet/source-sdk');
 await assert.rejects(wildsWalletSourceSdkConfigV128(request),/receiz_wallet_read_scope_required/);
 await assert.rejects(proxyWildsWalletSourceSdkV128(request),/receiz_wallet_read_scope_required/);
});

test('healthy source configuration performs one read with no extra signing, authorization or reconnect',async()=>{
 const f=fixture([Response.json(expected)]);
 assert.deepEqual(await loadWildsResourceSourceConfigurationV128(keyId,f.dependencies),expected);
 assert.deepEqual(f.calls,['configuration']);
});

test('missing and revoked read grants renew the same identity once before any source edge',async()=>{
 for(const code of ['receiz_wallet_read_scope_required','receiz_wallet_authority_revoked']){
  const f=fixture([Response.json({error:code},{status:409}),Response.json(expected)]);
  assert.deepEqual(await loadWildsResourceSourceConfigurationV128(keyId,f.dependencies),expected);
  assert.deepEqual(f.calls,['configuration','authorize','configuration']);
 }
});

test('missing native continuation reconnects and renews only the same verified Seal',async()=>{
 const f=fixture([Response.json({error:'receiz_wallet_connect_session_required'},{status:409}),Response.json(expected)]);
 assert.deepEqual(await loadWildsResourceSourceConfigurationV128(keyId,f.dependencies),expected);
 assert.deepEqual(f.calls,['configuration','reconnect','authorize','configuration']);
});

test('a Seal missing both grants recovers within one read renewal and one native continuation',async()=>{
 const f=fixture([Response.json({error:'receiz_wallet_read_scope_required'},{status:409}),
  Response.json({error:'receiz_wallet_connect_session_required'},{status:409}),Response.json(expected)]);
 assert.deepEqual(await loadWildsResourceSourceConfigurationV128(keyId,f.dependencies),expected);
 assert.deepEqual(f.calls,['configuration','authorize','configuration','reconnect','configuration']);
});

test('the real read-renewal challenge uses Wildz native application rather than an OAuth alias',async()=>{
 const previous=process.env.RECEIZ_CLIENT_ID;
 const previousSecret=process.env.RECEIZ_OAUTH_STATE_SECRET;
 try{
  process.env.RECEIZ_OAUTH_STATE_SECRET='source-config-synthetic-fixture-secret-only';
  for(const client of [undefined,'separate-oauth-client']){
   if(client===undefined)delete process.env.RECEIZ_CLIENT_ID;else process.env.RECEIZ_CLIENT_ID=client;
   const response=await walletAuthorityChallenge(new NextRequest(`https://wildz.quest/api/auth/wildz/wallet-authority?keyId=${keyId}&artifactDigest=${'b'.repeat(64)}`));
   assert.equal(response.status,200);
   const challenge=await response.json();
   assert.equal(challenge.applicationId,'wildz');assert.equal(challenge.unsigned.audience,'wildz');
   assert.deepEqual(challenge.scopes,['openid','profile','receiz:wallet.read']);
  }
 }finally{
  if(previous===undefined)delete process.env.RECEIZ_CLIENT_ID;else process.env.RECEIZ_CLIENT_ID=previous;
  if(previousSecret===undefined)delete process.env.RECEIZ_OAUTH_STATE_SECRET;else process.env.RECEIZ_OAUTH_STATE_SECRET=previousSecret;
 }
});

test('renewal failure and a repeated blocked configuration stop without an unbounded retry',async()=>{
 const denied=fixture([Response.json({error:'receiz_wallet_read_scope_required'},{status:409})]);
 await assert.rejects(loadWildsResourceSourceConfigurationV128(keyId,{...denied.dependencies,authorize:async()=>false}),WildsResourceSourceConfigurationErrorV128);
 assert.deepEqual(denied.calls,['configuration']);
 const failed=fixture([Response.json({error:'receiz_wallet_read_scope_required'},{status:409}),Response.json({error:'receiz_wallet_read_scope_required'},{status:409})]);
 await assert.rejects(loadWildsResourceSourceConfigurationV128(keyId,failed.dependencies),(cause:unknown)=>cause instanceof WildsResourceSourceConfigurationErrorV128&&cause.code==='receiz_wallet_read_scope_required');
 assert.deepEqual(failed.calls,['configuration','authorize','configuration']);
});

test('transient, malformed and foreign-application configuration cannot become signing authority',async()=>{
 for(const response of [Response.json({error:'receiz_wallet_introspection_unavailable'},{status:503}),
  Response.json({...expected,applicationId:'other'}),Response.json({...expected,baseUrl:'not-a-url'}),
  Response.json({...expected,baseUrl:'https://receiz.example/private'}),Response.json({...expected,token:'private'}),
  new Response('invalid JSON'),new TypeError('network disconnected')]){
  const f=fixture([response]);
  await assert.rejects(loadWildsResourceSourceConfigurationV128(keyId,f.dependencies),WildsResourceSourceConfigurationErrorV128);
  assert.deepEqual(f.calls,['configuration']);
 }
});

test('blocked source configuration performs no signing-key read, database open or source SDK work', async()=>{
 const calls:string[]=[];
 const dependencies:WildsResourceExchangeBrowserDependenciesV128={
  configuration:async()=>{calls.push('configuration');throw Error('synthetic configuration blocked');},
  loadIdentity:async()=>{calls.push('identity');throw Error('unexpected identity read');},
  database:async()=>{calls.push('database');throw Error('unexpected database open');},
  createSdk:()=>{calls.push('sdk');throw Error('unexpected source SDK');},
 };
 await assert.rejects(openWildsResourcePackageExchangeBrowserV128({keyId:'a'.repeat(64),gameplayOwnerId:'fixture'},dependencies), /synthetic configuration blocked/);
 assert.deepEqual(calls,['configuration']);
});
