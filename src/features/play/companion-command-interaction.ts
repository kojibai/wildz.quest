import type { CompanionGestureState } from "./companion-command-gesture";

export type CompanionCommandInteractionState = Readonly<{
  mode: CompanionGestureState["mode"];
  activeAbilityIndex: number | null;
  keyboardWheelOpen: boolean;
  restoreFocus: boolean;
}>;

export function openCompanionKeyboardInteraction(
  selectedAbilityIndex: number,
  abilityCount: number
): CompanionCommandInteractionState {
  return {
    mode: "ability-wheel",
    activeAbilityIndex: selectedAbilityIndex % Math.max(1, abilityCount),
    keyboardWheelOpen: true,
    restoreFocus: false
  };
}

export function resetCompanionCommandInteraction(
  reason: "commit" | "escape" | "owner-cancel" | "pointer"
): CompanionCommandInteractionState {
  return {
    mode: "pending",
    activeAbilityIndex: null,
    keyboardWheelOpen: false,
    restoreFocus: reason === "commit" || reason === "escape"
  };
}
