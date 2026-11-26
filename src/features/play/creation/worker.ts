import { compileCreation, type CreationCompileContext, type CreationCompileResult } from './compiler';
import type { CreationDefinition } from './types';
import {prepareAffordableCreation} from './affordable-phase';
const scope=self as unknown as {onmessage:((event:MessageEvent<{requestId:string;definition:CreationDefinition;context:CreationCompileContext;kind?:'phase';mode?:'automatic'|'manual';includeDraftGeometry?:boolean}>)=>void)|null;postMessage(message:unknown,transfer:Transferable[]):void};
scope.onmessage=({data})=>{
 const result=data.kind==='phase'?prepareAffordableCreation(data.definition,data.context,data.mode||'manual'):compileCreation(data.definition,data.context,{includeDraftGeometry:data.includeDraftGeometry===true});
 const chunks=result.status==='ready'?result.plan.chunks:data.kind==='phase'?undefined:(result as Extract<CreationCompileResult,{status:'blocked'}>).draftGeometry?.chunks;
 scope.postMessage({requestId:data.requestId,result},(chunks?.flatMap(c=>[c.positions.buffer,c.normals.buffer])??[]) as ArrayBuffer[]);
};
