import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import ts from 'typescript';
import * as jsxRuntime from 'react/jsx-runtime';
import {editCreationBudget} from '../src/features/play/creation/preview-budget';

test('actual resource input stays blank during edits and normalizes its committed number',()=>{
 let editing:string|null=null,amount=0;
 const testModule={exports:{} as {CreationBudgetInput:(props:unknown)=>any}};
 const output=ts.transpileModule(readFileSync('src/features/play/creation/WildsCreationPanel.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const env={module:testModule,exports:testModule.exports,require(name:string){
  if(name==='react/jsx-runtime')return jsxRuntime;
  if(name==='react')return {useState:()=>[editing,(value:string|null)=>{editing=value;} ]};
  if(name==='./preview-budget')return {editCreationBudget};
  return {};
 }};
 Function(...Object.keys(env),output)(...Object.values(env));
 const render=()=>testModule.exports.CreationBudgetInput({kind:'timber',amount,owned:50,disabled:false,onChange:(value:number)=>{amount=value;}});
 render().props.onFocus();render().props.onChange({target:{value:''}});
 assert.equal(amount,0);assert.equal(render().props.value,'','rerender must not force zero into the cleared field');
 render().props.onChange({target:{value:'007'}});assert.equal(amount,7);assert.equal(render().props.value,'7');
 render().props.onChange({target:{value:'500'}});assert.equal(amount,50);assert.equal(render().props.value,'50');
 render().props.onChange({target:{value:''}});render().props.onBlur();assert.equal(render().props.value,'0');
});
