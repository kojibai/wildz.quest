import { createOwnerBoundInitialPlayState } from "./game-state";

export type WildzParty = {
  schema: "wildz.party.v1";
  explorerIdentityRef: string;
  activeCompanion: {
    assetId: string;
    proofDigest: string;
    speciesId: string;
    familyId: string;
    name: string;
    level: number;
  };
};

export function createDefaultWildzParty(identityRef: string, createdAt = new Date().toISOString()): WildzParty {
  const explorerIdentityRef = identityRef.trim();
  if (!explorerIdentityRef) throw new Error("wildz_party_identity_required");
  const starter = createOwnerBoundInitialPlayState(explorerIdentityRef, createdAt).inventory[0];
  if (!starter) throw new Error("wildz_party_starter_missing");
  return {
    schema: "wildz.party.v1",
    explorerIdentityRef,
    activeCompanion: {
      assetId: starter.id,
      proofDigest: starter.proof.digest,
      speciesId: starter.manifest.species,
      familyId: starter.manifest.familyId,
      name: starter.manifest.name,
      level: 1
    }
  };
}
