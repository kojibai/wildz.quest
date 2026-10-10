import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createMemoryWildzContinuityDatabase} from './support/memory-wildz-continuity-database';
import {queueWildsResourceGameplayV128,readWildsResourceGameplayHistoryV128,resolveWildsResourceGameplayOriginalsV128} from '../src/lib/receiz/wilds-resource-gameplay-store-v128';
import type {WildsResourceGameplayCommandV128} from '../src/lib/receiz/wilds-resource-gameplay-v128';
const scope={ownerReceizId:'alice.receiz.id',gameplayOwnerId:'explorer'};
const command=(id:string,kai:number):WildsResourceGameplayCommandV128=>({kind:'food.consume',commandId:id,itemId:'food:test',kaiUPulse:kai,reserveMicroBreaths:0});

test('delayed admitted commands retain rooted chronological order and stable equal-Kai order',async()=>{
 const database=createMemoryWildzContinuityDatabase();
 for(const [id,kai] of [['later:one',102],['early:one',100],['same:one',102],['early:two',100]] as const)
  await queueWildsResourceGameplayV128({database,...scope,command:command(id,kai)});
 const history=await readWildsResourceGameplayHistoryV128(database,scope.ownerReceizId,scope.gameplayOwnerId);
 assert.deepEqual(history.commands.map(c=>c.kind==='world'?c.command.commandId:c.commandId),['early:one','early:two','later:one','same:one']);
 await queueWildsResourceGameplayV128({database,...scope,command:command('early:one',100)});
 assert.equal((await readWildsResourceGameplayHistoryV128(database,scope.ownerReceizId,scope.gameplayOwnerId)).commands.length,4);
 await assert.rejects(queueWildsResourceGameplayV128({database,...scope,command:command('early:one',99)}),/command_conflict/);
});

test('capture custody snapshots exact inputs without invoking a source resolver or SDK',async()=>{
 const database=createMemoryWildzContinuityDatabase(),entry=command('capture:one',100);
 await queueWildsResourceGameplayV128({database,...scope,command:entry});
 (entry as {itemId:string}).itemId='changed';
 assert.equal((await readWildsResourceGameplayHistoryV128(database,scope.ownerReceizId,scope.gameplayOwnerId)).commands[0]?.kind,'food.consume');
 assert.equal(((await readWildsResourceGameplayHistoryV128(database,scope.ownerReceizId,scope.gameplayOwnerId)).commands[0] as {itemId:string}).itemId,'food:test');
 let reads=0;await resolveWildsResourceGameplayOriginalsV128({database,...scope,resolveOriginal:async()=>{reads++;return null;}});
 assert.equal(reads,0);
 await assert.rejects(readWildsResourceGameplayHistoryV128(database,scope.ownerReceizId,'another-player'),/binding_invalid/);
});
