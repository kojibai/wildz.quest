'use client';
/** Development-only setup for a disposable profile. Synthetic gameplay/index
 * provenance, actual repository scope, observation encryption and public index
 * signature verification. Disposable local keys are stored encrypted by the actual
 * repository. No default identity, enrollment or native source artifact is used. */
import {useEffect,useState} from 'react';
import Link from 'next/link';
import type {ReceizKeyFile} from '@receiz/sdk';
import {createWildzContinuityDatabase} from '@/lib/storage/wildz-indexed-db';
import {createWildzIdentityRepository,wildzOwnerScope,type WildzIdentitySession} from '@/lib/receiz/wildz-identity-repository';
import {createWildzWalletObservationStore} from '@/lib/receiz/wildz-wallet-observation';
import {loadWildzWalletPresentation} from '@/lib/receiz/wildz-wallet-presentation';
import {projectWildsWalletSummary} from '@/lib/receiz/wilds-wallet-projections';
import type {StoredWildzPlayState} from '@/features/identity/wildz-restore';
type Fixture={keyFile?:ReceizKeyFile;session:WildzIdentitySession;record:StoredWildzPlayState;index:unknown;metrics:Record<string,unknown>};
declare global {interface Window {pressureQA?:{setup(cohort:number,rows:number):Promise<unknown>;load():Promise<unknown>;observe(amount:string,origin?:'live'|'seal',pending?:boolean):Promise<void>;switchKey():Promise<void>};}}
export default function CampaignPressureBrowserFixture(){const [status,setStatus]=useState('DISPOSABLE SETUP · no default signer, native admission or funds');
useEffect(()=>{const database=createWildzContinuityDatabase(),repository=createWildzIdentityRepository({database});let session:WildzIdentitySession|null=null;
const observation=createWildzWalletObservationStore(database);
window.pressureQA={async setup(cohort,rows){const value=await (await fetch(`/qa-campaign-seed?cohort=${cohort}&rows=${rows}`)).json() as Fixture;session=value.session;
const prepared=value.keyFile?await repository.prepare(value.keyFile):null;
if(prepared){prepared.session={...value.session};prepared.walletObservation=undefined;}
await database.transaction(['meta','ownerStates','identities','artifacts'],'readwrite',async tx=>{if(prepared)await repository.writePrepared(tx,prepared,true);else await repository.writeSession(tx,value.session,true);await tx.put('ownerStates',value.record,wildzOwnerScope(value.session.keyId,value.session.actorId));await tx.put('meta',value.index,JSON.stringify(['wildz.wallet.resource-projection-index.v128',`${value.session.username}.receiz.id`,value.session.keyId]));});
await observation.observe(session,projectWildsWalletSummary({ok:true,balancePhiMicro:'1234567',balanceUsdCents:'987',transferableResourceCount:Number(value.metrics.rows),transferableCardCount:68,reservedCardCount:0,pendingCount:0}),'live');setStatus('Seeded disposable repository · '+JSON.stringify(value.metrics));return value.metrics;},
async load(){const active=await repository.active();if(!active)throw Error('fixture_session_missing');const start=performance.now(),presentation=await loadWildzWalletPresentation(database,active);return {elapsedMs:performance.now()-start,rows:presentation.resourceRows.length,phi:presentation.observation?.summary.admittedPhiMicro,basis:presentation.observation?.freshness};},
async observe(amount,origin='live',pending=false){const active=await repository.active();if(!active)throw Error('fixture_session_missing');await observation.observe(active,projectWildsWalletSummary({ok:true,balancePhiMicro:amount,balanceUsdCents:'987',transferableResourceCount:0,transferableCardCount:68,reservedCardCount:0,pendingCount:0} ),origin,pending?'pending':'observed');},
async switchKey(){const active=await repository.active();if(!active)throw Error('fixture_session_missing');await database.transaction(['meta'],'readwrite',tx=>repository.writeSession(tx,{...active,keyId:'f'.repeat(64),walletObservationEpoch:'00000000-0000-4000-8000-000000000003'},true));}
};return()=>{delete window.pressureQA;};},[]);
return <main><h1>Disposable Campaign pressure setup</h1><p>{status}</p><Link href="/">Open actual Campaign</Link></main>;}
