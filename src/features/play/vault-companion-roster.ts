import { emptyAdventureCondition, type AdventureCardCondition } from "./adventure/card-condition";
import { creatureForm } from "./creature-catalog";
import type { PlayState } from "./game-state";
import { currentRevision } from "./living-card-proof";
import { isLivingCardAsset } from "./living-card-types";
import type { PortableCardAsset } from "./portable-card";

export type VaultCompanionRosterEntry = Readonly<{
  asset: PortableCardAsset;
  name: string;
  level: number;
  xp: number;
  bond: number;
  fatigue: number;
  injuryCount: number;
  conditionLabel: "Ready" | "Tired" | "Recovering" | "Injured";
  element: string;
  species: string;
  active: boolean;
  newlyCaptured: boolean;
}>;

export type VaultCompanionRosterInput = Readonly<{
  inventory: readonly PortableCardAsset[];
  companionProgress: PlayState["companionProgress"];
  cardConditions: PlayState["adventureConditions"];
  activeAssetId: string | null;
  newAssetId: string | null;
}>;

function projectRosterConditionLabel(condition: AdventureCardCondition): VaultCompanionRosterEntry["conditionLabel"] {
  if (condition.recovery && condition.recovery.state !== "stable") return "Recovering";
  if (condition.injuries.length) return "Injured";
  if (condition.fatigue > 0) return "Tired";
  return "Ready";
}

export function projectVaultCompanionRoster(input: VaultCompanionRosterInput): readonly VaultCompanionRosterEntry[] {
  return input.inventory.flatMap((asset) => {
    const condition = input.cardConditions[asset.id] ?? emptyAdventureCondition(asset.id);
    const retired = condition.life === "dead"
      || (isLivingCardAsset(asset) && Boolean(currentRevision(asset).growth.life?.retired));
    if (retired) return [];

    const progress = input.companionProgress[asset.manifest.familyId]
      ?? input.companionProgress[asset.id]
      ?? { level: 1, xp: 0, bond: 0 };
    const form = creatureForm(asset.manifest.formId);
    return [{
      asset,
      name: asset.manifest.name,
      level: progress.level,
      xp: progress.xp,
      bond: progress.bond,
      fatigue: condition.fatigue,
      injuryCount: condition.injuries.length,
      conditionLabel: projectRosterConditionLabel(condition),
      element: form?.element ?? "Unknown",
      species: asset.manifest.species,
      active: asset.id === input.activeAssetId,
      newlyCaptured: asset.id === input.newAssetId
    }];
  });
}
