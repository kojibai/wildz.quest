import assert from 'node:assert/strict';
import test from 'node:test';
import {WildsPlayerActionPad,type WildsPlayerHandIntent} from '../src/features/play/WildsPlayerActionPad';
import {mountPanelComponent,panelElements} from './support/panel-component-harness';
import type {WildsEquipmentControls} from '../src/features/play/wilds-equipment-controls';

function setup(mode:'bow'|'rifle'){
 const saved=new Map(['window','document','HTMLElement','setInterval','clearInterval'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 const windowTarget=new EventTarget(),documentTarget=new EventTarget(),intervals=new Map<number,()=>void>();let nextId=0;
 class Element{constructor(readonly tagName:string){}isContentEditable=false;}
 Object.defineProperties(globalThis,{window:{configurable:true,value:windowTarget},document:{configurable:true,value:documentTarget},HTMLElement:{configurable:true,value:Element},setInterval:{configurable:true,value:(fn:()=>void)=>{intervals.set(++nextId,fn);return nextId;}},clearInterval:{configurable:true,value:(id:number)=>intervals.delete(id)}});
 const actions:WildsPlayerHandIntent[]=[],panel=mountPanelComponent(WildsPlayerActionPad);
 let equipment:WildsEquipmentControls={id:'gear-one',mode,hand:'left',label:'Test gear',capacity:120,durability:120};
 let signal=0;
 const render=()=>{const tree=panel.render({enabled:true,cancelSignal:signal,equipment,onJump(){},onHandAction:(_,intent)=>actions.push(intent)});panel.flushEffects();return panelElements(tree);};
 const button=(side:'left'|'right')=>render().find(element=>element.props.className===`wildz-player-hand is-${side}`)!;
 const pointer=(side:'left'|'right',phase:'Down'|'Up'|'Cancel',id=side==='left'?1:2)=>{(button(side).props[`onPointer${phase}`]as(event:unknown)=>void)({button:0,pointerId:id,preventDefault(){},currentTarget:{setPointerCapture(){}}});};
 const key=(phase:'keydown'|'keyup',code:string,target:EventTarget=windowTarget)=>{const event=new Event(phase,{cancelable:true});Object.assign(event,{code,repeat:false,altKey:false,ctrlKey:false,metaKey:false,shiftKey:false});Object.defineProperty(event,'target',{value:target});windowTarget.dispatchEvent(event);};
 render();actions.length=0;
 return {actions,intervals,pointer,key,Element,render,cancel(){signal++;render();},switchGear(){equipment={...equipment,id:'gear-two'};render();},cleanup(){panel.unmount();for(const[key,descriptor]of saved){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}}};
}
test('bow supports independent held aim and draw, fires once on release, and canceled draw never shoots',()=>{
 const ui=setup('bow');try{
  ui.pointer('left','Down');ui.pointer('right','Down');ui.render();ui.pointer('right','Up');ui.pointer('left','Up');
  assert.deepEqual(ui.actions,['aim','draw','shoot','release-aim']);
  ui.actions.length=0;ui.pointer('right','Down');ui.pointer('right','Cancel');assert.deepEqual(ui.actions,['draw','cancel']);
  ui.pointer('right','Up');assert.equal(ui.actions.includes('shoot'),false);
 }finally{ui.cleanup();}
});
test('rifle held fire survives presentation renders and stops on panel cancellation and same-kind gear replacement',()=>{
 const ui=setup('rifle');try{
  ui.pointer('right','Down');assert.equal(ui.intervals.size,1);ui.render();[...ui.intervals.values()][0]();assert.deepEqual(ui.actions,['shoot','shoot']);
  ui.cancel();assert.equal(ui.intervals.size,0);ui.pointer('right','Up');assert.equal(ui.actions.filter(action=>action==='shoot').length,2);
  ui.pointer('right','Down');ui.switchGear();assert.equal(ui.intervals.size,0);ui.pointer('right','Up');assert.equal(ui.actions.filter(action=>action==='shoot').length,3);
 }finally{ui.cleanup();}
});
test('typing an unmatched E key cannot fire; accepted gameplay Q and E keep independent release actions',()=>{
 const ui=setup('bow');try{
  ui.key('keyup','KeyE');assert.deepEqual(ui.actions,[]);
  ui.key('keydown','KeyQ');ui.key('keydown','KeyE');ui.key('keyup','KeyE');ui.key('keyup','KeyQ');assert.deepEqual(ui.actions,['aim','draw','shoot','release-aim']);
 }finally{ui.cleanup();}
});

test('overlapping keyboard and pointer holds release only the last holder of each hand',()=>{
 const ui=setup('bow');try{
  ui.key('keydown','KeyQ');ui.pointer('left','Down');ui.pointer('left','Up');assert.deepEqual(ui.actions,['aim']);ui.key('keyup','KeyQ');assert.deepEqual(ui.actions,['aim','release-aim']);
  ui.actions.length=0;ui.key('keydown','KeyE');ui.pointer('right','Down');ui.pointer('right','Up');assert.deepEqual(ui.actions,['draw']);ui.key('keyup','KeyE');assert.deepEqual(ui.actions,['draw','shoot']);
 }finally{ui.cleanup();}
 const gun=setup('rifle');try{gun.key('keydown','KeyE');gun.pointer('right','Down');gun.pointer('right','Up');assert.equal(gun.intervals.size,1);gun.key('keyup','KeyE');assert.equal(gun.intervals.size,0);}finally{gun.cleanup();}
});
