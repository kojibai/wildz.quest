import assert from 'node:assert/strict';
import { test } from 'node:test';
import { creationShelterStarterPrompt } from '../src/features/play/creation/starter-prompt';
import { initialCreationConversation, reduceCreationConversation } from '../src/features/play/creation/conversation';
import { creationContextFixture, creationDefinitionFixture } from './support/creation-fixtures';
const pose = { position: { x: 12.375, y: 4.25, z: -8 }, yaw: 0 };
test('a starter prompt proposes a personal shelter and a functional bed at the living location', () => {
  const prompt = creationShelterStarterPrompt({ displayName: 'Mint Trail', pose });
  for (const part of ['Mint Trail', 'home', 'bed', 'doorway', 'roof', '12.375', '4.25', '-8', 'resources']) assert.ok(prompt.includes(part), part);
  assert.ok(prompt.length < 700);
});
test('the starter is queued only for a pristine conversation and is freely editable', () => {
  const state = initialCreationConversation('owner', 'surface', creationContextFixture().pose);
  const seeded = reduceCreationConversation(state, { type: 'starter', text: 'Build my home and bed' });
  assert.equal(seeded.draft, 'Build my home and bed');
  assert.equal(seeded.status, 'idle'); assert.equal(seeded.plan, null);
  assert.equal(reduceCreationConversation(seeded, { type: 'draft', text: 'Forge a tool instead' }).draft, 'Forge a tool instead');
  assert.equal(reduceCreationConversation(seeded, { type: 'starter', text: 'Another home' }), seeded);
});
test('a starter never replaces saved work, a selected object, or an in-flight operation', () => {
  const initial = initialCreationConversation('owner', 'surface', pose), definition = creationDefinitionFixture();
  for (const state of [{ ...initial, draft: 'My own idea' }, { ...initial, definition }, { ...initial, status: 'recovering' as const, operationId: 'pending' }, { ...initial, history: [{ role: 'user' as const, text: 'Create a garden' }] }]) assert.equal(reduceCreationConversation(state, { type: 'starter', text: 'Home' }), state);
});
