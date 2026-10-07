import assert from "node:assert/strict";
import test from "node:test";
import {applyWildsInput,createOwnerBoundInitialPlayState,initialPlayState,restorePlayState,serializePlayState,type PlayState} from "../src/features/play/game-state";
import {adoptWildsExplorerSagaProgress,createWildsExplorerProgress,projectWildsExplorerProgress} from "../src/features/play/wilds-explorer-progression";
import {projectWildzHud} from "../src/features/play/wildz-gameplay-hud";
import type {WildsPlayerSagaState} from "../src/features/play/wilds-world-state";

const OWNER="explorer.earned";
const fresh=()=>createOwnerBoundInitialPlayState(OWNER,"2026-10-07T00:00:00.000Z");
const saga=(trainerXp:number,achievementGrantIds:string[]=[]):WildsPlayerSagaState=>({
  trainerXp,trainerLevel:1+Math.floor(trainerXp/100),reputation:{},contributions:{},achievementGrantIds,rewardIds:[],achievementGrants:{}
});

test("each new explorer starts at level one without starter XP or earned achievements",()=>{
  for(const state of [initialPlayState,fresh(),createOwnerBoundInitialPlayState("another.explorer","2026-10-07T00:00:00Z")]){
    assert.equal(state.level,1);assert.equal(state.worldMastery,0);assert.equal(state.cardXp,0);
    assert.deepEqual(state.achievements,[]);assert.equal(projectWildsExplorerProgress(state).xp,0);
    assert.equal(state.inventory.length,1,"starter ownership is preserved");
  }
});

test("migration ignores inflated default levels and card XP without discarding real mastery",()=>{
  const legacy={...fresh(),level:8,cardXp:999,worldMastery:145,achievements:["first_spark","first-light","first-light"],completedMissionIds:["living-expedition:1"]};
  delete legacy.explorerProgress;
  const restored=restorePlayState(serializePlayState(legacy),OWNER);
  assert.equal(restored.level,2);assert.equal(projectWildsExplorerProgress(restored).xp,145);
  assert.deepEqual(restored.achievements,["first-light"]);assert.deepEqual(restored.completedMissionIds,["living-expedition:1"]);
  const inflated=restorePlayState(serializePlayState({...legacy,worldMastery:0,achievements:["first_spark"]}),OWNER);
  assert.equal(inflated.level,1);assert.equal(projectWildsExplorerProgress(inflated).xp,0);
});

test("a real capture completes an earned expedition once and never jumps to level eight",()=>{
  const state={...fresh(),player:{x:1.6,z:-2.1},missionProgress:95,discoveredCardIds:[fresh().discoveredCardIds[0]!,"ledgerfox"]};
  const input={type:"capture" as const,encounterId:"earned-explorer-capture",capturedAt:"2026-10-07T01:00:00.000Z",ownerReceizId:OWNER};
  const once=applyWildsInput(state,input),replayed=applyWildsInput(once,input);
  assert.equal(once.inventory.length,state.inventory.length+1);
  assert.equal(once.worldMastery,8);assert.equal(once.level,1);assert.equal(projectWildsExplorerProgress(once).xp,8);
  assert.deepEqual(once.completedMissionIds,["living-expedition:1"]);assert.deepEqual(once.achievements,["first-light"]);
  assert.equal(replayed.worldMastery,once.worldMastery);assert.equal(replayed.level,1);
  assert.deepEqual(replayed.completedMissionIds,once.completedMissionIds);assert.deepEqual(replayed.achievements,once.achievements);
});

test("importing a genuine creature card does not manufacture explorer progress",()=>{
  const state=fresh(),other=createOwnerBoundInitialPlayState("another.collector","2026-10-06T00:00:00Z");
  const imported=applyWildsInput(state,{type:"import-card",asset:other.inventory[0]!});
  assert.equal(imported.level,1);assert.equal(imported.worldMastery,0);assert.deepEqual(imported.achievements,[]);
  assert.equal(projectWildsExplorerProgress(imported).xp,0);
});

test("own admitted saga points and unique achievements combine with earned world mastery",()=>{
  const state={...fresh(),worldMastery:45,achievements:["first-light"]};
  const earned=adoptWildsExplorerSagaProgress(state,{ownerReceizId:OWNER,worldRevision:12,player:saga(80,["grant:one","grant:one","grant:two"])});
  assert.equal(earned.level,2);
  assert.deepEqual(projectWildsExplorerProgress(earned),{xp:125,level:2,levelXp:25,progress:25,nextLevelAt:200,remaining:75,achievementCount:3});
  const hud=projectWildzHud(earned,{username:OWNER,displayName:"Explorer"});
  assert.equal(hud.player.level,2);
  assert.deepEqual(hud.xp,{current:125,progress:25,levelXp:25,nextLevelAt:200,remaining:75,achievementCount:3});
  assert.equal(hud.energy.current,earned.energy);
});

