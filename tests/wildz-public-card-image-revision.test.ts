import assert from 'node:assert/strict';
import {test} from 'node:test';
import {NextRequest} from 'next/server';
import {GET} from '../app/api/cards/[assetId]/image/route';
import {initialPlayState} from '../src/features/play/game-state';

test('card images are pinned to the requested proof revision and reject malformed digests before lookup',async context=>{
 const asset=initialPlayState.inventory[0]!,params=Promise.resolve({assetId:asset.id});
 let reads=0;
 context.mock.method(globalThis,'fetch',async()=>{reads++;return Response.json({ok:true,record:{schema:'receiz.wilds_public_card.v1',assetId:asset.id,asset}});});
 const url=`https://wildz.quest/api/cards/${encodeURIComponent(asset.id)}/image?profile=cardowner`;
 const invalid=await GET(new NextRequest(`${url}&digest=wrong`),{params});
 assert.equal(invalid.status,400);assert.equal(reads,0);
 const exact=await GET(new NextRequest(`${url}&digest=${encodeURIComponent(asset.proof.digest)}`),{params});
 assert.equal(exact.status,200);assert.match(exact.headers.get('content-type')??'',/image\/svg/);
 assert.match(await exact.text(),new RegExp(asset.manifest.name));
 const changed=await GET(new NextRequest(`${url}&digest=sha256:${'0'.repeat(64)}`),{params});
 assert.equal(changed.status,409);assert.equal(changed.headers.get('cache-control'),'no-store');
});
