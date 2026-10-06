import {projectCreationPhysical} from './projection';
import type {CreationInstance} from './instance';
import type {CreationDefinition} from './types';
import type {CreationPlan} from './compiler';
const scope=self as unknown as {onmessage:((event:MessageEvent<{requestId:string;instance:CreationInstance;definition:CreationDefinition;plan:CreationPlan}>)=>void)|null;postMessage(message:unknown,transfer:Transferable[]):void};
scope.onmessage=({data})=>{try{const projection=projectCreationPhysical(data.instance,data.definition,data.plan);scope.postMessage({requestId:data.requestId,projection},projection.chunks.flatMap(c=>[c.positions.buffer,c.normals.buffer]) as ArrayBuffer[]);}catch(error){scope.postMessage({requestId:data.requestId,error:error instanceof Error?error.message:'creation_projection_failed'},[]);}};
