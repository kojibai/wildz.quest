import assert from "node:assert/strict";
import {test} from "node:test";
import {wildsPlayerActionKey} from "../src/features/play/player-action-key";
const input={code:"Space",repeat:false,altKey:false,ctrlKey:false,metaKey:false,shiftKey:false};
test("jump and distinct hand shortcuts preserve text, focused controls and held-key behavior",()=>{
 assert.deepEqual(wildsPlayerActionKey(input,null),{kind:"jump"});
 assert.deepEqual(wildsPlayerActionKey({...input,code:"KeyQ"},null),{kind:"hand",hand:"left",intent:"strike"});
 assert.deepEqual(wildsPlayerActionKey({...input,code:"KeyE",shiftKey:true},null),{kind:"hand",hand:"right",intent:"grab"});
 for(const tagName of ["INPUT","TEXTAREA","SELECT","BUTTON","A"])assert.equal(wildsPlayerActionKey(input,{tagName}),null);
 assert.equal(wildsPlayerActionKey(input,{isContentEditable:true}),null);
 for(const modifier of ["repeat","altKey","ctrlKey","metaKey"])assert.equal(wildsPlayerActionKey({...input,[modifier]:true},null),null);
 assert.equal(wildsPlayerActionKey({...input,code:"Enter"},null),null);
});