test("snapshot replay and unrelated world revisions retain exact state identity",()=>{
  const player=saga(100,["grant:one"]),earned=adoptWildsExplorerSagaProgress(fresh(),{ownerReceizId:OWNER,worldRevision:12,player});
  assert.equal(adoptWildsExplorerSagaProgress(earned,{ownerReceizId:OWNER,worldRevision:12,player}),earned);
  assert.equal(adoptWildsExplorerSagaProgress(earned,{ownerReceizId:OWNER,worldRevision:99,player}),earned);
  assert.equal(earned.explorerProgress?.worldRevision,12,"unrelated changes need no persistence write");
});

test("absent, older, and regressed story snapshots preserve the last own admitted progress",()=>{
  const earned=adoptWildsExplorerSagaProgress(fresh(),{ownerReceizId:OWNER,worldRevision:20,player:saga(155,["grant:one"])});
  for(const input of [
    {worldRevision:21,player:null},
    {worldRevision:19,player:saga(200,["grant:two"])},
    {worldRevision:21,player:saga(0,[])},
    {worldRevision:21,player:{...saga(155),achievementGrantIds:null} as unknown as WildsPlayerSagaState}
  ])assert.equal(adoptWildsExplorerSagaProgress(earned,{ownerReceizId:OWNER,...input}),earned);
});

test("saved own native progress survives restoration and grants no progress to another owner",()=>{
  const earned=adoptWildsExplorerSagaProgress({...fresh(),worldMastery:75,achievements:["first-light"],completedMissionIds:["living-expedition:1"],missionProgress:95,completed:true},
    {ownerReceizId:OWNER,worldRevision:20,player:saga(150,["grant:one"])});
  const own=restorePlayState(serializePlayState(earned),OWNER);
  assert.equal(own.level,3);assert.equal(projectWildsExplorerProgress(own).xp,225);assert.equal(projectWildsExplorerProgress(own).achievementCount,2);
  const other=restorePlayState(serializePlayState(earned),"different.explorer");
  assert.equal(other.level,1);assert.equal(other.worldMastery,0);assert.equal(other.explorerProgress?.trainerXp,0);
  assert.deepEqual(other.achievements,[]);assert.deepEqual(other.completedMissionIds,[]);
  assert.equal(other.missionProgress,0);assert.equal(other.completed,false);
});

test("changing active owner starts fresh without changing creature levels",()=>{
  const state=fresh(),asset=state.inventory[0]!;
  const earned=adoptWildsExplorerSagaProgress({...state,worldMastery:250,achievements:["first-light"],missionProgress:95,completed:true,companionProgress:{[asset.id]:{level:8,xp:20,bond:50}}},
    {ownerReceizId:OWNER,worldRevision:12,player:saga(300,["grant:one"])});
  const switched=adoptWildsExplorerSagaProgress(earned,{ownerReceizId:"different.explorer",worldRevision:13,player:saga(0)});
  assert.equal(switched.level,1);assert.equal(projectWildsExplorerProgress(switched).xp,0);assert.deepEqual(switched.achievements,[]);
  assert.equal(switched.companionProgress[asset.id]?.level,8);
  assert.equal(switched.missionProgress,0);assert.equal(switched.completed,false);
});

test("malformed cached owners do not throw away otherwise valid saves",()=>{
  const state={...fresh(),worldMastery:125,lastEvent:"A recorded expedition was completed.",explorerProgress:{...createWildsExplorerProgress(OWNER),ownerReceizId:42} as unknown as PlayState["explorerProgress"]};
  const restored=restorePlayState(serializePlayState(state),OWNER);
  assert.equal(restored.worldMastery,125);assert.equal(restored.level,2);assert.equal(restored.lastEvent,state.lastEvent);
  assert.equal(restored.explorerProgress?.ownerReceizId,OWNER);
});

test("legacy authenticated explorer continuity preserves progress across historical card and nourishment owners",()=>{
  const historical=createOwnerBoundInitialPlayState("historical.source.owner","2026-10-01T00:00:00Z");
  const legacy={...fresh(),inventory:historical.inventory,playerNourishment:historical.playerNourishment,worldMastery:141,
    missionProgress:41,completed:true,completedMissionIds:["living-expedition:1"],achievements:["first-light"]};
  delete legacy.explorerProgress;
  const restored=restorePlayState(serializePlayState(legacy),OWNER);
  assert.equal(restored.worldMastery,141);assert.equal(restored.level,2);assert.equal(restored.missionProgress,41);
  assert.equal(restored.completed,true);assert.deepEqual(restored.completedMissionIds,["living-expedition:1"]);
  assert.deepEqual(restored.achievements,["first-light"]);assert.equal(restored.explorerProgress?.ownerReceizId,OWNER);
  assert.equal(restored.inventory[0]?.manifest.ownerReceizId,"historical.source.owner","original card proof is preserved");
});

test("maximum explorer level has complete progress and no remaining next-level points",()=>{
  const progress=projectWildsExplorerProgress({...fresh(),worldMastery:12_000});
  assert.equal(progress.level,100);assert.equal(progress.levelXp,100);assert.equal(progress.progress,100);
  assert.equal(progress.remaining,0);assert.equal(progress.nextLevelAt,null);
});
