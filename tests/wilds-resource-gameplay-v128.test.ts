import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createWildsNourishmentState, gatherWildsNourishment, wildsNourishmentPlantsForTile, wildsNourishmentSourceAt } from '../src/features/play/wilds-nourishment';
import { projectWildsResourceRegion } from '../src/features/play/wilds-resource-authority';
import { createWildsSourceAuthorityProjection, planWildsMaterialHarvest } from '../src/features/play/wilds-source-work-authority';
import { replayWildsResourceGameplayV128, type WildsResourceGameplayCommandV128 } from '../src/lib/receiz/wilds-resource-gameplay-v128';

const OWNER = 'explorer', KAI = 100_000_000;
function foodCommand(): Extract<WildsResourceGameplayCommandV128, {kind:'food.gather'}> {
  const plant = Array.from({length:9},(_,i)=>wildsNourishmentPlantsForTile(i-4,-4)).flat()[0]!;
  return {kind:'food.gather',commandId:'gather:one',sourceId:plant.sourceId,expectedSourceHead:wildsNourishmentSourceAt(plant,undefined,KAI).head,
    kaiUPulse:KAI,player:plant.position,spaceId:'wildz.space.outer.v1'};
}
test('complete gather command replays exact finite food birth; saved items and caller checkpoints do not', async () => {
  const command=foodCommand(), replay=await replayWildsResourceGameplayV128({gameplayOwnerId:OWNER,commands:[command]});
  const expected=gatherWildsNourishment({...command,state:createWildsNourishmentState(OWNER),ownerReceizId:OWNER});
  assert.equal(expected.ok,true); assert.deepEqual(replay.nourishment,expected.state);
  assert.equal(Object.values(replay.members)[0]?.kind,'food');
  await assert.rejects(replayWildsResourceGameplayV128({gameplayOwnerId:OWNER,commands:[{...command,state:expected.state} as never]}),/command_invalid/);
  await assert.rejects(replayWildsResourceGameplayV128({gameplayOwnerId:OWNER,commands:[{...command,player:{...command.player,x:command.player.x+50}}]}),/out-of-reach/);
});
test('actual hay material command replays from deterministic world genesis; raw lot transfer cannot create birth', async () => {
  const source=projectWildsResourceRegion(0,0).find(s=>s.kind==='hay')!;
  const command=planWildsMaterialHarvest({projection:createWildsSourceAuthorityProjection(),source,actorId:OWNER,actorPosition:source.position,kaiUPulse:KAI,commandId:'material:one'});
  const replay=await replayWildsResourceGameplayV128({gameplayOwnerId:OWNER,commands:[{kind:'world',command,kaiUPulse:KAI}]});
  assert.equal(Object.values(replay.members).filter(member=>member.kind==='material').length,1);
  await assert.rejects(replayWildsResourceGameplayV128({gameplayOwnerId:OWNER,commands:[{kind:'world',command:{type:'resource.material.transfer.admit',lotId:'made-up',ownerReceizId:OWNER,subjectId:'fake',subjectHead:'a'.repeat(64),receiptId:'fake',transferId:'fake',commandId:'transfer:one'},kaiUPulse:KAI}]}),/command_unsupported/);
});
test('duplicate command ID with altered inputs and stale crop heads reject the entire candidate', async () => {
  const command=foodCommand();
  await assert.rejects(replayWildsResourceGameplayV128({gameplayOwnerId:OWNER,commands:[command,{...command,commandId:'gather:two'}]}),/stale-source/);
  await assert.rejects(replayWildsResourceGameplayV128({gameplayOwnerId:OWNER,commands:[command,{...command,player:{...command.player,x:command.player.x+1}}]}),/command_conflict/);
});
