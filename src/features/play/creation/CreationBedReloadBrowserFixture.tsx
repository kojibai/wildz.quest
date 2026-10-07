'use client';

import { Component, useEffect, useState, type ReactNode } from 'react';
import { createPlacementFixture } from './CreationPlacementBrowserFixture';
import { compileCreation } from './compiler';
import { resolveCreationBed } from './bed';
import { PlayCampaign } from '../PlayCampaign';
import { createOwnerBoundInitialPlayState, applyWildsInput, restorePlayState, serializePlayState, type PlayState } from '../game-state';
import { createPlayerBreaths } from '../player-breath-energy';
import { deriveKaiKlokMoment } from '../kai-klok-moment';
import { generateWildzCharacter } from '@/features/identity/wildz-genesis';
import { projectWildsOwnedWorldAdditions } from '../wilds-player-world-additions';

type Fixture = ReturnType<typeof createPlacementFixture>;
class ReloadErrorBoundary extends Component<{children:ReactNode},{error:string|null}> {
  state={error:null as string|null};
  static getDerivedStateFromError(error:Error){return {error:error.stack||error.message};}
  render(){return this.state.error?<pre role="alert">{this.state.error}</pre>:this.props.children;}
}

export default function CreationBedReloadBrowserFixture(){
  const [data,setData]=useState<{fixture:Fixture;state:PlayState}|null>(null),[error,setError]=useState('');
  useEffect(()=>{
    const fixture=createPlacementFixture({ownerId:'creation_bed_fixture',storageKey:'wildz:test-fixture:creation-bed-reload:v1'});let cancelled=false;
    void (async()=>{
      await fixture.controller.restore();
      if(!fixture.controller.snapshot().projections.length){
        const result=compileCreation(fixture.definition,fixture.context);
        if(result.status!=='ready')throw Error('fixture_compile_unavailable');
        const committed=await fixture.controller.commit(fixture.definition,result.plan,[fixture.workerId]);
        if(committed.status!=='admitted')throw Error('fixture_commit_unavailable');
      }
      const source=fixture.controller.snapshot(),instance=Object.values(source.instances)[0];
      const node=Object.values(instance.nodeStates).find(node=>node.kind==='bed');
      if(!node)throw Error('fixture_bed_missing');
      const kai=deriveKaiKlokMoment({occurredAt:new Date().toISOString(),authority:'local'}).uPulse;
      const bed=resolveCreationBed(fixture.controller.snapshot,instance.instanceId,node.nodeId,fixture.owner,kai);
      if(!bed)throw Error('fixture_bed_unavailable');
      const player={x:bed.position.x,z:bed.position.z},position={...bed.position,y:fixture.context.pose.position.y+.1};
      const base=createOwnerBoundInitialPlayState(fixture.owner);
      const initial={...base,inventory:[fixture.card],selectedAssetId:fixture.card.id,selectedCardId:fixture.card.manifest.familyId,ownedWorldAdditions:projectWildsOwnedWorldAdditions(fixture.queue.current(),fixture.owner),adventureConditions:fixture.conditions,player,siteSpace:{...base.siteSpace,spaceId:fixture.context.spaceId,position},playerBreaths:createPlayerBreaths(kai,35)};
      const sleeping=applyWildsInput(initial,{type:'rest',creationBed:bed,kaiUPulse:kai});
      const restored=restorePlayState(serializePlayState(sleeping),fixture.owner);
      if(!cancelled)setData({fixture,state:restored});
    })().catch(error=>{if(!cancelled)setError(error.stack||error.message);});
    return()=>{cancelled=true;fixture.controller.close();fixture.worker.close();};
  },[]);
  if(error)return <pre role="alert">{error}</pre>;
  if(!data)return <p>Restoring synthetic saved house and sleeping player…</p>;
  const {fixture,state}=data;
  return <ReloadErrorBoundary><PlayCampaign enabled networkEnabled={false} creationController={fixture.controller}
    ownerReceizId={fixture.owner} initialState={state} initialWorld={{projection:fixture.queue.current(),mode:'kai_live'}}
    character={generateWildzCharacter({identityRef:fixture.owner,kaiPulse:'1',gender:'female',version:1})}
    playerDisplayName="Saved bed reload fixture" walletAuthorityGeneration="fixture" walletIdentityKey={fixture.owner} walletPublicUsername={null}
    onPlayStateChange={()=>{}} onPrepareCard={async()=>{throw Error('fixture_export_disabled');}}
    onExportCard={async()=>{}} onExportVault={async()=>{}} vaultAdmission={null}
    onRestoreArtifact={async()=>{throw Error('fixture_import_disabled');}} onRestoreRoamingCapture={async()=>{throw Error('fixture_import_disabled');}} /></ReloadErrorBoundary>;
}
