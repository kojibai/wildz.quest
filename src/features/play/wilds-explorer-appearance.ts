import type { WildzCharacterGenesis } from "../identity/wildz-genesis";

const COMPLEXIONS: Record<WildzCharacterGenesis["traits"]["complexion"], string> = {
  dawn: "#E8B58F",
  clay: "#C98B68",
  copper: "#B97856",
  umber: "#8B5D45",
  mahogany: "#684334",
  "night-bloom": "#493029"
};

const HAIR_COLORS = ["#211815", "#3A241C", "#533524", "#172C2A", "#30243D", "#5A3A24"] as const;

const MATERIAL_ROUGHNESS: Record<WildzCharacterGenesis["traits"]["material"], number> = {
  "woven-leaf": 0.86,
  "soft-shell": 0.54,
  "river-hide": 0.72,
  "prism-knit": 0.38,
  "bark-plate": 0.92,
  "mist-fiber": 0.48
};

export type WildsExplorerAppearance = {
  skin: string;
  hair: string;
  hairProfile: string;
  outfitProfile: string;
  outfitPrimary: string;
  outfitSecondary: string;
  materialRoughness: number;
  accessory: string;
  trail: string;
  signatureMark: string;
  signatureSeed: number;
};

export function projectWildsExplorerAppearance(character: WildzCharacterGenesis): WildsExplorerAppearance {
  const signatureSeed = Number.parseInt(character.digest.slice(0, 8), 16) / 0xffffffff;
  const hairIndex = Math.min(HAIR_COLORS.length - 1, Math.floor(signatureSeed * HAIR_COLORS.length));
  return {
    skin: COMPLEXIONS[character.traits.complexion],
    hair: HAIR_COLORS[hairIndex]!,
    hairProfile: character.traits.hair,
    outfitProfile: character.traits.outfit,
    outfitPrimary: character.traits.primaryColor,
    outfitSecondary: character.traits.secondaryColor,
    materialRoughness: MATERIAL_ROUGHNESS[character.traits.material],
    accessory: character.traits.accessory,
    trail: character.traits.trail,
    signatureMark: character.traits.signatureMark,
    signatureSeed
  };
}
