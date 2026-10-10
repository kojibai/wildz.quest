import assert from 'node:assert/strict';import {test} from 'node:test';
import {createReceizClient,createReceizIdentityKeyFile,receizBase64UrlEncode,sha256ReceizBytes,receizKaiNow,type ReceizClient} from '@receiz/sdk';
import type {WildzContinuityDatabase} from '../src/lib/storage/wildz-indexed-db';
import type {WildzMarketSelectionV128,WildzMarketSourceProofV128} from '../src/lib/receiz/wildz-market-source-types-v128';
async function module(){const m=await import('../src/lib/receiz/wildz-market-source-repository-v128').catch(()=>null);assert.ok(m,'actual sealed market source repository required');return m;}
function database(fail=false):WildzContinuityDatabase{const values=new Map<string,unknown>();return {read:async(_s,k)=>structuredClone(values.get(String(k))??null) as never,transaction:async(_s,_mode,run)=>{if(fail)throw Error('storage unavailable');return run({get:async(_s,k)=>structuredClone(values.get(String(k))??null) as never,put:async(_s,v,k)=>{values.set(String(k),structuredClone(v));},delete:async(_s,k)=>{values.delete(String(k));},getAll:async()=>[]});}};}
const selection:WildzMarketSelectionV128={asset:{kind:'inventory',foodItemIds:['apple:one'],materialLotIds:[],resourceLotIds:[]},semanticIds:['resource:apple:one'],sourceDigest:'a'.repeat(64),summary:'Apple',resourceUnits:1,creatureCount:0};
async function fixture(fail=false){const m=await module(),{keyFile}=await createReceizIdentityKeyFile({owner:{uid:'market_test',username:'alice'}}),now=receizKaiNow(),sealed:Uint8Array[]=[];
 const author={keyFile,ownerReceizId:'alice.receiz.id',actorSubjectId:`receiz:subject:${'d'.repeat(64)}`,actorSubjectHead:'e'.repeat(64),grant:{schema:'receiz.identity.proof-authority.v123' as const,applicationId:'wildz',keyId:keyFile.keyId,artifactDigest:'a'.repeat(64),grantedScopes:['openid','profile','receiz:domains.read','receiz:domains.write','receiz:record','receiz:seal','receiz:subjects.read','receiz:subjects.write'],issuedAtKai:now.pulse-1,expiresAtKai:now.pulse+60,nonce:'test',revocationHead:'b'.repeat(64),tokenType:'Bearer' as const,expiresIn:300,refreshable:false as const,authority:{grantIsIdentityAuthority:false as const,strongerTruth:'receiz-identity-artifact' as const},authorityDigest:'c'.repeat(64),accessToken:'test-only'}};
 const session={authoritySessionHandle:'test-only',applicationId:'wildz',audience:'wildz',actorSubjectId:author.actorSubjectId,identityKeyId:keyFile.keyId,identityArtifactSha256:author.grant.artifactDigest,expiresAtKaiUPulse:now.uPulse+60_000_000};
 const sdk={assets:{createProofObject:async(value:{payload:{bytes:Uint8Array}})=>{sealed.push(new Uint8Array(value.payload.bytes));throw Error('lost seal response');}}} as unknown as ReceizClient;
 const storage=database(fail);let qualification=0;const create=()=>m.createWildzMarketSourceRepositoryV128({sdk,database:storage,authority:author,session:session as never,locator:{read:async()=>null,publish:async()=>{}},qualifySelection:async(value:WildzMarketSelectionV128)=>{qualification++;return value;},verifyTransition:async()=>{throw Error('no actual purchase evidence');}});
 return {create,sealed,qualification:()=>qualification,m,sdk,author};}
test('market lost seal response retains identical listing source bytes across repository recreation',async()=>{const f=await fixture(),request={attemptId:'list:durable',listingId:'listing:durable',selection,priceUsdCents:500};
 await assert.rejects(f.create().list(request),/publication_pending/);await assert.rejects(f.create().list(request),/publication_pending/);
 assert.equal(f.sealed.length,2);assert.deepEqual(f.sealed[0],f.sealed[1]);
 await assert.rejects(f.create().list({...request,priceUsdCents:600}),/attempt_conflict/);assert.equal(f.sealed.length,2);
});
test('market storage failure causes zero native seal or source publication writes',async()=>{const f=await fixture(true);await assert.rejects(f.create().list({attemptId:'list:blocked',listingId:'listing:blocked',selection,priceUsdCents:500}),/storage unavailable/);assert.equal(f.sealed.length,0);});
test('market source refuses caller-shaped root proof before replay or mutation',async()=>{const f=await fixture();
 const fake={schema:'wildz.market-source-proof.v128',custodyArtifact:{},sourceArtifacts:[]} as unknown as WildzMarketSourceProofV128;
 await assert.rejects(f.m.verifyWildzMarketSourceProofV128(f.sdk,fake,{applicationId:'wildz'}),/source_proof_invalid/);assert.equal(f.sealed.length,0);
});
test('unknown reservation observation is strictly read-only',async()=>{const f=await fixture();await assert.rejects(f.create().observe({listingId:'listing:unknown'}),/listing_missing/);assert.equal(f.sealed.length,0);assert.equal(f.qualification(),0);});

test('market locator transports a large exact Original within real SDK signed-request bounds',async()=>{
 const f=await fixture(),requests:Array<Record<string,unknown>>=[],records=new Map<string,unknown>();
 const sdk=createReceizClient({applicationId:'wildz',fetchImpl:async(url,init)=>{
  if((init?.method??'GET')==='GET')return new Response(JSON.stringify({ok:true,record:records.get(new URL(String(url)).searchParams.get('url')!)}),{status:200,headers:{'content-type':'application/json'}});
  const text=String(init?.body);if(new TextEncoder().encode(text).length>2*1024*1024)throw Error('published host 2MiB request bound');
  const request=JSON.parse(text);requests.push(request);const record=request.feed.records[0];records.set(record.sourceUrl,record);
  return new Response('{}',{status:200,headers:{'content-type':'application/json'}});
 }});
 const bytes=new Uint8Array(600_000).map((_,index)=>index%251),original={schema:'receiz.sealed-artifact-bytes.v124' as const,
  exactBytesB64u:receizBase64UrlEncode(bytes),artifactSha256:await sha256ReceizBytes(bytes),payloadSha256:'a'.repeat(64),filename:'large-custody.receizbundle',mimeType:'application/vnd.receiz.bundle+json'};
 const proof:WildzMarketSourceProofV128={schema:'wildz.market-source-proof.v128',custodyArtifact:original,archivePages:[],sourceArtifacts:[{...original,exactBytesB64u:'eA',artifactSha256:'b'.repeat(64)}]};
 const locator=f.m.createWildzMarketPublicStoreLocatorV128({sdk,authority:f.author,sourceUrl:'https://wildz.quest/receiz/market-source-v128'});
 await locator.publish(proof);
 assert.ok(requests.length>2,'large Original must use bounded immutable pages before its locator');
 const rows=requests.map(value=>value.storeStateRecord as Record<string,unknown>);
 assert.equal(rows.at(-1)?.schema,'wildz.market-source-locator.v128');
 assert.equal((rows.at(-1)?.proof as {custodyArtifact:{exactBytesB64u?:string}}).custodyArtifact.exactBytesB64u,undefined);
 const cold=f.m.createWildzMarketPublicStoreLocatorV128({sdk,authority:f.author,sourceUrl:'https://wildz.quest/receiz/market-source-v128'});
 assert.deepEqual(await cold.read(),proof,'cold transport must reconstruct the identical enclosing Original before source admission');
});
