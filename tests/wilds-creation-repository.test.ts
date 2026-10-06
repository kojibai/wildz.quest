import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createWildsCreationRepository } from '../src/lib/receiz/wilds-creation-repository';
import { createUnavailableCreationAdmissionPort } from '../src/features/play/creation/operation';
import { creationInstanceFixture } from './support/creation-instance-fixtures';
import { creationDefinitionFixture } from './support/creation-fixtures';
import { creationOperationFixture } from './support/creation-operation-fixtures';
import { creationRegionIds } from '../src/features/play/creation/index';
const query = { worldId: 'wildz', spaceId: 'surface', regionIds: ['0:0'], after: null, limit: 16 };
function page() { const instance = creationInstanceFixture(), definition = creationDefinitionFixture(), bounds = { min: { x: 0, y: 0, z: 0 }, max: { x: 4, y: 3, z: 5 } }; return { status: 'available' as const, worldId: 'wildz', spaceId: 'surface', after: null, next: 'continuation:one', entries: [{ instance, definition, index: { instanceId: instance.instanceId, head: instance.head, definitionDigest: definition.digest, worldId: 'wildz', spaceId: 'surface', bounds, regionIds: creationRegionIds(bounds) }, source: 'test-only-native-enclosing-source' }] }; }
test('a repository captures authenticated source bytes and bounded continuation before use', async () => { const p = page(), repository = createWildsCreationRepository({ admission: createUnavailableCreationAdmissionPort('test'), read: async () => p, authenticatePage: async (captured) => captured.status === 'available' && captured.entries[0].source === 'test-only-native-enclosing-source' }); const result = await repository.read(query); assert.equal(result.status, 'available'); if (result.status === 'available') {
    assert.equal(result.next, 'continuation:one');
    assert.equal(result.entries[0].instance.head, p.entries[0].instance.head);
    assert.equal(Object.isFrozen(result.entries[0].instance), true);
} });
test('stale index fields and oversized or unauthenticated pages cannot become world truth', async () => { const p = page(); for (const altered of [{ ...p, entries: [{ ...p.entries[0], index: { ...p.entries[0].index, head: 'sha256:' + 'f'.repeat(64) } }] }, { ...p, worldId: 'other' }, { ...p, entries: Array.from({ length: 17 }, () => p.entries[0]) }]) {
    const repository = createWildsCreationRepository({ admission: createUnavailableCreationAdmissionPort('test'), read: async () => altered, authenticatePage: async () => true });
    assert.equal((await repository.read(query)).status, 'unavailable');
} const unverified = createWildsCreationRepository({ admission: createUnavailableCreationAdmissionPort('test'), read: async () => p, authenticatePage: async () => false }); assert.equal((await unverified.read(query)).status, 'unavailable'); });
test('an unavailable conditional rail stays zero-dispatch and cannot publish through projection storage', async () => { const repository = createWildsCreationRepository(), result = await repository.compareAndAppend(creationOperationFixture()); assert.equal(result.status, 'rejected'); if (result.status === 'rejected')
    assert.equal(result.writes, 0); assert.equal((await repository.read(query)).status, 'unavailable'); assert.equal((await repository.lookup('operation:unknown')).status, 'unknown'); });
