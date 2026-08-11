import { generateIdentityBoundWildzCharacter, type WildzCharacterGenesis } from "../identity/wildz-genesis";
import type { WildzContinuitySnapshot } from "../../lib/receiz/wildz-identity-adapter";
import { projectWildsExplorerAppearance } from "./wilds-explorer-appearance";

export function projectWildzExplorerRender(character: WildzCharacterGenesis) {
  return {
    character,
    style: character.gender,
    appearance: projectWildsExplorerAppearance(character)
  } as const;
}

export function projectWildzProofExplorer(input: {
  session: { keyId: string; createdAt?: string | null };
  character: WildzCharacterGenesis | null;
  legacyAvatarStyle: "female" | "male" | null;
}) {
  const generated = generateIdentityBoundWildzCharacter(input.session);
  const proofCharacter = input.character?.digest === generated.digest ? input.character : generated;
  return projectWildzExplorerRender(proofCharacter);
}

export function projectWildzContinuityExplorer(snapshot: WildzContinuitySnapshot) {
  if (snapshot.session.createdAt) return projectWildzProofExplorer({
    session: snapshot.session,
    character: snapshot.character,
    legacyAvatarStyle: snapshot.playerContinuity?.settings.avatarStyle ?? null
  });
  return snapshot.character ? projectWildzExplorerRender(snapshot.character) : null;
}
