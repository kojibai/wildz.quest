import type { CreationDefinition } from '../../features/play/creation/types';
import type { CreationInstance } from '../../features/play/creation/instance';
import type { CreationOperation, CreationAdmissionOutcome, CreationAdmissionPort } from '../../features/play/creation/operation';
import { createCreationSpatialIndex, type CreationIndexEntry } from '../../features/play/creation/index';
import { parseCreationDefinition, assertCreationData } from '../../features/play/creation/definition';
import { verifyCreationInstance } from '../../features/play/creation/instance';
import { createUnavailableCreationAdmissionPort } from '../../features/play/creation/operation';
import { freezeConstructionProof, validConstructionId } from '../../features/play/wilds-construction-project';
export type CreationRepositoryQuery = Readonly<{
    worldId: string;
    spaceId: string;
    regionIds: readonly string[];
    after: string | null;
    limit: number;
}>;
export type CreationRepositoryPage = Readonly<{
    status: 'available';
    worldId: string;
    spaceId: string;
    after: string | null;
    next: string | null;
    entries: readonly Readonly<{
        instance: CreationInstance;
        definition: CreationDefinition;
        index: CreationIndexEntry;
        source: unknown;
    }>[];
}> | Readonly<{
    status: 'unavailable';
    reason: string;
}>;
export type CreationRepositoryRail = Readonly<{
    admission: CreationAdmissionPort;
    read(input: CreationRepositoryQuery): Promise<unknown>;
    authenticatePage(page: CreationRepositoryPage): Promise<boolean>;
}>;
const verifiedPages = new WeakSet<object>();
export function isAuthenticatedCreationPage(page: CreationRepositoryPage): boolean { return verifiedPages.has(page); }
export function createWildsCreationRepository(rail?: CreationRepositoryRail) {
    const admission = rail?.admission || createUnavailableCreationAdmissionPort('creation_global_conditional_rail_unavailable');
    return { async read(query: CreationRepositoryQuery): Promise<CreationRepositoryPage> {
            const unavailable = (reason: string): CreationRepositoryPage => ({ status: 'unavailable', reason });
            if (!rail)
                return unavailable('creation_global_conditional_rail_unavailable');
            try {
                assertCreationData(query);
                if (![query.worldId, query.spaceId].every(validConstructionId) || !Array.isArray(query.regionIds) || query.regionIds.length < 1 || query.regionIds.length > 1024 || new Set(query.regionIds).size !== query.regionIds.length || query.regionIds.some((r: unknown) => typeof r !== 'string' || !/^(-?[0-9]+):(-?[0-9]+)$/.test(r)) || !Number.isSafeInteger(query.limit) || query.limit < 1 || query.limit > 128 || (query.after !== null && !validConstructionId(query.after)))
                    return unavailable('creation_repository_query_invalid');
                const raw = await rail.read(freezeConstructionProof(JSON.parse(JSON.stringify(query))));
                assertCreationData(raw);
                const page = freezeConstructionProof(JSON.parse(JSON.stringify(raw))) as CreationRepositoryPage;
                if (page.status !== 'available' || page.worldId !== query.worldId || page.spaceId !== query.spaceId || page.after !== query.after || page.next !== null && !validConstructionId(page.next) || !Array.isArray(page.entries) || page.entries.length > query.limit || new Set(page.entries.map(e => e.instance.instanceId)).size !== page.entries.length)
                    return unavailable('creation_repository_page_invalid');
                for (const e of page.entries) {
                    const d = parseCreationDefinition(e.definition);
                    if (!verifyCreationInstance(e.instance) || e.instance.definitionDigest !== d.digest || e.instance.worldId !== query.worldId || e.instance.spaceId !== query.spaceId || e.index.instanceId !== e.instance.instanceId || e.index.head !== e.instance.head || e.index.definitionDigest !== d.digest || e.index.worldId !== query.worldId || e.index.spaceId !== query.spaceId || !e.index.regionIds.some((r: string) => query.regionIds.includes(r)))
                        return unavailable('creation_repository_source_binding_invalid');
                }
                createCreationSpatialIndex(page.entries.map(e => e.index));
                if (!await rail.authenticatePage(page))
                    return unavailable('creation_repository_sources_unverified');
                verifiedPages.add(page);
                return page;
            }
            catch {
                return unavailable('creation_repository_read_unavailable');
            }
        }, compareAndAppend: (operation: CreationOperation) => admission.execute(operation), lookup: (operationId: string) => admission.lookup(operationId) };
}
