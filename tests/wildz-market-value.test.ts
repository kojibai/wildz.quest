import assert from 'node:assert/strict';
import {test} from 'node:test';
import {formatWildzMarketKai,formatWildzMarketValueChange,wildzMarketValueChange,wildzMarketValueGeometry} from '../src/features/market/wildz-market-value';
import {latestWildzOwnershipClaims,WILDZ_OWNERSHIP_SYNC_NAMESPACE,WILDZ_OWNERSHIP_SYNC_SCHEMA} from '../src/lib/receiz/wildz-ownership-reconcile';

test('chart coordinates retain micro-pulse precision above Number’s safe range',()=>{
 const points=[{kaiUPulse:'900719925474099312345',phiMicro:'2000000',usdCents:'800'},{kaiUPulse:'900719925474099312344',phiMicro:'1000000',usdCents:'1000'}];
 const result=wildzMarketValueGeometry(points,'usd');assert.equal(result.points[0]!.point.kaiUPulse,points[1]!.kaiUPulse);assert.equal(result.points[0]!.x,28);assert.equal(result.points[1]!.x,472);
 assert.equal(wildzMarketValueChange(points,'usd'),'-2000');assert.equal(formatWildzMarketValueChange('-2000'),'-20.00%');
 assert.equal(wildzMarketValueChange(points,'phi'),'10000');assert.equal(points[0]!.kaiUPulse,'900719925474099312345');
});
test('Kai labels project the whole pulse without modifying the exact history coordinate',()=>{
 assert.equal(formatWildzMarketKai('16000031000009'),'☤KAI 16,000,031');assert.equal(formatWildzMarketKai('invalid'),'☤KAI —');
 assert.equal(wildzMarketValueGeometry([],'usd').line,'');assert.equal(wildzMarketValueChange([{kaiUPulse:'1',phiMicro:'0',usdCents:null}],'phi'),null);
});

const claim=(owner:string,upulse:string,count:number)=>({namespace:WILDZ_OWNERSHIP_SYNC_NAMESPACE,schema:WILDZ_OWNERSHIP_SYNC_SCHEMA,state:'published',data:{schema:WILDZ_OWNERSHIP_SYNC_SCHEMA,assetId:`wilds:${'a'.repeat(24)}`,artifactId:'b'.repeat(64),previousOwnerReceizId:'before.receiz.id',ownerReceizId:owner,headReference:`head:${upulse}`,historyDigestSha256:'c'.repeat(64),appendCount:count,witnessedKaiPulse:(BigInt(upulse)/1000000n).toString(),witnessedKaiUPulse:upulse,witnessedAt:'2026-10-11T12:00:00.000Z',authority:{claim:'witnessed-kai-pulse-in-sealed-artifact',server:'synchronization-projection-only'}}});
test('the latest owner uses exact uPulse even within one displayed Kai pulse and despite append ordering',()=>{
 const first=claim('first.receiz.id','16000000100001',100),next=claim('second.receiz.id','16000000100002',2),id=first.data.assetId;
 assert.equal(latestWildzOwnershipClaims([next,first]).heads.get(id)?.ownerReceizId,'second.receiz.id');
 assert.equal(latestWildzOwnershipClaims([first,next]).heads.get(id)?.ownerReceizId,'second.receiz.id');
});
