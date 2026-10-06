import type { CreationState, CreationAuthorityContext, CreationTransition } from './state';
import { assertCreationData } from './definition';
import { sealCreationInstance, verifyCreationInstance, type CreationNodeState, type CreationAccessAction } from './instance';
import { constructionProofDigest, freezeConstructionProof, sealConstructionProof, validConstructionHead, validConstructionId, validConstructionKai } from '../wilds-construction-project';
export const CREATION_TRANSFER_RULE_ID = 'wildz.creation.transfer.v1';
export const CREATION_TRANSFER_RULE_HEAD = constructionProofDigest({ id: CREATION_TRANSFER_RULE_ID, recipientAcceptance: true, exactInstanceHead: true, preserveContents: true, removeEquipment: true, resetSteward: true });
export type CreationTransferOffer = Readonly<{
    offerId: string;
    instanceId: string;
    expectedHead: string;
    from: string;
    to: string;
    rights: 'instance' | 'stewardship';
    expiresAtKaiUPulse: number;
    operationId: string;
    kaiUPulse: number;
    head: string;
}>;
/** Only a verified owner-admitted source makes this candidate an offer. */
export function sealCreationTransferOffer(basis: Omit<CreationTransferOffer, 'head'>): CreationTransferOffer {
    assertCreationData(basis);
    if (Object.keys(basis).sort().join(',') !== ['offerId', 'instanceId', 'expectedHead', 'from', 'to', 'rights', 'expiresAtKaiUPulse', 'operationId', 'kaiUPulse'].sort().join(',') || ![basis.offerId, basis.instanceId, basis.from, basis.to, basis.operationId].every(validConstructionId) || basis.from === basis.to || !validConstructionHead(basis.expectedHead) || !['instance', 'stewardship'].includes(basis.rights) || !validConstructionKai(basis.kaiUPulse) || !validConstructionKai(basis.expiresAtKaiUPulse) || basis.expiresAtKaiUPulse <= basis.kaiUPulse)
        throw Error('creation_transfer_offer_invalid');
    return sealConstructionProof(basis);
}
export function verifyCreationTransferOffer(value: unknown): value is CreationTransferOffer {
    try {
        assertCreationData(value);
        const { head, ...basis } = value as CreationTransferOffer;
        return validConstructionHead(head) && sealCreationTransferOffer(basis).head === head;
    }
    catch {
        return false;
    }
}
export function proposeCreationTransferAcceptance(state: CreationState, offer: CreationTransferOffer, request: Readonly<{
    operationId: string;
    actorId: string;
    expectedActorHead: string;
    kaiUPulse: number;
}>, context: CreationAuthorityContext): CreationTransition {
    const reject = (reason: string): CreationTransition => ({ status: 'rejected', state, writes: 0, reason });
    try {
        assertCreationData(request);
        if (!verifyCreationTransferOffer(offer) || Object.keys(request).sort().join(',') !== ['operationId', 'actorId', 'expectedActorHead', 'kaiUPulse'].sort().join(',') || request.actorId !== offer.to || context.actorId !== offer.to || request.operationId !== offer.operationId || !validConstructionHead(request.expectedActorHead) || !validConstructionKai(request.kaiUPulse))
            return reject('creation_transfer_acceptance_invalid');
        const current = state.instances[offer.instanceId], authenticated = (id: string, head: string, kind: string) => context.sources.some(s => s.id === id && s.head === head && s.kind === kind && context.verifySource(s));
        if (!current || !verifyCreationInstance(current) || state.custody[current.instanceId] !== current.ownerId || !authenticated(current.instanceId, current.head, 'creation') || context.rules[CREATION_TRANSFER_RULE_ID] !== CREATION_TRANSFER_RULE_HEAD || !authenticated(`rule:${CREATION_TRANSFER_RULE_ID}`, CREATION_TRANSFER_RULE_HEAD, 'rule') || !authenticated(offer.offerId, offer.head, 'creation-transfer-offer') || !authenticated(`actor:${offer.to}`, request.expectedActorHead, 'actor') || new Set(context.sources.map(s => s.id)).size !== context.sources.length)
            return reject('creation_transfer_sources_unverified');
        const commandDigest = constructionProofDigest({ offer, request }), prior = state.receipts[request.operationId];
        if (prior) {
            if (prior.commandDigest !== commandDigest)
                return reject('creation_operation_collision');
            return { status: 'proposed', state, successorSources: [], consequences: [] };
        }
        if (current.ownerId !== offer.from || current.head !== offer.expectedHead || !['functional', 'finished'].includes(current.stage) || request.kaiUPulse < current.kaiUPulse || request.kaiUPulse < offer.kaiUPulse || request.kaiUPulse >= offer.expiresAtKaiUPulse)
            return reject('creation_transfer_offer_stale');
        const { head, ...basis } = current;
        const nodeStates: Record<string, CreationNodeState> = {};
        for (const [id, node] of Object.entries(current.nodeStates))
            nodeStates[id] = node.kind === 'equipment' ? { ...node, equippedBy: null } : node;
        const access = { ...current.access };
        for (const action of ['edit', 'demolish'] as CreationAccessAction[]) {
            const policy = access[action];
            if (policy.mode === 'invited')
                access[action] = { ...policy, subjects: policy.subjects.filter(id => id !== offer.from) };
        }
        const next = sealCreationInstance({ ...basis, ownerId: offer.rights === 'instance' ? offer.to : current.ownerId, stewardId: offer.to, nodeStates, access, revision: current.revision + 1, parentHead: head, kaiUPulse: request.kaiUPulse });
        const event = { eventId: constructionProofDigest({ operationId: request.operationId, commandDigest, head: next.head }), operationId: request.operationId, instanceId: next.instanceId, action: 'accept-transfer', kaiUPulse: request.kaiUPulse };
        return { status: 'proposed', state: freezeConstructionProof({ ...state, instances: { ...state.instances, [next.instanceId]: next }, custody: { ...state.custody, [next.instanceId]: next.ownerId }, receipts: { ...state.receipts, [request.operationId]: { operationId: request.operationId, commandDigest, instanceId: next.instanceId, successorHead: next.head } }, events: [...state.events, event] }), successorSources: [next], consequences: [event] };
    }
    catch {
        return reject('creation_transfer_invalid');
    }
}
