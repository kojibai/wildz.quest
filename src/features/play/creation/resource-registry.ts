import { assertCreationData } from './definition';
import { constructionProofDigest, sealConstructionProof, validConstructionHead, validConstructionId, validConstructionKai } from '../wilds-construction-project';
export type CreationResourceLot = Readonly<{
    schema: 'wildz.creation-resource-lot.v1';
    id: string;
    head: string;
    kind: 'seed' | 'water' | 'produce';
    quantity: number;
    ownerId: string;
    sourceId: string;
    sourceHead: string;
    operationId: string;
    parentHeads: readonly string[];
    kaiUPulse: number;
}>;
export const CREATION_RESOURCE_RULES = Object.freeze({ schema: 'wildz.creation-resource-rules.v1', version: 1, maximumLotQuantity: 256, seedSourceCapacity: 16, waterSourceCapacity: 64, producePerSeed: 1, waterPerProduce: 1, produceRecoveryBreaths: 64 });
export const CREATION_RESOURCE_RULE_HEAD = constructionProofDigest(CREATION_RESOURCE_RULES);
export function sealCreationResourceLot(basis: Omit<CreationResourceLot, 'head'>): CreationResourceLot {
    assertCreationData(basis);
    if (Object.keys(basis).sort().join(',') !== ['schema', 'id', 'kind', 'quantity', 'ownerId', 'sourceId', 'sourceHead', 'operationId', 'parentHeads', 'kaiUPulse'].sort().join(',') || !Array.isArray(basis.parentHeads) || basis.schema !== 'wildz.creation-resource-lot.v1' || ![basis.id, basis.ownerId, basis.sourceId, basis.operationId].every(validConstructionId) || !['seed', 'water', 'produce'].includes(basis.kind) || !Number.isSafeInteger(basis.quantity) || basis.quantity < 1 || basis.quantity > 256 || !validConstructionHead(basis.sourceHead) || !validConstructionKai(basis.kaiUPulse) || basis.parentHeads.length < 1 || basis.parentHeads.length > 32 || new Set(basis.parentHeads).size !== basis.parentHeads.length || basis.parentHeads.some(h => !validConstructionHead(h)))
        throw Error('creation_resource_lot_invalid');
    return sealConstructionProof(basis);
}
/** Structural integrity only; enclosing source admission is verified separately. */
export function verifyCreationResourceLot(value: unknown): value is CreationResourceLot {
    try {
        assertCreationData(value);
        const { head, ...basis } = value as CreationResourceLot;
        return sealCreationResourceLot(basis).head === head;
    }
    catch {
        return false;
    }
}
/** Current finite custody retains the immutable extraction/harvest lot and every consumed head. */
export type CreationResourceCustody = Readonly<{
    schema: 'wildz.creation-resource-custody.v1';
    id: string;
    head: string;
    kind: CreationResourceLot['kind'];
    ownerId: string;
    quantity: number;
    spent: boolean;
    originLot: CreationResourceLot;
    containerId: string | null;
    revision: number;
    parentHead: string | null;
    kaiUPulse: number;
}>;
function sealCustody(basis: Omit<CreationResourceCustody, 'head'>): CreationResourceCustody {
    assertCreationData(basis);
    if (Object.keys(basis).sort().join(',') !== ['schema', 'id', 'kind', 'ownerId', 'quantity', 'spent', 'originLot', 'containerId', 'revision', 'parentHead', 'kaiUPulse'].sort().join(',') || basis.schema !== 'wildz.creation-resource-custody.v1' || !verifyCreationResourceLot(basis.originLot) || basis.id !== basis.originLot.id || basis.kind !== basis.originLot.kind || !validConstructionId(basis.ownerId) || !Number.isSafeInteger(basis.quantity) || basis.quantity < 0 || basis.quantity > basis.originLot.quantity || basis.spent !== (basis.quantity === 0) || (basis.containerId !== null && !validConstructionId(basis.containerId)) || !Number.isSafeInteger(basis.revision) || basis.revision < 0 || !validConstructionKai(basis.kaiUPulse) || basis.kaiUPulse < basis.originLot.kaiUPulse || (basis.revision === 0 ? basis.parentHead !== null || basis.containerId !== null || basis.quantity !== basis.originLot.quantity || basis.ownerId !== basis.originLot.ownerId : !validConstructionHead(basis.parentHead)))
        throw Error('creation_resource_custody_invalid');
    return sealConstructionProof(basis);
}
export function createCreationResourceCustody(lot: CreationResourceLot): CreationResourceCustody {
    return sealCustody({ schema: 'wildz.creation-resource-custody.v1', id: lot.id, kind: lot.kind, ownerId: lot.ownerId, quantity: lot.quantity, spent: false, originLot: lot, containerId: null, revision: 0, parentHead: null, kaiUPulse: lot.kaiUPulse });
}
export function verifyCreationResourceCustody(value: unknown): value is CreationResourceCustody {
    try {
        assertCreationData(value);
        const { head, ...basis } = value as CreationResourceCustody;
        return head === sealCustody(basis).head;
    }
    catch {
        return false;
    }
}
export function spendCreationResourceCustody(current: CreationResourceCustody, quantity: number, kaiUPulse: number): CreationResourceCustody {
    if (!verifyCreationResourceCustody(current) || current.spent || current.containerId !== null || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > current.quantity || !validConstructionKai(kaiUPulse) || kaiUPulse < current.kaiUPulse)
        throw Error('creation_resource_spend_invalid');
    const { head, ...basis } = current;
    return sealCustody({ ...basis, quantity: current.quantity - quantity, spent: quantity === current.quantity, revision: current.revision + 1, parentHead: head, kaiUPulse });
}
