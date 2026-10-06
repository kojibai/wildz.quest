import { verifyCreationInstance, type CreationInstance, type CreationAccessPolicy, type CreationAccessAction } from './instance';
import { freezeConstructionProof, validConstructionId, validConstructionKai } from '../wilds-construction-project';
/** Current admitted instances only; callers authenticate the source before projecting this policy. */
export function canAccessCreation(instance: CreationInstance, actorId: string, permission: CreationAccessAction, kaiUPulse: number): boolean {
    if (!verifyCreationInstance(instance) || !validConstructionId(actorId) || !validConstructionKai(kaiUPulse) || kaiUPulse < instance.kaiUPulse || !['functional', 'finished'].includes(instance.stage))
        return false;
    const policy = instance.access[permission];
    if (!policy)
        return false;
    return instance.ownerId === actorId || policy.mode === 'public' || policy.mode === 'invited' && policy.subjects.includes(actorId);
}
export function creationAccessPreset(mode: 'public' | 'invited' | 'private', subjects: readonly string[] = []): CreationAccessPolicy {
    if (!['public', 'invited', 'private'].includes(mode) || subjects.length > 128 || subjects.some(id => !validConstructionId(id)) || new Set(subjects).size !== subjects.length || mode !== 'invited' && subjects.length)
        throw Error('creation_access_preset_invalid');
    const owner = { mode: 'owner' as const, subjects: [] }, shared = mode === 'private' ? owner : { mode, subjects: mode === 'invited' ? [...subjects] : [] };
    return freezeConstructionProof({ visit: shared, use: shared, harvest: shared, inhabit: owner, edit: owner, demolish: owner });
}
