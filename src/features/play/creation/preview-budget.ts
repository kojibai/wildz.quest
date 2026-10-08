import type {CreationCompileContext,CreationCompileResult,CreationResourceQuote} from './compiler';
import type {CreationDefinition,CreationResourceBudget} from './types';

/** Empty text remains editable; only finite, nonnegative integer allocations commit. */
export function editCreationBudget(text:string,owned:number):{text:string;amount:number}|null {
 if(text==='')return {text:'',amount:0};
 if(!/^\d+$/.test(text))return null;
 const value=Number(text);if(!Number.isSafeInteger(value))return null;
 const amount=Math.min(value,Math.max(0,Math.floor(owned)));
 return {text:String(amount),amount};
}
export function creationQuote(result:CreationCompileResult):CreationResourceQuote|undefined {
 return result.status==='ready'?{definitionDigest:result.plan.definitionDigest,requiredResources:result.plan.requiredResources,requiredWork:result.plan.requiredWork}:result.quote;
}
/** Compile with the real owned ceiling, then bind the final plan to its exact
 * automatic allocation. Manual ceilings are never increased. No draft changes. */
export async function compileCreationPreview(input:{definition:CreationDefinition;context:CreationCompileContext;owned:CreationResourceBudget;mode:'automatic'|'manual';current:()=>boolean;compile:(definition:CreationDefinition,context:CreationCompileContext)=>Promise<CreationCompileResult>}):Promise<{result:CreationCompileResult;budget:CreationResourceBudget}|null> {
 const budget=input.mode==='automatic'?input.owned:Object.fromEntries(Object.entries(input.context.budget).map(([kind,amount])=>[kind,Math.min(amount,input.owned[kind]||0)]));
 let result=await input.compile(input.definition,{...input.context,budget});if(!input.current())return null;
 const quote=creationQuote(result);
 if(input.mode==='manual'||!quote)return {result,budget};
 const allocated=Object.fromEntries(Object.entries(quote.requiredResources).map(([kind,amount])=>[kind,Math.min(amount,input.owned[kind]||0)]));
 if(result.status==='ready'&&JSON.stringify(budget)!==JSON.stringify(allocated)){
  result=await input.compile(input.definition,{...input.context,budget:allocated});if(!input.current())return null;
 }
 return {result,budget:allocated};
}
