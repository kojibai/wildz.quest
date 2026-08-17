export const WILDZ_APPLY_UPDATE_MESSAGE = "WILDZ_APPLY_UPDATE" as const;
export const WILDZ_CARE_SCHEDULE_MESSAGE = "WILDZ_CARE_SCHEDULE" as const;
export const WILDZ_ENABLE_CARE_NOTIFICATIONS = "wildz:enable-care-notifications" as const;
export const WILDZ_CARE_NOTIFICATIONS_READY = "wildz:care-notifications-ready" as const;

export function pwaControllerChangeAction(updateRequested: boolean): "ignore" | "reload" {
  return updateRequested ? "reload" : "ignore";
}
