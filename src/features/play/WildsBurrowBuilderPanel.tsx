"use client";
import {useState} from "react";
import {useWildsFloatingPanel} from "./use-wilds-floating-panel";
import {GripHorizontal,Minus,ArrowDown,ArrowUp,Pickaxe,RotateCw,X} from "lucide-react";
import type {useWildsBurrowBuilder} from "./use-wilds-burrow-builder";
export function WildsBurrowBuilderPanel({builder}:{builder:ReturnType<typeof useWildsBurrowBuilder>}){
  const floating=useWildsFloatingPanel(),[minimized,setMinimized]=useState(false);
  if(minimized)return <button className="wilds-builder-restore" type="button" aria-label="Restore underground panel" onClick={()=>setMinimized(false)}><Pickaxe size={18}/> Underground</button>;
  return <aside ref={floating.ref} style={floating.style} className="wilds-continuous-builder wilds-burrow-builder" aria-label="Build underground">
    <header><button className="wilds-panel-drag-handle" type="button" aria-label="Move underground panel" {...floating.handle}><GripHorizontal size={18}/></button><span><small>With your creature</small><strong>Build underground</strong></span><button type="button" aria-label="Minimize underground panel" onClick={()=>setMinimized(true)}><Minus size={18}/></button><button type="button" aria-label="Close underground builder" disabled={builder.busy} onClick={builder.close}><X size={18}/></button></header>
    <section className="wilds-builder-adjustment">
      {builder.canEnter&&<button className="wilds-builder-adjust-trigger" type="button" disabled={builder.busy} onClick={builder.enter}><ArrowDown size={18}/> Enter burrow</button>}
      <div className="wilds-builder-adjust-transforms" role="group" aria-label="Dig shape">{(["entrance","tunnel","room"] as const).map(kind=><button key={kind} type="button" aria-pressed={builder.kind===kind} disabled={builder.busy} onClick={()=>builder.setKind(kind)}>{kind==="entrance"?"Entrance":kind==="tunnel"?"Tunnel":"Room"}</button>)}</div>
      <p>{builder.kind==="entrance"?"Tap nearby dry ground or a mountain slope to choose your entrance.":"Extend from an existing tunnel end. Each dig connects to your underground world."}</p>
      {builder.kind!=="entrance"&&<label>Continue from<select aria-label="Tunnel end to extend" value={builder.parentId??""} disabled={builder.busy} onChange={e=>builder.setParentId(e.target.value)}><option value="" disabled>Select a nearby tunnel end</option>{builder.nearby.map((p,i)=><option key={p.id} value={p.id}>End {i+1} · X {p.to.x.toFixed(1)} Z {p.to.z.toFixed(1)} · Y {p.to.y.toFixed(1)}</option>)}</select></label>}
      <div className="wilds-builder-adjust-transforms">
        <button type="button" disabled={builder.busy} onClick={builder.rotate} aria-label="Rotate dig direction 90 degrees"><RotateCw size={18}/>{["South","East","North","West"][builder.heading]}</button>
        <button type="button" disabled={builder.busy||builder.kind==="entrance"||builder.depth>=2} onClick={()=>builder.changeDepth(.5)} aria-label="Dig 0.5 metres deeper"><ArrowDown size={18}/>Deeper</button>
        <button type="button" disabled={builder.busy||builder.kind==="entrance"||builder.depth<=-2} onClick={()=>builder.changeDepth(-.5)} aria-label="Dig 0.5 metres higher"><ArrowUp size={18}/>Higher</button>
      </div>
      {builder.preview&&<output>4 m long · {builder.kind==="room"?"10 m room":"3 m wide"} · {builder.kind==="entrance"?"2 m down":builder.depth===0?"Level":`${Math.abs(builder.depth)} m ${builder.depth>0?"down":"up"}`}</output>}
      <p role="status">{builder.error??(builder.busy?"Your creature is digging…":builder.blocker??"Ready. Your creature will dig and save this connected space.")}</p>
      <button className="wilds-builder-adjust-trigger" type="button" disabled={builder.busy||Boolean(builder.blocker)} onClick={()=>void builder.dig()}><Pickaxe size={18}/>{builder.busy?"Digging…":`Dig ${builder.kind}`}</button>
    </section>
  </aside>;
}
