import type { CreationImagePayload } from '../../features/play/creation/image';
import { embedCreationImage, readCreationImage, verifyCreationImageAssets } from '../../features/play/creation/image';
import { createWildzExportProofObject, type WildzExportProofObjectActor, type WildzExportProofObjectCreator } from './wildz-proof-object-export';
import { openWildzSealedCard } from './wildz-sealed-card';
import { sha256WildzArtifactBytes, type WildzArtifactPort } from './wildz-artifact-custody';
import { sameWildzPlayerCoordinate } from './wildz-player-coordinate';
import { freezeConstructionProof } from '../../features/play/wilds-construction-project';
export type WildzCreationArtifact = Readonly<{
    kind: 'wildz.creation-proof-object.v1';
    payload: CreationImagePayload;
    filename: string;
    mimeType: string;
    artifactSha256: string;
    artifactBytes: Uint8Array;
    nativeOwnerReceizId: string | null;
}>;
type CreationArtifactOpener = (input: Parameters<typeof openWildzSealedCard>[0]) => Promise<Pick<Awaited<ReturnType<typeof openWildzSealedCard>>, 'payloadBytes' | 'compatibility' | 'ownerReceizId'>>;
const custody = new WeakMap<WildzCreationArtifact, Readonly<{
    ownerReceizId: string;
    instanceId: string;
    head: string;
    artifactSha256: string;
}>>();
/** Uses the exact generic Record/Seal and custody round trip used by creature card export. */
export async function createWildzCreationProofObject(input: Readonly<{
    actor: WildzExportProofObjectActor;
    pixels: Uint8Array;
    payload: CreationImagePayload;
    filename: string;
    createProofObject: WildzExportProofObjectCreator;
    artifacts: WildzArtifactPort;
}>) {
    const bytes = embedCreationImage(input.pixels.slice(), input.payload);
    return createWildzExportProofObject({ actor: input.actor, bytes, filename: input.filename, kind: 'creation', createProofObject: input.createProofObject, artifacts: input.artifacts });
}
/** The default opener is the same canonical SDK verifier as cards. Enclosing document proofs are recovery, not native custody. */
export function createWildzCreationArtifactReader(open: CreationArtifactOpener = openWildzSealedCard) {
    return async function read(input: Readonly<{
        bytes: Uint8Array;
        mimeType: string;
        name?: string;
    }>): Promise<WildzCreationArtifact> {
        const captured = { ...input, bytes: input.bytes.slice() }, bytes = captured.bytes, opened = await open(captured), owner = opened.ownerReceizId, compatibility = opened.compatibility, payload = readCreationImage(opened.payloadBytes.slice());
        if (!await verifyCreationImageAssets(payload))
            throw Error('wildz_creation_asset_bytes_invalid');
        const artifact: WildzCreationArtifact = Object.freeze({ kind: 'wildz.creation-proof-object.v1', payload: freezeConstructionProof(payload), filename: captured.name || 'wildz-creation.png', mimeType: captured.mimeType, artifactSha256: await sha256WildzArtifactBytes(bytes), get artifactBytes() { return bytes.slice(); }, nativeOwnerReceizId: owner });
        if (compatibility === 'current-native' && owner)
            custody.set(artifact, Object.freeze({ ownerReceizId: owner, instanceId: payload.instanceId, head: payload.checkpoint.instances[0]!.head, artifactSha256: artifact.artifactSha256 }));
        return artifact;
    };
}
/** Same ownership coordinates as card custody. Historical creator and domain payload remain intact after transfer. */
export function readWildzCreationArtifactCustody(artifact: WildzCreationArtifact, actorId: string) {
    const bound = custody.get(artifact);
    return bound && sameWildzPlayerCoordinate(bound.ownerReceizId, actorId) ? bound : null;
}
