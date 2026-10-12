import assert from 'node:assert/strict';
import {test} from 'node:test';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

test('production value worker keeps its SDK dependencies in its own runtime rather than page-only shared chunks',async()=>{
 const config=(await import(pathToFileURL(resolve('next.config.mjs')).href)).default;
 const make=(name:string,initial=false)=>({name,canBeInitial:()=>initial});
 const original=(chunk:{name:string})=>chunk.name!=='page-excluded';
 const optimization={splitChunks:{chunks:original,cacheGroups:{default:{chunks:'all'},lazy:{chunks:'async'},disabled:false}}};
 const configured={optimization,plugins:[],resolve:{}};
 // The existing worker deployment plugin only constructs RuntimeModule after
 // apply; this call just inspects the real Next optimization configuration.
 config.webpack(configured,{isServer:false,webpack:{NormalModuleReplacementPlugin:class {},RuntimeModule:class {}},config:{}});
 const split=configured.optimization.splitChunks;
 const chunks=split.chunks as (chunk:ReturnType<typeof make>)=>boolean;
 assert.equal(chunks(make('wildz-market-value')),false);
 assert.equal(chunks(make('page-excluded')),false);
 assert.equal(chunks(make('market-page')),true);
 for(const group of [split.cacheGroups.default,split.cacheGroups.lazy]){
  const admits=group.chunks as unknown as (chunk:ReturnType<typeof make>)=>boolean;
  assert.equal(admits(make('wildz-market-value')),false);
 }
 const asyncChunks=split.cacheGroups.lazy.chunks as unknown as (chunk:ReturnType<typeof make>)=>boolean;
 assert.equal(asyncChunks(make('another-worker')),true);
 assert.equal(asyncChunks(make('market-page',true)),false);
 assert.equal(split.cacheGroups.disabled,false);
});
