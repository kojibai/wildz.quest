export const WILDZ_APPLY_UPDATE_MESSAGE = "WILDZ_APPLY_UPDATE" as const;

export function pwaControllerChangeAction(updateRequested: boolean): "ignore" | "reload" {
  return updateRequested ? "reload" : "ignore";
}
