import type { PortableCardAsset } from "../../features/play/portable-card";
import { defaultContinuityDatabase, defaultIdentityRepository } from "./wildz-active-identity";
import { createWildzArtifactHistory } from "./wildz-artifact-history";
import { createWildzArtifactCodec, readWildzArtifactCrewCustody, retainWildzCrewCustodyMemory } from "./wildz-artifact-codec";
import { reopenWildzCrewCustody, wildzCrewCustodySourceKey } from "./wildz-crew-custody-source";
import { createWildzSealedDocumentStore } from "./wildz-sealed-document-store";
import { inspectReceizCommerceVault } from "./receiz-commerce-vault";
import { openWildzArtifactSameOrigin } from "./wildz-same-origin-verifier";

/** Shared main/worker source boundary; the worker never imports its caller. */
export async function reopenWildzStoredCrewCustody(owner: { keyId: string; actorId: string }, cards: readonly PortableCardAsset[]) {
  const history = createWildzArtifactHistory(defaultContinuityDatabase);
  const codec = createWildzArtifactCodec({
    allowQuarantinedIdentityRecovery: true, allowQuarantinedCardImport: true,
    identityRepository: defaultIdentityRepository,
    sealedDocumentStore: createWildzSealedDocumentStore(defaultContinuityDatabase),
    commerceVaultReader: { inspect: inspectReceizCommerceVault },
    artifactOpener: { async open(input) {
      const admitted = await openWildzArtifactSameOrigin(input);
      await history.append(admitted);
      return admitted;
    } }
  });
  const custody = await reopenWildzCrewCustody({ owner: owner.actorId, cards,
    sources: await defaultContinuityDatabase.read("meta", wildzCrewCustodySourceKey(owner.keyId, owner.actorId)),
    history: { async read(sha) {
      const native = await history.read(sha);
      if (native) return native;
      const seal = await defaultContinuityDatabase.read<{ bytes: Uint8Array; mimeType: string }>("meta", `wildz:crew-seal-source:v1:${sha}`);
      return seal ? { artifactBytes: seal.bytes, mimeType: seal.mimeType, filename: "identity-seal" } : null;
    } }, codec,
    readIdentitySeal: () => defaultIdentityRepository.withKeyFile(owner.keyId, async keyFile => {
      if (!keyFile.portableState) return null;
      const inspection = await codec.inspect({ bytes: new TextEncoder().encode(JSON.stringify(keyFile)), mimeType: "application/json" });
      return readWildzArtifactCrewCustody(inspection);
    }) });
  await retainWildzCrewCustodyMemory(defaultContinuityDatabase, owner, custody, cards).catch(() => undefined);
  return custody;
}
