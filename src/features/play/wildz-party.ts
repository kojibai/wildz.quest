export type WildzParty = {
  schema: "wildz.party.v1";
  explorerIdentityRef: string;
  activeCompanion: {
    speciesId: "sealcub" | string;
    familyId: "mintcub" | string;
    name: string;
    level: number;
  };
};

export function createDefaultWildzParty(identityRef: string): WildzParty {
  const explorerIdentityRef = identityRef.trim();
  if (!explorerIdentityRef) throw new Error("wildz_party_identity_required");
  return {
    schema: "wildz.party.v1",
    explorerIdentityRef,
    activeCompanion: {
      speciesId: "sealcub",
      familyId: "mintcub",
      name: "SealCub",
      level: 1
    }
  };
}
