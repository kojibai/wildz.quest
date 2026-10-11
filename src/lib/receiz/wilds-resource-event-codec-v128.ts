import {canonicalizeReceizV122,receizBase64UrlDecode,receizBase64UrlEncode,sha256ReceizBytes} from '@receiz/sdk';
import {sha256PortableBasis} from '../../features/play/portable-card';

/** A lossless application byte codec, not an artifact, seal or admission rule.
 * The native candidate commits the encoded bytes; gameplay sees exactly the
 * same canonical event after independent native opening and bounded decoding. */
const LEGACY_LAW={schema:'wildz.resource-event-codec.v1',codec:'deflate',raw:'canonical-receiz-json-utf8',binding:'exact-decoded-length-and-sha256',branch:'explicit-ground-v2-or-building-clearance-v1'} as const;
export const WILDS_RESOURCE_EVENT_CODEC_V1_HEAD_V128=sha256PortableBasis(canonicalizeReceizV122(LEGACY_LAW));
const LAW={...LEGACY_LAW,schema:'wildz.resource-event-codec.v2',dictionary:'exact-repeated-json-string-tokens-v1'} as const;
export const WILDS_RESOURCE_EVENT_CODEC_HEAD_V128=sha256PortableBasis(canonicalizeReceizV122(LAW));
export const WILDS_RESOURCE_EVENT_MAX_BYTES_V128=8*1024*1024+64*1024;
const MAX_COMMAND_BYTES=8*1024*1024,MAX_COMMANDS=1024;
type ObjectValue=Record<string,unknown>;
const object=(value:unknown):value is ObjectValue=>!!value&&typeof value==='object'&&!Array.isArray(value);
function fail(reason:string):never{throw Error(`wilds_resource_event_codec_${reason}`);}
const rawBytes=(value:unknown)=>new TextEncoder().encode(canonicalizeReceizV122(value));

export function isWildsResourceEventCodecEligibleV128(value:unknown):boolean{
 if(!object(value)||value.schema!=='wildz.resource-command.v128'||!['replay','use','reserve'].includes(String(value.kind))||!Array.isArray(value.commands))return false;
 return value.commands.some(entry=>{
  if(!object(entry)||entry.kind!=='world'||!object(entry.command))return false;
  const command=entry.command;
  if(command.type==='construction.clearance.derive'||command.type==='construction.clearance.pickup')return true;
  if(command.type==='construction.component.place')return object(command.request)&&command.request.landscapeRule==='wildz.build-ground.v2';
  return (command.type==='creation.construct'||command.type==='creation.evolve')&&object(command.context)
   &&command.context.spaceId==='wildz.space.outer.v1'&&Array.isArray(command.context.physical)
   &&command.context.physical.some(chunk=>object(chunk)&&chunk.chunkId==='wildz.creation.terrain-support.v2');
 });
}

/** Tiny bounded input writes keep a compressed expansion from being submitted
 * as one large synchronous operation. Output is checked before retaining each
 * chunk; the final contiguous buffer is allocated only after the exact bound. */
async function transform(input:Uint8Array,stream:CompressionStream|DecompressionStream,maximum:number){
 const reader=stream.readable.getReader(),writer=stream.writable.getWriter();
 const writing=(async()=>{try{for(let offset=0;offset<input.length;offset+=256)await writer.write(input.slice(offset,offset+256));await writer.close();}catch(error){await reader.cancel(error).catch(()=>{});throw error;}})();
 // Attach immediately: malformed input can reject the producer before read().
 void writing.catch(()=>{});
 const chunks:Uint8Array[]=[];let length=0;
 try{
  while(true){const next=await reader.read();if(next.done)break;
   if(next.value.byteLength>maximum-length)fail('size_exceeded');
   length+=next.value.byteLength;chunks.push(next.value);
  }
  await writing;
  const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return bytes;
 }catch(error){await Promise.allSettled([reader.cancel(error),writer.abort(error)]);await writing.catch(()=>{});throw error;}
}
function assertEventBound(value:unknown){
 if(!object(value)||!Array.isArray(value.commands)||value.commands.length>MAX_COMMANDS||rawBytes(value.commands).length>MAX_COMMAND_BYTES)fail('event_size_invalid');
}
/** Tokenization only changes transport. Numeric parts refer to complete exact
 * JSON string tokens, so restoration needs no property assignment or pointer
 * interpretation. Check every expanded byte before allocating the joined text. */
