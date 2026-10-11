import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {test} from 'node:test';
import {runInNewContext} from 'node:vm';

const origin='https://wildz.quest';
const scriptBoundary='__webpack_require__.tu';
const environment={URL,self:{location:{href:`${origin}/offline`}}};
const runtimeSource=async()=> (await import(pathToFileURL(resolve('scripts/worker-deployment-plugin.mjs')).href)).deploymentScriptRuntime;

test('worker entries and imported dependencies remain on their own opened deployment',async()=>{
 const source=await runtimeSource();
 for(const deployment of ['dpl_old','dpl_new']){
  const page={tu:(url:string)=>url};
  runInNewContext(source(deployment,scriptBoundary),{...environment,__webpack_require__:page});
  const entry=page.tu(`${origin}/_next/static/chunks/4211.hash.js`);
  assert.equal(entry,`${origin}/_next/static/chunks/4211.hash.js?dpl=${deployment}`);
  const worker={tu:(url:string)=>url};
  runInNewContext(source(undefined,scriptBoundary),{URL,self:{location:{href:entry}},__webpack_require__:worker});
  assert.equal(worker.tu(`${origin}/_next/static/chunks/shared.hash.js`),`${origin}/_next/static/chunks/shared.hash.js?dpl=${deployment}`);
 }
});

test('deployment binding respects Next filename encoding, existing queries and Trusted Types',async()=>{
 const source=await runtimeSource();
 const runtime={u:(id:number)=>`static/chunks/${id}.hash.js`,tu:(value:string)=>({trustedScriptUrl:value})};
 runInNewContext(source('dpl /?',scriptBoundary),{...environment,__webpack_require__:runtime});
 // Next's app-webpack wraps .u after runtime initialization.
 const filename=runtime.u;runtime.u=id=>filename(id).split('/').map(encodeURIComponent).join('/');
 assert.equal(runtime.tu(`${origin}/_next/${runtime.u(4211)}`).trustedScriptUrl,`${origin}/_next/static/chunks/4211.hash.js?dpl=dpl+%2F%3F`);
 const queried=runtime.tu(`${origin}/_next/shared.js?existing=yes&dpl=stale`).trustedScriptUrl;
 assert.equal(new URL(queried).searchParams.get('existing'),'yes');
 assert.equal(new URL(queried).searchParams.get('dpl'),'dpl /?');
 assert.equal(new URL(queried).searchParams.getAll('dpl').length,1);
});

test('Vercel page markers and ordinary localhost builds work without a build-time deployment ID',async()=>{
 const source=await runtimeSource(),page={tu:(url:string)=>url};
 runInNewContext(source(undefined,scriptBoundary),{...environment,__webpack_require__:page,document:{baseURI:`${origin}/offline`,querySelector:()=>({getAttribute:()=> 'dpl_page'})}});
 assert.equal(page.tu(`${origin}/_next/worker.js`),`${origin}/_next/worker.js?dpl=dpl_page`);
 const local={tu:(url:string)=>url};
 runInNewContext(source(undefined,scriptBoundary),{...environment,__webpack_require__:local});
 assert.equal(local.tu('static/chunks/local.js'),'static/chunks/local.js');
});
