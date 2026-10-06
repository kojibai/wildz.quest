import { assertCreationData } from './definition';
import { verifyCreationInstance, type CreationInstance } from './instance';
import { constructionProofDigest, sealConstructionProof, validConstructionHead, validConstructionId, validConstructionKai } from '../wilds-construction-project';
import { canAccessCreation } from './access';
export type CreationOccupancyGrant = Readonly<{
    grantId: string;
    instanceId: string;
    ownerId: string;
    subjectId: string;
    roomNodeIds: readonly string[];
    permissions: readonly ('inhabit' | 'use')[];
    expiresAtKaiUPulse: number | null;
    revision: number;
    parentHead: string | null;
    kaiUPulse: number;
    head: string;
}>;
/** Structural candidate; a seal digest is never a grant admission. */
export function sealCreationOccupancyGrant(basis: Omit<CreationOccupancyGrant, 'head'>): CreationOccupancyGrant {
    assertCreationData(basis);
    if (Object.keys(basis).sort().join(',') !== ['grantId', 'instanceId', 'ownerId', 'subjectId', 'roomNodeIds', 'permissions', 'expiresAtKaiUPulse', 'revision', 'parentHead', 'kaiUPulse'].sort().join(',') || ![basis.grantId, basis.instanceId, basis.ownerId, basis.subjectId].every(validConstructionId) || !Array.isArray(basis.roomNodeIds) || basis.roomNodeIds.length < 1 || basis.roomNodeIds.length > 128 || !basis.roomNodeIds.every(validConstructionId) || new Set(basis.roomNodeIds).size !== basis.roomNodeIds.length || !Array.isArray(basis.permissions) || basis.permissions.length > 2 || basis.permissions.some(p => !['inhabit', 'use'].includes(p)) || new Set(basis.permissions).size !== basis.permissions.length || !validConstructionKai(basis.kaiUPulse) || !Number.isSafeInteger(basis.revision) || basis.revision < 0 || (basis.revision === 0 ? basis.parentHead !== null : !validConstructionHead(basis.parentHead)) || (basis.expiresAtKaiUPulse !== null && (!validConstructionKai(basis.expiresAtKaiUPulse) || basis.expiresAtKaiUPulse <= basis.kaiUPulse)))
        throw Error('creation_occupancy_grant_invalid');
    return sealConstructionProof(basis);
}
export function verifyCreationOccupancyGrant(value: unknown): value is CreationOccupancyGrant {
    try {
        assertCreationData(value);
        const { head, ...basis } = value as CreationOccupancyGrant;
        return validConstructionHead(head) && sealCreationOccupancyGrant(basis).head === head;
    }
    catch {
        return false;
    }
}
export function canInhabitCreationRoom(instance: CreationInstance, actor: string, room: string, kai: number, grants: readonly CreationOccupancyGrant[], verify: (id: string, head: string) => boolean): boolean {
    if (!verifyCreationInstance(instance) || !validConstructionId(actor) || !validConstructionKai(kai) || kai < instance.kaiUPulse || !['functional', 'finished'].includes(instance.stage))
        return false;
    const node = instance.nodeStates[room];
    if (!node || !['bed', 'habitat'].includes(node.kind) || node.condition <= 0)
        return false;
    if (canAccessCreation(instance, actor, 'inhabit', kai))
        return true;
    if (grants.length > 16384 || new Set(grants.map(g => g.grantId)).size !== grants.length)
        return false;
    return grants.some(g => verifyCreationOccupancyGrant(g) && g.instanceId === instance.instanceId && g.subjectId === actor && g.kaiUPulse <= kai && g.roomNodeIds.includes(room) && g.permissions.includes('inhabit') && (g.expiresAtKaiUPulse === null || kai < g.expiresAtKaiUPulse) && verify(g.grantId, g.head));
}
export type CreationOccupancyRelocation = Readonly<{
    subjectId: string;
    expectedSubjectHead: string;
    destinationSpaceId: string;
    safeRouteHead: string;
}>;
/** Expiry/revocation cannot silently strand people; the native atomic operation must carry these participants. */
export function requireCreationOccupancyRelocations(instance: CreationInstance, grant: CreationOccupancyGrant, relocations: readonly CreationOccupancyRelocation[]): void {
    const occupants = new Set(grant.roomNodeIds.flatMap(id => { const n = instance.nodeStates[id]; return n && ('occupantIds' in n) ? n.occupantIds.filter(id => id === grant.subjectId) : []; }));
    if (new Set(relocations.map(r => r.subjectId)).size !== relocations.length || relocations.some(r => ![r.subjectId, r.destinationSpaceId].every(validConstructionId) || ![r.expectedSubjectHead, r.safeRouteHead].every(validConstructionHead)) || [...occupants].some(id => !relocations.some(r => r.subjectId === id)))
        throw Error('creation_occupied_relocation_required');
}
