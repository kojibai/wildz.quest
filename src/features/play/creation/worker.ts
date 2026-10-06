import { compileCreation, type CreationCompileContext } from './compiler';
import type { CreationDefinition } from './types';
const scope=self as unknown as {onmessage:((event:MessageEvent<{requestId:string;definition:CreationDefinition;context:CreationCompileContext}>)=>void)|null;postMessage(message:unknown,transfer:Transferable[]):void};
scope.onmessage=({data})=>{const result=compileCreation(data.definition,data.context);scope.postMessage({requestId:data.requestId,result},result.status==='ready'?result.plan.chunks.flatMap(c=>[c.positions.buffer,c.normals.buffer]) as ArrayBuffer[]:[]);};
