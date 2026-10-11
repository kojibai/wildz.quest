/** Read-only genuine-root public display qualification. No identity/signing or
 * host-authority claim; all transport replies come from local exact fixtures. */
import assert from 'node:assert/strict';
import {createReceizPublicStoreStateRecord} from '@receiz/sdk';
import {readFile,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {createWildsClearancePublicReaderV128} from '../.test-build/src/lib/receiz/wilds-clearance-public-read-v128.js';
import {locateWildzMarketSourceOriginalV128} from '../.test-build/src/lib/receiz/wildz-market-source-original-locator-v128.js';
const directory=process.argv[3];
if(process.argv.length!==4||process.argv[2]!=='--directory'||!/^\/private\/tmp\/wildz-clearance-native-[a-zA-Z0-9]+$/.test(directory??''))throw Error('Use --directory with the reviewed disposable qualification directory.');
assert.equal((await stat(directory)).mode&0o777,0o700);
const path=join(directory,'codec-v2-twelve-packet.private.json');assert.equal((await stat(path)).mode&0o077,0);
const proof=JSON.parse(await readFile(path,'utf8')),pages=new Map();
const publish=async(page,reference)=>{pages.set(reference.digest,page);};
const reference={schema:'wildz.resource-source-reference.v128',archivePages:[],custodyArtifact:await locateWildzMarketSourceOriginalV128(proof.custodyArtifact,publish),sourceArtifacts:[]};
for(const source of proof.sourceArtifacts)reference.sourceArtifacts.push(await locateWildzMarketSourceOriginalV128(source,publish));
let pageReads=0,locatorReads=0,configReads=0,network=0;
const oldFetch=globalThis.fetch;globalThis.fetch=async()=>{network++;throw Error('qualification_network_forbidden');};
try{
 const reader=createWildsClearancePublicReaderV128(async request=>{
  const url=new URL(String(request),'https://wildz.quest');assert.equal(url.pathname,'/api/wilds/clearance/source');
  const source=url.searchParams.get('url');if(!source){configReads++;return Response.json({applicationId:'wildz'});}
  let state;
  if(source==='https://wildz.quest/receiz/resource-source-v128'){locatorReads++;state={schema:'wildz.resource-source-locator.v128',proof:reference};}
  else{pageReads++;const page=pages.get(source.split('/').at(-1));assert.ok(page);state={schema:'wildz.resource-source-page-locator.v128',page};}
  return Response.json({ok:true,record:createReceizPublicStoreStateRecord({sourceUrl:source,externalCreatorId:'public-cache-fixture',title:'Local public cache fixture',namespace:'wildz-resource-fixture',state:'published',record:state,data:{storeStateRecord:state}})});
 });
 const first=reader.read(),coalesced=reader.read();assert.equal(first,coalesced);const compact=await first;assert.ok(Object.keys(compact.buildingClearances).length);assert.ok(pageReads>0);
 const initialPageReads=pageReads;assert.equal(await reader.read(),compact);assert.equal(await reader.read(),compact);assert.equal(pageReads,initialPageReads);assert.equal(locatorReads,3);assert.equal(network,0);
 console.log(JSON.stringify({status:'verified-public-compact-cache',initialPageReads,unchangedAdditionalPageReads:pageReads-initialPageReads,locatorReads,configReads,stableProjection:true,network,identityAccess:false,sealing:false,hostCurrentness:false}));
}finally{globalThis.fetch=oldFetch;}
