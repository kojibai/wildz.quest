export const WILDZ_LIFECYCLE_KEY = "wildz:pwa-lifecycle:v1";
type LifecycleStorage = Pick<Storage, "getItem" | "setItem">;
const events = ["boot", "visible", "hidden", "pagehide", "pageshow", "requested-reload", "graphics-context-lost", "graphics-context-restored", "panel-open", "panel-close"] as const;
type LifecycleEvent = typeof events[number];
type Restart = "first-known-start" | "requested-reload" | "browser-reported-discard" | "previous-pagehide" | "unexplained-restart";
export type WildzLifecycleRecord = Readonly<{
 event: LifecycleEvent; at: number; reason?: "apply-update" | "launch-link";
 navigation?: "navigate" | "reload" | "back_forward"; wasDiscarded?: boolean;
 persisted?: boolean; restart?: Restart; geometries?: number; textures?: number;
}>;

function clean(input: WildzLifecycleRecord): WildzLifecycleRecord {
 const result: {event:LifecycleEvent;at:number;reason?:WildzLifecycleRecord["reason"];navigation?:WildzLifecycleRecord["navigation"];wasDiscarded?:boolean;persisted?:boolean;restart?:Restart;geometries?:number;textures?:number}={event:events.includes(input.event)?input.event:"boot",at:Number.isFinite(input.at)?input.at:0};
 if(input.reason==="apply-update"||input.reason==="launch-link")result.reason=input.reason;
 if(input.navigation==="navigate"||input.navigation==="reload"||input.navigation==="back_forward")result.navigation=input.navigation;
 if(typeof input.wasDiscarded==="boolean")result.wasDiscarded=input.wasDiscarded;
 if(typeof input.persisted==="boolean")result.persisted=input.persisted;
 if(["first-known-start","requested-reload","browser-reported-discard","previous-pagehide","unexplained-restart"].includes(input.restart??""))result.restart=input.restart;
 for(const key of ["geometries","textures"] as const)if(Number.isSafeInteger(input[key])&&input[key]!>=0&&input[key]!<=1_000_000)result[key]=input[key];
 return result;
}
export function readWildzLifecycle(storage?: LifecycleStorage|null): readonly WildzLifecycleRecord[] {
 try {
  const raw=storage?.getItem(WILDZ_LIFECYCLE_KEY);
  if(!raw||raw.length>8192)return [];
  const parsed:unknown=JSON.parse(raw);
  return Array.isArray(parsed)?parsed.slice(-12).filter((v):v is WildzLifecycleRecord=>!!v&&typeof v==="object"&&events.includes(v.event)&&Number.isFinite(v.at)).map(clean):[];
 }catch{return [];}
}
/** Lifecycle events only. No timers, frame sampling, private state or network. */
export function recordWildzLifecycle(input: WildzLifecycleRecord,storage?:LifecycleStorage|null):WildzLifecycleRecord {
 const previous=readWildzLifecycle(storage),last=previous.at(-1);
 const beforeUnload=[...previous].reverse().find(record=>record.event!=="hidden"&&record.event!=="pagehide");
 const result=clean(input);
 const restart:Restart|undefined=input.event!=="boot"?undefined:input.wasDiscarded?"browser-reported-discard":beforeUnload?.event==="requested-reload"?"requested-reload":last?.event==="pagehide"?"previous-pagehide":last?"unexplained-restart":"first-known-start";
 const record=restart?{...result,restart}:result;
 try {storage?.setItem(WILDZ_LIFECYCLE_KEY,JSON.stringify([...previous.slice(-11),record]));}catch{/* Quota or private mode must never interrupt play. */}
 return record;
}
export function recordWildzBrowserLifecycle(input: Omit<WildzLifecycleRecord,"at">) {
 let storage:Storage|null=null;try{storage=window.localStorage;}catch{/* Diagnostics are optional. */}
 return recordWildzLifecycle({...input,at:Date.now()},storage);
}
