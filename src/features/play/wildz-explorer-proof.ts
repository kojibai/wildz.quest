import { generateIdentityBoundWildzCharacter, type WildzCharacterGenesis } from "../identity/wildz-genesis";
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
