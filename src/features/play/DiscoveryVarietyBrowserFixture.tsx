'use client';
import {useEffect,useState} from 'react';
import {createPlacementFixture} from './creation/CreationPlacementBrowserFixture';
import {createOwnerBoundInitialPlayState} from './game-state';
import {PlayCampaign} from './PlayCampaign';
import {admitWildsDiscoveryPhysicalNeighborhood,wildsDiscoverySitesForRegion} from './wilds-discovery-sites';
import {projectWildsMonuments} from './wilds-discovery-monuments';
import {wildsSiteRuntimeGroundY,prepareWildsSiteRuntime} from './wilds-site-runtime';
import {generateWildzCharacter} from '../identity/wildz-genesis';
import {wildsTerrainElevation} from './wilds-terrain-authority';

function locations(){
 const sites=[];
 for(let z=-8;z<=8;z++)for(let x=-8;x<=8;x++)sites.push(...wildsDiscoverySitesForRegion(x,z));
 const monuments=projectWildsMonuments(sites);
 const options=['stone-arch','compass','prism'].map(type=>{const monument=monuments.find(m=>m.type===type&&m.position.y>-.9)!;return {label:type,x:monument.position.x+2.8,z:monument.position.z};});
 const waterfall=admitWildsDiscoveryPhysicalNeighborhood(-3,0).sites.find(site=>site.waterfall)!;
 return [{label:'Mountain waterfall',x:waterfall.waterfall!.pool.x+4,z:waterfall.waterfall!.pool.z},...options];
}
const options=locations();
export default function DiscoveryVarietyBrowserFixture(){
 const [fixture,setFixture]=useState<ReturnType<typeof createPlacementFixture>|null>(null),[choice,setChoice]=useState(0);
 useEffect(()=>{const f=createPlacementFixture({ownerId:'discovery_variety_fixture',storageKey:'wildz:test-fixture:discovery-variety:v1'});setFixture(f);return()=>{f.controller.close();f.worker.close();};},[]);
 if(!fixture)return <p>Loading discovery fixture…</p>;
 const point=options[choice]!,base=createOwnerBoundInitialPlayState(fixture.owner),player={x:point.x,z:point.z};
 const runtime=prepareWildsSiteRuntime(admitWildsDiscoveryPhysicalNeighborhood(Math.floor(player.x/128),Math.floor(player.z/128)));
 const y=wildsSiteRuntimeGroundY(runtime,base.siteSpace.spaceId,player.x,player.z,wildsTerrainElevation(player.x,player.z));
 const initial={...base,inventory:[fixture.card],selectedAssetId:fixture.card.id,selectedCardId:fixture.card.manifest.familyId,adventureConditions:fixture.conditions,player,siteSpace:{...base.siteSpace,position:{...player,y}}};
 return <><nav aria-label="Discovery test locations">{options.map((option,index)=><button key={option.label} type="button" onClick={()=>setChoice(index)}>{option.label}</button>)}</nav><PlayCampaign key={choice} enabled networkEnabled={false} creationController={fixture.controller}
  ownerReceizId={fixture.owner} initialState={initial} initialWorld={{projection:fixture.queue.current(),mode:'kai_live'}}
  character={generateWildzCharacter({identityRef:fixture.owner,kaiPulse:'1',gender:'female',version:1})}
  playerDisplayName="Discovery variety fixture" walletAuthorityGeneration="fixture" walletIdentityKey={fixture.owner} walletPublicUsername={null}
  onPlayStateChange={()=>{}} onPrepareCard={async()=>{throw Error('fixture_export_disabled');}} onExportCard={async()=>{}} onExportVault={async()=>{}} vaultAdmission={null}
  onRestoreArtifact={async()=>{throw Error('fixture_import_disabled');}} onRestoreRoamingCapture={async()=>{throw Error('fixture_import_disabled');}} /></>;
}
