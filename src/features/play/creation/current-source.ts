import { assertCreationData, parseCreationDefinition } from './definition';
import { verifyCreationInstance, type CreationInstance } from './instance';
import type { CreationDefinition } from './types';
import { freezeConstructionProof, validConstructionHead, validConstructionId } from '../wilds-construction-project';
export type CreationCurrentSourceQuery = Readonly<{
    instanceId: string;
    worldId: string;
    spaceId: string;
}>;
export type CreationCurrentSource = Readonly<{
    status: 'available';
    instance: CreationInstance;
    definition: CreationDefinition;
    planDigest: string;
    source: unknown;
}>;
export type CreationCurrentSourceResult = CreationCurrentSource | Readonly<{
    status: 'unavailable';
    reason: string;
}>;
export type CreationCurrentSourceRail = Readonly<{
    read(query: CreationCurrentSourceQuery): Promise<unknown>;
    authenticateCurrent(source: CreationCurrentSource): Promise<boolean>;
}>;
const currentChecks = new WeakMap<object, () => Promise<boolean>>();
/** Authentication belongs to the installed host adapter; JSON cannot manufacture a current source. */
export async function verifyCurrentCreationSource(source: CreationCurrentSource): Promise<boolean> {
    try {
        const check = currentChecks.get(source);
        return check ? (await check()) === true : false;
    }
    catch {
        return false;
    }
}
export function createCreationCurrentSourcePort(rail?: CreationCurrentSourceRail) {
    return { async read(query: CreationCurrentSourceQuery): Promise<CreationCurrentSourceResult> {
            const unavailable = (reason: string): CreationCurrentSourceResult => ({ status: 'unavailable', reason });
            if (!rail)
                return unavailable('creation_current_source_runtime_unavailable');
            try {
                assertCreationData(query);
                if (Object.keys(query).sort().join(',') !== 'instanceId,spaceId,worldId' || ![query.instanceId, query.worldId, query.spaceId].every(validConstructionId))
                    return unavailable('creation_current_source_query_invalid');
                const raw = await rail.read(freezeConstructionProof({ ...query }));
                assertCreationData(raw);
                const source = freezeConstructionProof(JSON.parse(JSON.stringify(raw))) as CreationCurrentSource;
                if (Object.keys(source).sort().join(',') !== 'definition,instance,planDigest,source,status' || source.status !== 'available' || !verifyCreationInstance(source.instance) || !validConstructionHead(source.planDigest) || source.instance.instanceId !== query.instanceId || source.instance.worldId !== query.worldId || source.instance.spaceId !== query.spaceId || parseCreationDefinition(source.definition).digest !== source.instance.definitionDigest || (await rail.authenticateCurrent(source)) !== true)
                    return unavailable('creation_current_source_unverified');
                currentChecks.set(source, () => rail.authenticateCurrent(source));
                return source;
            }
            catch {
                return unavailable('creation_current_source_read_failed');
            }
        } };
}
