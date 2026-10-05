import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { WildsCreationPanel } from '../src/features/play/creation/WildsCreationPanel';
import { initialCreationConversation } from '../src/features/play/creation/conversation';
import { creationContextFixture } from './support/creation-fixtures';
test('opens with the conversation and offers small manual controls',()=>{const state={...initialCreationConversation('owner','surface',creationContextFixture().pose),open:true};const markup=renderToStaticMarkup(<WildsCreationPanel state={state} workers={[]} cards={[]} materialCounts={{hay:0,timber:0,stone:0}} onChange={()=>{}} onAsk={()=>{}} onBuild={()=>{}} onClose={()=>{}} onManualBuild={()=>{}} canBuild={false}/>);assert.match(markup,/What would you like to build/);assert.match(markup,/Manual building/);assert.match(markup,/Choose creatures/);assert.match(markup,/Allocate resources/);});
test('does not offer build success without an admission port',()=>{const state={...initialCreationConversation('owner','surface',creationContextFixture().pose),open:true,status:'preview' as const};const markup=renderToStaticMarkup(<WildsCreationPanel state={state} workers={[]} cards={[]} materialCounts={{hay:0,timber:0,stone:0}} onChange={()=>{}} onAsk={()=>{}} onBuild={()=>{}} onClose={()=>{}} onManualBuild={()=>{}} canBuild={false}/>);assert.match(markup,/<button[^>]*disabled[^>]*>Build here/);assert.match(markup,/awaiting authenticated world admission/);assert.doesNotMatch(markup,/Built successfully/);});
