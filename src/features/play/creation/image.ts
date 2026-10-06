import { readWildzPngPayloadChunks, withWildzPngPayloadChunk } from '../card-export';
import { sha256PortableBasis } from '../portable-card';
import { hasWildzCanonicalPngProof, splitWildzPngEnvelope } from '../../../lib/receiz/wildz-png-envelope';
import { assertCreationData, parseCreationDefinition } from './definition';
import { verifyCreationInstance } from './instance';
import { constructionProofDigest, freezeConstructionProof, validConstructionId, validConstructionHead } from '../wilds-construction-project';
import { receizBase64UrlDecode, sha256ReceizBytes } from '@receiz/sdk';
import type { CreationPersistence } from './persistence';
export const CREATION_IMAGE_KEY = 'wildz.creation-image.v1';
const MAX_BYTES = 32 * 1024 * 1024, MAX_PIXELS_BYTES = 4 * 1024 * 1024;
export type CreationImagePayload = Readonly<{
    schema: 'wildz.creation-image.v1';
    instanceId: string;
    checkpoint: CreationPersistence;
    assetBytes: Readonly<Record<string, string>>;
}>;
const exact = (value: object, keys: readonly string[]) => Object.keys(value).sort().join(',') === [...keys].sort().join(',');
/** Domain validation only. Ownership, signatures and transfer use the same enclosing Receiz proof as creature cards. */
export function validateCreationImage(value: unknown): value is CreationImagePayload {
    try {
        assertCreationData(value);
        const p = value as CreationImagePayload, c = p.checkpoint;
        if (!p || !exact(p, ['schema', 'instanceId', 'checkpoint', 'assetBytes']) || p.schema !== CREATION_IMAGE_KEY || !validConstructionId(p.instanceId) || !c || !exact(c, ['schema', 'definitions', 'instances', 'resources', 'custody', 'reservations', 'receipts', 'events', ...(c.occupancyGrants !== undefined ? ['occupancyGrants'] : []), ...(c.contributions !== undefined ? ['contributions'] : [])]) || c.schema !== 'wildz.creation-persistence.v1' || !Array.isArray(c.instances) || c.instances.length !== 1 || !Array.isArray(c.definitions) || c.definitions.length < 1 || c.definitions.length > 16384)
            return false;
        const instance = c.instances[0];
        if (!verifyCreationInstance(instance) || instance.instanceId !== p.instanceId || c.custody[instance.instanceId] !== instance.ownerId)
            return false;
        const definitions = c.definitions.map(parseCreationDefinition);
        if (new Set(definitions.map(d => d.digest)).size !== definitions.length || !definitions.some(d => d.digest === instance.definitionDigest) || definitions.some(d => d.creatorId !== instance.creatorId))
            return false;
        const current = definitions.find(d => d.digest === instance.definitionDigest)!;
        if (current.nodes.length !== Object.keys(instance.nodeStates).length || current.nodes.some(n => !Object.hasOwn(instance.nodeStates, n.id)))
            return false;
        for (const map of [c.resources, c.custody, c.reservations, c.receipts, p.assetBytes, ...(c.occupancyGrants ? [c.occupancyGrants] : []), ...(c.contributions ? [c.contributions] : [])])
            if (!map || typeof map !== 'object' || Array.isArray(map) || Object.keys(map).length > 65536)
                return false;
        const needed = new Set([...instance.embeddedResources.map(r => r.id), ...Object.values(instance.nodeStates).flatMap(n => n.kind === 'storage' ? n.lotIds : [])]);
        if (Object.keys(c.resources).length !== needed.size || [...needed].some(id => !Object.hasOwn(c.resources, id)) || Object.keys(c.custody).length !== needed.size + 1)
            return false;
        for (const [id, r] of Object.entries(c.resources)) {
            if (!r || r.id !== id || !validConstructionHead(r.head) || !Number.isSafeInteger(r.quantity) || r.quantity < 0 || typeof r.spent !== 'boolean' || !validConstructionId(r.ownerId) || !validConstructionId(r.kind) || c.custody[id] !== r.ownerId)
                return false;
            const { head, ...basis } = r;
            if (constructionProofDigest(basis) !== head)
                return false;
        }
        for (const r of instance.embeddedResources) {
            const current = c.resources[r.id] as typeof c.resources[string] & {
                parentHead?: string;
                embeddedIn?: string;
            };
            if (!current || !current.spent || current.kind !== r.kind || (current.embeddedIn !== undefined && current.embeddedIn !== instance.instanceId) || current.parentHead !== r.head)
                return false;
        }
        if (!Array.isArray(c.events) || c.events.length > 65536)
            return false;
        for (const [id, r] of Object.entries(c.receipts))
            if (!r || r.operationId !== id || r.instanceId !== instance.instanceId || !validConstructionHead(r.commandDigest) || !validConstructionHead(r.successorHead))
                return false;
        if (c.events.some(e => !e || e.instanceId !== instance.instanceId || !Object.hasOwn(c.receipts, e.operationId) || !validConstructionId(e.eventId) || !validConstructionId(e.action) || !Number.isSafeInteger(e.kaiUPulse) || e.kaiUPulse < 0))
            return false;
        if (Object.entries(c.reservations).some(([id, operation]) => !needed.has(id) || !validConstructionId(operation)))
            return false;
        if (Object.values(c.occupancyGrants || {}).some(g => g.instanceId !== instance.instanceId) || Object.values(c.contributions || {}).some(g => g.instanceId !== instance.instanceId))
            return false;
        const assets = new Map(definitions.flatMap(d => d.assets).map(a => [a.digest, a]));
        if (Object.keys(p.assetBytes).length !== assets.size)
            return false;
        let total = 0;
        for (const [digest, a] of assets) {
            const b64 = p.assetBytes[digest];
            if (typeof b64 !== 'string' || b64.length > MAX_BYTES * 2)
                return false;
            const bytes = receizBase64UrlDecode(b64);
            total += bytes.length;
            if (bytes.length !== a.bytes || total > MAX_BYTES)
                return false;
        }
        return true;
    }
    catch {
        return false;
    }
}
const byteDigest = (bytes: Uint8Array) => sha256PortableBasis(Array.from(bytes, b => b.toString(16).padStart(2, '0')).join(''));
/** Add data only to fresh unsealed pixels. Existing source bytes must be reused or transitioned by Receiz. */
export function embedCreationImage(source: Uint8Array, payload: CreationImagePayload): Uint8Array {
    if (source.length > MAX_PIXELS_BYTES || hasWildzCanonicalPngProof(source))
        throw Error('creation_image_fresh_pixels_required');
    const envelope = splitWildzPngEnvelope(source);
    if (envelope.trailer.length || !validateCreationImage(payload) || readWildzPngPayloadChunks(source, CREATION_IMAGE_KEY).length)
        throw Error('creation_image_invalid');
    const basis = withWildzPngPayloadChunk(source, CREATION_IMAGE_KEY, null);
    const encoded = JSON.stringify({ schema: CREATION_IMAGE_KEY, pixelDigest: byteDigest(basis), payloadDigest: constructionProofDigest(payload), payload });
    if (new TextEncoder().encode(encoded).length > MAX_BYTES)
        throw Error('creation_image_capacity');
    return withWildzPngPayloadChunk(basis, CREATION_IMAGE_KEY, encoded);
}
/** Read only after verifying the enclosing source on import. This function grants no custody. */
export function readCreationImage(source: Uint8Array): CreationImagePayload {
    if (source.length > MAX_BYTES + MAX_PIXELS_BYTES)
        throw Error('creation_image_capacity');
    const { pngBasis, trailer } = splitWildzPngEnvelope(source);
    if (trailer.length)
        throw Error('creation_image_unbound_trailer');
    const rows = readWildzPngPayloadChunks(pngBasis, CREATION_IMAGE_KEY);
    if (rows.length !== 1 || rows[0].length > MAX_BYTES)
        throw Error('creation_image_missing_or_ambiguous');
    const row = JSON.parse(rows[0]) as {
        schema: string;
        pixelDigest: string;
        payloadDigest: string;
        payload: unknown;
    };
    if (!exact(row, ['schema', 'pixelDigest', 'payloadDigest', 'payload']) || row.schema !== CREATION_IMAGE_KEY || !validateCreationImage(row.payload) || row.payloadDigest !== constructionProofDigest(row.payload) || byteDigest(withWildzPngPayloadChunk(pngBasis, CREATION_IMAGE_KEY, null)) !== row.pixelDigest)
        throw Error('creation_image_binding_invalid');
    return freezeConstructionProof(row.payload);
}
export async function verifyCreationImageAssets(payload: CreationImagePayload): Promise<boolean> {
    if (!validateCreationImage(payload))
        return false;
    for (const [head, encoded] of Object.entries(payload.assetBytes))
        if ('sha256:' + await sha256ReceizBytes(receizBase64UrlDecode(encoded)) !== head)
            return false;
    return true;
}
