import { verifyCreationOccupancyGrant } from './occupancy';
import { assertCreationData, parseCreationDefinition } from './definition';
import { verifyCreationInstance, type CreationInstance } from './instance';
import { emptyCreationState, type CreationState, type CreationSourceRef } from './state';
import { freezeConstructionProof, validConstructionHead, validConstructionId, constructionProofDigest } from '../wilds-construction-project';
import type { CreationDefinition, CreationAssetRef } from './types';
export type CreationPersistence = Readonly<{
    schema: 'wildz.creation-persistence.v1';
    definitions: readonly CreationDefinition[];
    instances: readonly CreationInstance[];
    resources: CreationState['resources'];
    custody: CreationState['custody'];
    reservations: CreationState['reservations'];
    receipts: CreationState['receipts'];
    events: CreationState['events'];
    occupancyGrants?: CreationState['occupancyGrants'];
    contributions?: CreationState['contributions'];
}>;
export type CreationSourceVerifier = (source: CreationSourceRef, payload: unknown) => Promise<boolean>;
export type CreationRestoreResult = Readonly<{
    state: CreationState;
    retained: readonly Readonly<{
        value: unknown;
        reason: string;
    }>[];
    unsupported: readonly unknown[];
}>;
/** An unsealed additive checkpoint. Portable authority requires the enclosing Receiz seal and source family. */
export function exportCreationPersistence(state: CreationState): CreationPersistence { return freezeConstructionProof(JSON.parse(JSON.stringify({ schema: 'wildz.creation-persistence.v1', definitions: Object.values(state.definitions), instances: Object.values(state.instances), resources: state.resources, custody: state.custody, reservations: state.reservations, receipts: state.receipts, events: state.events, occupancyGrants: state.occupancyGrants, contributions: state.contributions })) as CreationPersistence); }
export async function restoreCreationPersistence(value: unknown, verifySource: CreationSourceVerifier, verifyAsset?: (asset: CreationAssetRef) => Promise<boolean>): Promise<CreationRestoreResult> {
    const empty = emptyCreationState();
    if (value === undefined || value === null)
        return { state: empty, retained: [], unsupported: [] };
    let parsed: CreationPersistence;
    try {
        const raw = typeof value === 'string' ? JSON.parse(value) : value;
        assertCreationData(raw);
        if ((raw as {
            schema?: unknown;
        })?.schema !== 'wildz.creation-persistence.v1')
            return { state: empty, retained: [], unsupported: [value] };
        parsed = freezeConstructionProof(JSON.parse(JSON.stringify(raw))) as CreationPersistence;
        const required = ['schema', 'definitions', 'instances', 'resources', 'custody', 'reservations', 'receipts', 'events'];
        if (required.some(key => !Object.hasOwn(parsed, key)) || Object.keys(parsed).some(key => ![...required, 'occupancyGrants', 'contributions'].includes(key)))
            throw Error('creation_persistence_invalid');
        if (!Array.isArray(parsed.definitions) || !Array.isArray(parsed.instances) || parsed.instances.length > 16384 || parsed.definitions.length > 16384 || !parsed.resources || !parsed.custody || !parsed.reservations || !parsed.receipts || !Array.isArray(parsed.events))
            throw Error('creation_persistence_invalid');
        for (const map of [parsed.resources, parsed.custody, parsed.reservations, parsed.receipts, ...(parsed.occupancyGrants !== undefined ? [parsed.occupancyGrants] : []), ...(parsed.contributions !== undefined ? [parsed.contributions] : [])])
            if (!map || typeof map !== 'object' || Array.isArray(map) || Object.keys(map).length > 16384)
                throw Error('creation_persistence_invalid');
        if (parsed.events.length > 65536)
            throw Error('creation_persistence_invalid');
        for (const [id, r] of Object.entries(parsed.receipts))
            if (!r || r.operationId !== id || typeof r.instanceId !== 'string' || !validConstructionHead(r.commandDigest) || !validConstructionHead(r.successorHead))
                throw Error('creation_persistence_invalid');
        for (const e of parsed.events)
            if (!e || typeof e.operationId !== 'string' || typeof e.instanceId !== 'string' || typeof e.eventId !== 'string' || typeof e.action !== 'string' || !Number.isSafeInteger(e.kaiUPulse) || e.kaiUPulse < 0)
                throw Error('creation_persistence_invalid');
    }
    catch {
        return { state: empty, retained: [], unsupported: [value] };
    }
    const definitions: Record<string, CreationDefinition> = {}, instances: Record<string, CreationInstance> = {}, resources: Record<string, CreationState['resources'][string]> = {}, custody: Record<string, string> = {}, retained: {
        value: unknown;
        reason: string;
    }[] = [];
    for (const original of parsed.definitions) {
        try {
            const d = parseCreationDefinition(original);
            if (d.assets.length && (!verifyAsset || !(await Promise.all(d.assets.map(verifyAsset))).every(Boolean)))
                throw Error('creation_assets_unavailable');
            definitions[d.digest] = d;
        }
        catch (error) {
            retained.push({ value: original, reason: error instanceof Error ? error.message : 'creation_definition_unsupported' });
        }
    }
    for (const [id, resource] of Object.entries(parsed.resources)) {
        try {
            if (resource.id !== id || !validConstructionHead(resource.head) || !Number.isSafeInteger(resource.quantity) || resource.quantity < 0 || typeof resource.ownerId !== 'string' || typeof resource.kind !== 'string' || typeof resource.spent !== 'boolean' || parsed.custody[id] !== resource.ownerId || !await verifySource({ id, head: resource.head, kind: 'material' }, resource))
                throw Error('creation_resource_unverified');
            resources[id] = resource;
            custody[id] = parsed.custody[id];
        }
        catch (error) {
            retained.push({ value: resource, reason: error instanceof Error ? error.message : 'creation_resource_unverified' });
        }
    }
    for (const original of parsed.instances) {
        try {
            if (!verifyCreationInstance(original) || !definitions[original.definitionDigest] || parsed.custody[original.instanceId] !== original.ownerId || !await verifySource({ id: original.instanceId, head: original.head, kind: 'creation' }, original))
                throw Error('creation_instance_unverified');
            const existing = instances[original.instanceId];
            if (existing && existing.head !== original.head)
                throw Error('creation_restored_head_conflict');
            const missing = Object.values(original.nodeStates).some(n => n.kind === 'storage' && n.lotIds.some(id => !resources[id]));
            if (missing)
                throw Error('creation_contents_source_missing');
            instances[original.instanceId] = original;
            custody[original.instanceId] = original.ownerId;
        }
        catch (error) {
            retained.push({ value: original, reason: error instanceof Error ? error.message : 'creation_instance_unverified' });
        }
    }
    const receiptEntries: [
        string,
        CreationState['receipts'][string]
    ][] = [];
    for (const [id, r] of Object.entries(parsed.receipts)) {
        try {
            if (!instances[r.instanceId] || !await verifySource({ id: `operation:${id}`, head: r.commandDigest, kind: 'creation-receipt' }, r))
                throw Error('unverified');
            receiptEntries.push([id, r]);
        }
        catch {
            retained.push({ value: r, reason: 'creation_receipt_unverified' });
        }
    }
    const receipts = Object.fromEntries(receiptEntries);
    const events = parsed.events.filter(e => Object.hasOwn(receipts, e.operationId));
    // Pending reservations are retained, never promoted to physical success by restoration.
    const reservations = Object.fromEntries(Object.entries(parsed.reservations).filter(([id, operation]) => resources[id] && typeof operation === 'string' && !resources[id].spent));
    const occupancyGrants: NonNullable<CreationState['occupancyGrants']> = {}, contributions: NonNullable<CreationState['contributions']> = {};
    for (const [id, grant] of Object.entries(parsed.occupancyGrants || {})) {
        try {
            if (!verifyCreationOccupancyGrant(grant) || grant.grantId !== id || !instances[grant.instanceId] || !await verifySource({ id, head: grant.head, kind: 'creation-occupancy' }, grant))
                throw Error('unverified');
            (occupancyGrants as Record<string, typeof grant>)[id] = grant;
        }
        catch {
            retained.push({ value: grant, reason: 'creation_occupancy_unverified' });
        }
    }
    for (const [id, contribution] of Object.entries(parsed.contributions || {})) {
        try {
            const { head, ...basis } = contribution;
            if (!contribution || contribution.operationId !== id || Object.keys(contribution).sort().join(',') !== ['operationId', 'instanceId', 'actorId', 'workerIds', 'resourceRefs', 'nodeIds', 'head'].sort().join(',') || ![id, contribution.instanceId, contribution.actorId].every(validConstructionId) || !instances[contribution.instanceId] || !validConstructionHead(head) || constructionProofDigest(basis) !== head || !Array.isArray(contribution.workerIds) || contribution.workerIds.length > 32 || !contribution.workerIds.every(validConstructionId) || new Set(contribution.workerIds).size !== contribution.workerIds.length || !Array.isArray(contribution.nodeIds) || contribution.nodeIds.length > 16384 || !contribution.nodeIds.every(validConstructionId) || new Set(contribution.nodeIds).size !== contribution.nodeIds.length || !Array.isArray(contribution.resourceRefs) || contribution.resourceRefs.length > 65536 || new Set(contribution.resourceRefs.map(r => r.id)).size !== contribution.resourceRefs.length || contribution.resourceRefs.some(r => !validConstructionId(r.id) || !validConstructionHead(r.head) || !Number.isSafeInteger(r.quantity) || r.quantity <= 0) || !await verifySource({ id: `contribution:${id}`, head, kind: 'creation-contribution' }, contribution))
                throw Error('unverified');
            (contributions as Record<string, typeof contribution>)[id] = contribution;
        }
        catch {
            retained.push({ value: contribution, reason: 'creation_contribution_unverified' });
        }
    }
    return { state: freezeConstructionProof({ definitions, instances, resources, custody, reservations, receipts, events, ...(parsed.occupancyGrants !== undefined ? { occupancyGrants } : {}), ...(parsed.contributions !== undefined ? { contributions } : {}) }), retained, unsupported: [] };
}
