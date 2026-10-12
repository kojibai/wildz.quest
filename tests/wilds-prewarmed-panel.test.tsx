import assert from 'node:assert/strict';
import {test} from 'node:test';
import {renderToStaticMarkup} from 'react-dom/server';
import type {ReactElement} from 'react';
import {createPrewarmedPanel} from '../src/features/play/prewarmed-panel';
import {mountPanelComponent} from './support/panel-component-harness';

const Ready=({name}:{name:string})=><div>{name}</div>;
test('preloaded panel opens directly with its content and coalesces module reads',async()=>{
 let reads=0;
 const warm=createPrewarmedPanel(async()=>{reads++;return Ready;},()=> <span>Loading panel</span>);
 await Promise.all([warm.load(),warm.load()]);
 assert.equal(reads,1);assert.equal(renderToStaticMarkup(<warm.Panel name="Ready immediately"/>),'<div>Ready immediately</div>');
});
test('a cold panel keeps its component identity when loading completes, preserving open form state',async()=>{
 const warm=createPrewarmedPanel(async()=>Ready),mounted=mountPanelComponent(warm.Panel);
 const first=mounted.render({name:'Draft'}) as ReactElement;
 await warm.load();
 const next=mounted.render({name:'Edited draft'}) as ReactElement;
 assert.equal(first.type,next.type);mounted.unmount();
 const reopened=mountPanelComponent(warm.Panel);
 assert.equal((reopened.render({name:'Reopened'}) as ReactElement).type,Ready);reopened.unmount();
});
