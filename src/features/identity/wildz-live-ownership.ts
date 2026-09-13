/** Notifications request a verified refresh; their payload never changes custody. */
export const WILDZ_OWNERSHIP_REFRESH_EVENT = "wildz:ownership-refresh";
export const WILDZ_OWNERSHIP_REFRESH_INTERVAL_MS = 30_000;

export function startWildzLiveOwnershipRefresh(input: Readonly<{
  refresh(): Promise<void>;
  visibility: Pick<Document, "visibilityState" | "addEventListener" | "removeEventListener">;
  notifications: Pick<Window, "addEventListener" | "removeEventListener">;
  setInterval: typeof globalThis.setInterval;
  clearInterval: typeof globalThis.clearInterval;
}>) {
  let disposed = false, running = false;
  const refresh = () => {
    if (disposed || running || input.visibility.visibilityState === "hidden") return;
    running = true;
    void Promise.resolve().then(() => {
      if (!disposed && input.visibility.visibilityState !== "hidden") return input.refresh();
    }).catch(() => undefined).finally(() => { running = false; });
  };
  input.visibility.addEventListener("visibilitychange", refresh);
  input.notifications.addEventListener(WILDZ_OWNERSHIP_REFRESH_EVENT, refresh);
  const timer = input.setInterval(refresh, WILDZ_OWNERSHIP_REFRESH_INTERVAL_MS);
  refresh();
  return () => {
    disposed = true;
    input.clearInterval(timer);
    input.visibility.removeEventListener("visibilitychange", refresh);
    input.notifications.removeEventListener(WILDZ_OWNERSHIP_REFRESH_EVENT, refresh);
  };
}
