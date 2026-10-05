'use client';
import { WildsCreatureThumbnail } from '../WildsCreatureThumbnail';
import { Hammer, Minus, RotateCw, Send, Sparkles, Users, Wheat, X } from 'lucide-react';
import type { CreationConversationState, CreationConversationEvent } from './conversation';
import type { CreationWorker } from './capabilities';
import type { PortableCardAsset } from '../portable-card';
export type CreationPanelProps={state:CreationConversationState;workers:readonly CreationWorker[];cards:readonly PortableCardAsset[];materialCounts:Record<string,number>;onChange:(e:CreationConversationEvent)=>void;onAsk:()=>void;onBuild:()=>void;onClose:()=>void;onManualBuild:()=>void;canBuild:boolean;classes?:Record<string,string>};
export function WildsCreationPanel({state,workers,cards,materialCounts,onChange,onAsk,onBuild,onClose,onManualBuild,canBuild,classes={}}:CreationPanelProps){
 const c=(key:string)=>classes[key]||`creation-${key}`,busy=['planning','committing','recovering'].includes(state.status);
 if(state.minimized)return <button className={c('minimized')} onClick={()=>onChange({type:'minimize'})} aria-label="Expand creation conversation"><Sparkles size={18}/>Creation</button>;
 return <section className={c('panel')} aria-label="Create with creatures" onKeyDown={event=>event.stopPropagation()}>
  <header className={c('header')}><span><Sparkles size={17}/><strong>Create</strong></span><div><button type="button" aria-label="Minimize creation conversation" onClick={()=>onChange({type:'minimize'})}><Minus size={17}/></button><button type="button" aria-label="Close creation conversation" onClick={onClose}><X size={18}/></button></div></header>
  <div className={c('body')}>
   {state.history.length?<div className={c('history')} aria-live="polite">{state.history.slice(-6).map((item,i)=><p key={`${i}:${item.role}`} data-speaker={item.role}>{item.text}</p>)}</div>:<div className={c('welcome')}><p>What would you like to build?</p><small>A home among the trees. A gathering place. Something entirely yours.</small></div>}
   <div className={c('menus')}>
    <details><summary aria-label="Choose creatures" title="Choose creatures"><Users size={17}/><span>{state.workerIds.length?`${state.workerIds.length} creatures`:'Creatures'}</span></summary><div className={c('roster')}>{workers.map(worker=>{const card=cards.find(card=>card.id===worker.assetId);return <button type="button" key={worker.assetId} disabled={!worker.ready||busy} aria-pressed={state.workerIds.includes(worker.assetId)} title={worker.reasons.join(' ')||worker.techniques.join(' · ')} onClick={()=>onChange({type:'workers',ids:state.workerIds.includes(worker.assetId)?state.workerIds.filter(id=>id!==worker.assetId):[...state.workerIds,worker.assetId]})}><span className={c('portrait')} aria-hidden="true">{card?<WildsCreatureThumbnail asset={card}/>: '✦'}</span><span>{card?.manifest.name||'Companion'}<small>{worker.ready?worker.techniques.join(' · '):'Needs care'}</small></span></button>;})}{!workers.length?<small>No current creatures are available.</small>:null}</div></details>
    <details><summary aria-label="Allocate resources" title="Allocate resources"><Wheat size={17}/><span>Resources</span></summary><div className={c('resources')}>{['hay','timber','stone'].map(kind=><label key={kind}><span>{kind}<small>{materialCounts[kind]||0} carried</small></span><input aria-label={`${kind} resource budget`} disabled={busy} type="number" min={0} max={materialCounts[kind]||0} step={1} value={state.budget[kind]||0} onChange={event=>onChange({type:'budget',budget:{...state.budget,[kind]:Math.max(0,Math.min(materialCounts[kind]||0,Math.floor(Number(event.target.value)||0)))}})}/></label>)}</div></details>
    <details className={c('manual')}><summary aria-label="Manual building" title="Manual building"><Hammer size={17}/></summary><button type="button" onClick={onManualBuild}>Open building pieces</button></details>
   </div>
   <form className={c('composer')} onSubmit={event=>{event.preventDefault();onAsk();}}><textarea aria-label="Creation prompt" placeholder={state.definition?'Tell your creatures what to change…':'Tell your creatures what to build…'} maxLength={4000} rows={3} disabled={busy} value={state.draft} onChange={event=>onChange({type:'draft',text:event.target.value})}/><button type="submit" disabled={busy||!state.draft.trim()||!state.workerIds.length} aria-label="Send creation prompt"><Send size={17}/></button></form>
   {state.definition?<small className={c('binding')}>Changes apply to your selected creation.</small>:null}
   {state.status==='planning'?<p role="status" className={c('status')}>Your creatures are considering the design…</p>:null}
   {state.reason?<p role="status" className={c('status')}>{state.reason}</p>:null}
   {state.status==='preview'?<div className={c('previewActions')}><div><small>Preview · {Object.entries(state.plan?.requiredResources||{}).map(([kind,n])=>`${n} ${kind}`).join(' · ')}</small><button type="button" aria-label="Rotate creation" onClick={()=>onChange({type:'placement',pose:{...state.placement,yaw:state.placement.yaw+Math.PI/2}})}><RotateCw size={17}/></button></div><button type="button" disabled={!canBuild} onClick={onBuild}>Build here</button>{!canBuild?<small>Live construction is awaiting authenticated world admission.</small>:null}</div>:null}
  </div>
 </section>;
}
