export const WILDZ_MESSAGE_PUSH = "wildz-message";

export function supportsMessagePush() {
  return typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
}

export async function registerMessagePush(requestPermission = false) {
  if (!supportsMessagePush()) throw new Error("Install Wildz on your home screen to enable notifications on supported devices.");
  // Request directly from the tap, before any network awaits (required by Safari).
  const permission = requestPermission ? await Notification.requestPermission() : Notification.permission;
  if (permission !== "granted") throw new Error(permission === "denied" ? "Notifications are blocked. Allow them in your device settings." : "Notifications were not enabled.");
  const config = await fetch("/api/wilds/messages/push", { cache: "no-store" }).then((response) => response.json()) as { configured: boolean; publicKey: string };
  if (!config.configured) throw new Error("Message push is not configured yet.");
  const registration = await navigator.serviceWorker.ready;
  const key = Uint8Array.from(atob(config.publicKey.replace(/-/g, "+").replace(/_/g, "/")), (char) => char.charCodeAt(0));
  const subscription = await registration.pushManager.getSubscription() ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  const response = await fetch("/api/wilds/messages/push", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ subscription: subscription.toJSON() }) });
  if (!response.ok) throw new Error((await response.json()).error ?? "Could not enable message notifications.");
}
