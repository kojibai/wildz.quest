import assert from 'node:assert/strict';
import { test } from 'node:test';
import { creationOperationContextFixture } from './support/creation-operation-fixtures';
import { compileCreation } from '../src/features/play/creation/compiler';
import { prepareCreationOperation } from '../src/features/play/creation/operation';
import { emptyCreationState } from '../src/features/play/creation/state';
import { exportCreationPersistence } from '../src/features/play/creation/persistence';
import { embedCreationImage, readCreationImage, validateCreationImage, type CreationImagePayload } from '../src/features/play/creation/image';
import { withWildzPngPayloadChunk } from '../src/features/play/card-export';
const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'));
function fixture(): CreationImagePayload {
    const c = creationOperationContextFixture(), compiled = compileCreation(c.definition, c.compileContext);
    if (compiled.status !== 'ready')
        throw Error('fixture');
    const op = prepareCreationOperation(compiled.plan, c);
    return { schema: 'wildz.creation-image.v1', instanceId: op.instanceId, assetBytes: {}, checkpoint: exportCreationPersistence({ ...emptyCreationState(), definitions: { [c.definition.digest]: c.definition }, instances: { [op.instanceId]: op.command.instance }, resources: Object.fromEntries(op.command.resourceSuccessors.map(r => [r.id, r])), custody: { [op.instanceId]: 'owner', ...Object.fromEntries(op.resources.map(r => [r.id, 'owner'])) } }) };
}
test('a creation image carries the complete instance definition and finite embedded matter', () => {
    const payload = fixture();
    assert.equal(validateCreationImage(payload), true);
    const image = embedCreationImage(png, payload), opened = readCreationImage(image);
    assert.deepEqual(opened, payload);
    assert.deepEqual(opened.checkpoint.instances[0].embeddedResources, payload.checkpoint.instances[0].embeddedResources);
    assert.equal(opened.checkpoint.instances[0].creatorId, 'owner');
    assert.ok(Object.isFrozen(opened));
    assert.throws(() => readCreationImage(png));
});
test('creation image tampering and ambiguous application chunks are rejected', () => {
    const payload = fixture(), image = embedCreationImage(png, payload);
    assert.throws(() => readCreationImage(withWildzPngPayloadChunk(image, 'wildz.creation-image.v1', '{}')));
    assert.equal(validateCreationImage({ ...payload, instanceId: 'another' }), false);
    assert.equal(validateCreationImage({ ...payload, checkpoint: { ...payload.checkpoint, custody: {} } }), false);
    assert.equal(validateCreationImage({ ...payload, checkpoint: { ...payload.checkpoint, definitions: [] } }), false);
});
test('a single creation image cannot expose unrelated player assets or omit embedded resources', () => {
    const payload = fixture();
    assert.equal(validateCreationImage({ ...payload, checkpoint: { ...payload.checkpoint, metabolism: {} } }), false);
    assert.equal(validateCreationImage({ ...payload, checkpoint: { ...payload.checkpoint, resources: {} } }), false);
    assert.equal(validateCreationImage({ ...payload, checkpoint: { ...payload.checkpoint, instances: [payload.checkpoint.instances[0], payload.checkpoint.instances[0]] } }), false);
    assert.equal(validateCreationImage({ ...payload, assetBytes: { unrelated: 'abc' } }), false);
});
test('a source-only checkpoint remains distinct from enclosing Receiz proof authority', () => {
    const payload = fixture();
    assert.equal(validateCreationImage(payload), true);
    assert.equal(Object.hasOwn(readCreationImage(embedCreationImage(png, payload)), 'admitted'), false);
});
test('creations use the same proof-object export validation and owner coordinates as creature cards', async () => {
    const { requireVerifiedWildzPng, requireOwnedWildzPng } = await import('../src/lib/receiz/wildz-proof-object-export');
    const payload = fixture(), image = embedCreationImage(png, payload);
    const kind = 'creation' as Parameters<typeof requireVerifiedWildzPng>[0];
    assert.equal(requireVerifiedWildzPng(kind, image), 'owner');
    assert.doesNotThrow(() => requireOwnedWildzPng(kind, image, { actorId: 'owner', profileHandle: 'owner.receiz.id', receizUserId: 'owner-user' }));
    assert.throws(() => requireOwnedWildzPng(kind, image, { actorId: 'other', profileHandle: 'other', receizUserId: 'other-user' }), /owner_mismatch/);
});
test('native creation custody comes from the same canonical artifact opener, preserving its historical creator', async () => {
    const { createWildzCreationArtifactReader, readWildzCreationArtifactCustody } = await import('../src/lib/receiz/wildz-creation-artifact');
    const payload = fixture(), image = embedCreationImage(png, payload);
    const open = async () => ({ payloadBytes: image, compatibility: 'current-native' as const, ownerReceizId: 'recipient.receiz.id' });
    const reader = createWildzCreationArtifactReader(open as Parameters<typeof createWildzCreationArtifactReader>[0]);
    const source = new TextEncoder().encode('test-only-trusted-native-opener');
    const artifact = await reader({ bytes: source, mimeType: 'application/vnd.receiz.artifact', name: 'creation.receiz' });
    assert.equal(artifact.payload.checkpoint.instances[0].creatorId, 'owner');
    assert.equal(artifact.payload.checkpoint.instances[0].ownerId, 'owner');
    assert.equal(readWildzCreationArtifactCustody(artifact, 'recipient')?.ownerReceizId, 'recipient.receiz.id');
    assert.equal(readWildzCreationArtifactCustody(artifact, 'owner'), null);
    assert.equal(readWildzCreationArtifactCustody({ ...artifact }, 'recipient'), null);
    source.fill(0);
    assert.notDeepEqual(artifact.artifactBytes, source);
});
test('verified document checkpoints and forged native owner fields cannot mint creation custody', async () => {
    const { createWildzCreationArtifactReader, readWildzCreationArtifactCustody } = await import('../src/lib/receiz/wildz-creation-artifact');
    const image = embedCreationImage(png, fixture());
    const open = async () => ({ payloadBytes: image, compatibility: 'verified-document' as const, ownerReceizId: null });
    const reader = createWildzCreationArtifactReader(open as Parameters<typeof createWildzCreationArtifactReader>[0]);
    const artifact = await reader({ bytes: png, mimeType: 'image/png' });
    assert.equal(readWildzCreationArtifactCustody(artifact, 'owner'), null);
    assert.equal(readWildzCreationArtifactCustody({ ...artifact, nativeOwnerReceizId: 'owner.receiz.id' }, 'owner'), null);
});