function tableText(text:string){
 const tokens=[...text.matchAll(/"(?:[^"\\]|\\.)*"/g)],counts=new Map<string,number>();
 for(const token of tokens)if(token[0].length>=1024)counts.set(token[0],(counts.get(token[0])??0)+1);
 const strings=[...counts].filter(([,count])=>count>1).map(([token])=>token).sort(),indices=new Map(strings.map((token,index)=>[token,index]));
 const parts:(string|number)[]=[];let offset=0;
 for(const token of tokens){const index=indices.get(token[0]);if(index===undefined)continue;
  if(token.index!>offset)parts.push(text.slice(offset,token.index));parts.push(index);offset=token.index!+token[0].length;
 }
 if(offset<text.length)parts.push(text.slice(offset));
 return {schema:'wildz.resource-event-text-table.v1',strings,parts};
}
function expandTable(value:unknown,maximum:number){
 if(!object(value)||Object.keys(value).sort().join()!=='parts,schema,strings'||value.schema!=='wildz.resource-event-text-table.v1'
  ||!Array.isArray(value.strings)||!Array.isArray(value.parts))fail('table_invalid');
 // Encoder tokens are >=1024 characters and occur at least twice. Bound
 // bookkeeping before mapping sizes or allocating reference counters.
 if(value.strings.length>Math.floor(maximum/2048)||value.parts.length>2*Math.floor(maximum/1024)+1)fail('table_population_invalid');
 const strings=value.strings as string[],parts=value.parts;let length=0;
 for(let index=0;index<strings.length;index++)if(typeof strings[index]!=='string'||strings[index].length<1024||index>0&&strings[index-1]>=strings[index])fail('table_invalid');
 const uses=new Uint32Array(strings.length);
 for(const part of parts){
  if(typeof part==='string'){if(!part.length)fail('table_invalid');continue;}
  if(!Number.isSafeInteger(part)||(part as number)<0||(part as number)>=strings.length)fail('table_invalid');uses[part as number]++;
 }
 if(uses.some(count=>count<2))fail('table_unused_token');
 const sizes=strings.map(part=>new TextEncoder().encode(part).length);
 for(const part of parts){
  const size=typeof part==='string'?new TextEncoder().encode(part).length:sizes[part as number];
  if(size>maximum-length)fail('size_exceeded');length+=size;
 }
 if(length!==maximum)fail('decoded_binding_invalid');
 return parts.map(part=>typeof part==='string'?part:strings[part as number]).join('');
}
export async function encodeWildsResourceEventV128(value:unknown):Promise<unknown>{
 if(!isWildsResourceEventCodecEligibleV128(value))return value;
 assertEventBound(value);const raw=rawBytes(value);if(raw.length>WILDS_RESOURCE_EVENT_MAX_BYTES_V128)fail('size_exceeded');
 const table=rawBytes(tableText(new TextDecoder().decode(raw)));if(table.length>WILDS_RESOURCE_EVENT_MAX_BYTES_V128)fail('size_exceeded');
 const compressed=await transform(table,new CompressionStream('deflate'),WILDS_RESOURCE_EVENT_MAX_BYTES_V128);
 return {schema:'wildz.resource-event-bytes.v2',codec:'deflate',codecHead:WILDS_RESOURCE_EVENT_CODEC_HEAD_V128,decodedByteLength:raw.length,decodedSha256:await sha256ReceizBytes(raw),tableByteLength:table.length,bytesB64u:receizBase64UrlEncode(compressed)};
}
export async function decodeWildsResourceEventV128(value:unknown):Promise<unknown>{
 if(!object(value)||!['wildz.resource-event-bytes.v1','wildz.resource-event-bytes.v2'].includes(String(value.schema)))return value;
 const table=value.schema==='wildz.resource-event-bytes.v2',head=table?WILDS_RESOURCE_EVENT_CODEC_HEAD_V128:WILDS_RESOURCE_EVENT_CODEC_V1_HEAD_V128;
 if(Object.keys(value).sort().join()!==`bytesB64u,codec,codecHead,decodedByteLength,decodedSha256,schema${table?',tableByteLength':''}`
  ||value.codec!=='deflate'||value.codecHead!==head||typeof value.decodedSha256!=='string'||!/^[a-f0-9]{64}$/.test(value.decodedSha256)
  ||typeof value.bytesB64u!=='string'||!value.bytesB64u||!/^[A-Za-z0-9_-]+$/.test(value.bytesB64u))fail('envelope_invalid');
 const transportLength=table?value.tableByteLength:value.decodedByteLength;
 if(!Number.isSafeInteger(value.decodedByteLength)||(value.decodedByteLength as number)<1||(value.decodedByteLength as number)>WILDS_RESOURCE_EVENT_MAX_BYTES_V128
  ||!Number.isSafeInteger(transportLength)||(transportLength as number)<1||(transportLength as number)>WILDS_RESOURCE_EVENT_MAX_BYTES_V128
  ||value.bytesB64u.length>Math.ceil(WILDS_RESOURCE_EVENT_MAX_BYTES_V128*4/3))fail('size_invalid');
 const compressed=receizBase64UrlDecode(value.bytesB64u);if(receizBase64UrlEncode(compressed)!==value.bytesB64u)fail('base64_invalid');
 const transported=await transform(compressed,new DecompressionStream('deflate'),transportLength as number);
 if(transported.length!==transportLength)fail('decoded_binding_invalid');
 const transportedText=new TextDecoder('utf-8',{fatal:true}).decode(transported),tableValue:unknown=table?JSON.parse(transportedText):null;
 if(table&&canonicalizeReceizV122(tableValue)!==transportedText)fail('canonical_bytes_required');
 const text=table?expandTable(tableValue,value.decodedByteLength as number):transportedText,raw=new TextEncoder().encode(text);
 if(raw.length!==value.decodedByteLength||await sha256ReceizBytes(raw)!==value.decodedSha256)fail('decoded_binding_invalid');
 const event:unknown=JSON.parse(text);
 if(canonicalizeReceizV122(event)!==text)fail('canonical_bytes_required');
 if(!isWildsResourceEventCodecEligibleV128(event))fail('branch_invalid');
 assertEventBound(event);return event;
}
