import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';
import * as jsxRuntime from 'react/jsx-runtime';
import { createFarmLayoutDefinition, defaultFarmLayoutOptions } from '../src/features/play/creation/farm-layout';
import { creationShelterStarterPrompt } from '../src/features/play/creation/starter-prompt';
import { projectCreationWorkers } from '../src/features/play/creation/capabilities';
import { initialCreationConversation, reduceCreationConversation, type CreationConversationEvent } from '../src/features/play/creation/conversation';
import { sealCollectedCard } from '../src/features/play/portable-card';
import { emptyAdventureCondition } from '../src/features/play/adventure/card-condition';
import { creationContextFixture } from './support/creation-fixtures';
import type { CreationSessionProps } from '../src/features/play/creation/CreationSession';

test('choosing a new farm replaces a distant restored placement with the latest player pose only when chosen', () => {
  const card = sealCollectedCard({ ownerReceizId: 'owner', formId: 'mintcub-1', encounterId: 'farm-placement', capturedAt: '2026-10-07T12:00:00.000Z' });
  let state = initialCreationConversation('owner', 'surface', { position: { x: -1000, y: 0, z: -1000 }, yaw: 0 });
  const saved = state.placement;
  let live = { position: { x: 10, y: 20, z: 30 }, yaw: 1 };
  const input: CreationSessionProps = { ownerId: 'owner', spaceId: 'surface', cards: [card], conditions: { [card.id]: emptyAdventureCondition(card.id) },
    context: creationContextFixture(), cardAdmissions: {}, lots: [], newPlacementPose: () => live,
    onPreview() {}, onClose() {}, onManualBuild() {} };
  const change = (event: CreationConversationEvent) => { state = reduceCreationConversation(state, event); };
  const testModule = { exports: {} as { default: (props: CreationSessionProps) => any } };
  const output = ts.transpileModule(readFileSync('src/features/play/creation/CreationSession.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const environment = { module: testModule, exports: testModule.exports, crypto, document: { body: {} }, require(name: string) {
    if (name === 'react/jsx-runtime') return jsxRuntime;
    if (name === 'react') return { memo: (fn: unknown) => fn, useMemo: (fn: () => unknown) => fn(),
      useState: (value: unknown) => [value, () => {}],
      useCallback: (fn: unknown) => fn, useRef: (value: unknown) => ({ current: value }), useEffect() {}, useSyncExternalStore: () => true };
    if (name === 'react-dom') return { createPortal: (children: unknown) => children };
    if (name === './farm-layout') return { createFarmLayoutDefinition };
    if (name === './starter-prompt') return { creationShelterStarterPrompt };
    if (name === './capabilities') return { projectCreationWorkers };
    if (name === './use-creation-conversation') return { useCreationConversation: () => ({ state, change, canBuild: false }) };
    if (name === './WildsCreationPanel') return { WildsCreationPanel: () => null };
    if (name === './CreationPlacementControls') return { CreationPlacementControls: () => null };
    if (name === './proposal-worker-client') return { createCreationProposalClient: () => { throw Error('opening the panel must not start proposal work'); } };
    if (name === './preview') return {};
    if (name === './creation.module.css') return { default: {} };
    throw Error(`Unexpected farm session dependency: ${name}`);
  } };
  Function(...Object.keys(environment), output)(...Object.values(environment));
  const rendered = testModule.exports.default(input);
  assert.deepEqual(state.placement, saved, 'opening the panel preserves the saved draft');
  live = { position: { x: 100, y: 25, z: 200 }, yaw: .5 };
  rendered.props.children[0].props.onCreateFarm(defaultFarmLayoutOptions());
  assert.deepEqual(state.placement, live, 'farm selection samples the player after opening');
  assert.equal(state.instance, null);
  assert.equal(state.selectedDefinition, null);
  assert.equal(state.definition?.creatorId, 'owner');
  assert.deepEqual(state.workerIds, [card.id]);
  assert.equal(state.plan, null, 'new placement requires its own compilation');
});
