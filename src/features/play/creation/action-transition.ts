import { assertCreationData } from './definition';
import { verifyCreationInstance, type CreationAccessAction, type CreationInstance } from './instance';
import { constructionProofDigest, freezeConstructionProof, validConstructionId, validConstructionKai, validConstructionHead } from '../wilds-construction-project';
import type { CreationState, CreationAuthorityContext, CreationTransition } from './state';
export type CreationActionRequest = Readonly<{
    operationId: string;
    actorId: string;
    instanceId: string;
    expectedHeads: Readonly<Record<string, string | null>>;
    kaiUPulse: number;
    action: string;
}>;
/** A pure source-bound proposal. Only an authenticated admission adapter can adopt it. */
export function proposeCreationAction(state: CreationState, command: CreationActionRequest, context: CreationAuthorityContext, rule: Readonly<{
    id: string;
    head: string;
    stages?: readonly CreationInstance['stage'][];
}>, permission: CreationAccessAction, apply: (current: CreationInstance) => CreationInstance): CreationTransition {
    const reject = (reason: string): CreationTransition => ({ status: 'rejected', state, reason, writes: 0 });
    try {
        assertCreationData(command);
        if (![command.operationId, command.actorId, command.instanceId].every(validConstructionId) || !validConstructionKai(command.kaiUPulse) || context.actorId !== command.actorId)
            return reject('creation_action_invalid');
        const current = state.instances[command.instanceId];
        if (!current || !verifyCreationInstance(current) || !(rule.stages || ['functional', 'finished']).includes(current.stage) || state.custody[current.instanceId] !== current.ownerId || command.kaiUPulse < current.kaiUPulse)
            return reject('creation_action_source_stale');
        if (context.rules[rule.id] !== rule.head || !context.sources.some(s => s.id === `rule:${rule.id}` && s.head === rule.head && s.kind === 'rule' && context.verifySource(s)))
            return reject('creation_action_rule_unavailable');
        const commandDigest = constructionProofDigest(command), prior = state.receipts[command.operationId];
        if (prior) {
            if (prior.commandDigest !== commandDigest)
                return reject('creation_operation_collision');
            if (!context.sources.some(s => s.id === current.instanceId && s.head === current.head && s.kind === 'creation' && context.verifySource(s)))
                return reject('creation_replay_source_unverified');
            return { status: 'proposed', state, successorSources: [], consequences: [] };
        }
        if (current.head !== command.expectedHeads[current.instanceId])
            return reject('creation_action_source_stale');
        if (!validConstructionHead(command.expectedHeads[`actor:${command.actorId}`]) || new Set(context.sources.map(s => s.id)).size !== context.sources.length)
            return reject('creation_action_actor_invalid');
        for (const [id, head] of Object.entries(command.expectedHeads)) {
            if (head === null)
                return reject('creation_action_unexpected_genesis');
            if (!context.sources.some(s => s.id === id && s.head === head && context.verifySource(s)))
                return reject('creation_action_source_unverified');
        }
        if (!context.sources.some(s => s.id === current.instanceId && s.head === current.head && s.kind === 'creation' && context.verifySource(s)))
            return reject('creation_action_source_unverified');
        const policy = current.access[permission];
        const allowed = current.ownerId === command.actorId || policy.mode === 'public' || policy.mode === 'invited' && policy.subjects.includes(command.actorId) || context.mandates.some(m => m.actorId === command.actorId && m.ownerId === current.ownerId && m.instanceId === current.instanceId && !m.revoked && m.expiresKaiUPulse >= command.kaiUPulse && m.actions.includes(command.action) && command.expectedHeads[m.id] === m.head && context.sources.some(s => s.id === m.id && s.head === m.head && s.kind === 'mandate' && context.verifySource(s)));
        if (!allowed)
            return reject('creation_access_denied');
        const next = apply(current);
        if (!verifyCreationInstance(next) || next.instanceId !== current.instanceId || next.definitionDigest !== current.definitionDigest || next.creatorId !== current.creatorId || next.worldId !== current.worldId || next.spaceId !== current.spaceId || next.parentHead !== current.head || next.revision !== current.revision + 1 || next.kaiUPulse !== command.kaiUPulse)
            return reject('creation_action_successor_invalid');
        const event = { eventId: constructionProofDigest({ operationId: command.operationId, commandDigest, head: next.head }), operationId: command.operationId, instanceId: next.instanceId, action: command.action, kaiUPulse: command.kaiUPulse };
        return { status: 'proposed', state: freezeConstructionProof({ ...state, instances: { ...state.instances, [next.instanceId]: next }, custody: { ...state.custody, [next.instanceId]: next.ownerId }, receipts: { ...state.receipts, [command.operationId]: { operationId: command.operationId, commandDigest, instanceId: next.instanceId, successorHead: next.head } }, events: [...state.events, event] }), successorSources: [next], consequences: [event] };
    }
    catch (error) {
        return reject(error instanceof Error ? error.message : 'creation_action_failed');
    }
}
