import type {PlayState} from "./game-state";
import type {WildsPlayerSagaState} from "./wilds-world-state";
import {sameWildzPlayerCoordinate} from "../../lib/receiz/wildz-player-coordinate";

/** Cached presentation of this explorer's admitted story progress. Existing
 * world mastery and story XP remain the sources; this creates no reward ledger. */
export type WildsExplorerProgress = Readonly<{
  schema:"wildz.explorer-progress.v1";
  ownerReceizId:string;
  worldRevision:number;
  trainerXp:number;
  achievementGrantIds:readonly string[];
}>;
const sameOwner=(a:string,b:string)=>a===b || sameWildzPlayerCoordinate(a,b);
const points=(value:unknown)=>typeof value==="number" && Number.isFinite(value)?Math.max(0,Math.floor(value)):0;

export function createWildsExplorerProgress(ownerReceizId:string):WildsExplorerProgress{
  return {schema:"wildz.explorer-progress.v1",ownerReceizId,worldRevision:0,trainerXp:0,achievementGrantIds:[]};
}

export function restoreWildsExplorerProgress(value:unknown,ownerReceizId:string):WildsExplorerProgress{
  const saved=value as Partial<WildsExplorerProgress>|null|undefined;
  if(!saved || saved.schema!=="wildz.explorer-progress.v1" || typeof saved.ownerReceizId!=="string" || !sameOwner(saved.ownerReceizId,ownerReceizId)
    || !Number.isSafeInteger(saved.worldRevision) || saved.worldRevision!<0 || !Number.isSafeInteger(saved.trainerXp) || saved.trainerXp!<0
    || saved.trainerXp!>10_000 || !Array.isArray(saved.achievementGrantIds))return createWildsExplorerProgress(ownerReceizId);
  return {schema:saved.schema,ownerReceizId,worldRevision:saved.worldRevision!,trainerXp:saved.trainerXp!,
    achievementGrantIds:[...new Set(saved.achievementGrantIds.filter((id):id is string=>typeof id==="string" && id.length>0 && id.length<=512))].slice(-4096)};
}

/** Scalar projection only: safe on HUD frames, with no inventory/history scans.
 * The 100-point scale matches the existing saga trainer-level projection. */
export function projectWildsExplorerProgress(state:Pick<PlayState,"worldMastery"|"explorerProgress"|"achievements">){
  const xp=Math.min(9999,points(state.worldMastery)+points(state.explorerProgress?.trainerXp));
  const level=Math.min(100,1+Math.floor(xp/100)),levelXp=level>=100?100:xp%100;
  return {xp,level,levelXp,progress:level>=100?100:levelXp,nextLevelAt:level>=100?null:level*100,
    remaining:level>=100?0:100-levelXp,achievementCount:state.achievements.length+(state.explorerProgress?.achievementGrantIds.length??0)};
}

/** Called at the admitted world snapshot boundary, never for a UI command or
 * arbitrary count. Weak/absent snapshots retain the last own earned progress. */
export function adoptWildsExplorerSagaProgress(state:PlayState,input:Readonly<{ownerReceizId:string;worldRevision:number;player:WildsPlayerSagaState|null}>):PlayState{
  const prior=state.explorerProgress;
  const ownerChanged=Boolean(prior && !sameOwner(prior.ownerReceizId,input.ownerReceizId));
  const owned=ownerChanged?{...state,worldMastery:0,achievements:[],completedMissionIds:[],missionProgress:0,completed:false,explorerProgress:createWildsExplorerProgress(input.ownerReceizId)}:state;
  const previous=owned.explorerProgress;
  if(!input.player || !Number.isSafeInteger(input.worldRevision) || input.worldRevision<0
    || !Number.isSafeInteger(input.player.trainerXp) || input.player.trainerXp<0 || input.player.trainerXp>10_000
    || !Array.isArray(input.player.achievementGrantIds)
    || previous && input.worldRevision<previous.worldRevision)return ownerChanged?{...owned,level:1}:state;
  const achievementGrantIds=[...new Set(input.player.achievementGrantIds)].filter(id=>typeof id==="string" && id.length>0 && id.length<=512).slice(-4096);
  if(previous && input.player.trainerXp<previous.trainerXp)return ownerChanged?{...owned,level:1}:state;
  if(previous && input.player.trainerXp===previous.trainerXp && achievementGrantIds.length===previous.achievementGrantIds.length
    && achievementGrantIds.every((id,index)=>id===previous.achievementGrantIds[index]))return ownerChanged?{...owned,level:1}:state;
  const next={...owned,explorerProgress:{schema:"wildz.explorer-progress.v1" as const,ownerReceizId:input.ownerReceizId,
    worldRevision:input.worldRevision,trainerXp:input.player.trainerXp,achievementGrantIds}};
  return {...next,level:projectWildsExplorerProgress(next).level};
}
