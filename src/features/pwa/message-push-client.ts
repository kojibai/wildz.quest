export const WILDZ_MESSAGE_PUSH = "wildz-message";

export type MessagePushConfig = { configured: boolean; publicKey: string | null };

export function supportsMessagePush() {
  return typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
}

export async function readMessagePushConfig(): Promise<MessagePushConfig> {
  const response = await fetch("/api/wilds/messages/push", { cache: "no-store" });
  if (!response.ok) throw new Error("Message notifications are temporarily unavailable. Please try again later.");
  const config = await response.json() as MessagePushConfig;
  return { configured: config.configured === true && typeof config.publicKey === "string", publicKey: config.publicKey };
}

export async function registerMessagePush(requestPermission = false, readyConfig?: MessagePushConfig) {
  if (!supportsMessagePush()) throw new Error("Install Wildz on your home screen to enable notifications on supported devices.");
  // Load configuration before presenting an enable action. Safari needs the
  // permission request directly inside the tap, with no intervening fetch.
  if (requestPermission && (!readyConfig?.configured || !readyConfig.publicKey)) {
    throw new Error("Message notifications are temporarily unavailable. You can still read new messages in Wildz.");
  }
  const permission = requestPermission ? await Notification.requestPermission() : Notification.permission;
  if (permission !== "granted") throw new Error(permission === "denied" ? "Notifications are blocked. Allow them in your device settings." : "Notifications were not enabled.");
  const config = readyConfig ?? await readMessagePushConfig();
  if (!config.configured || !config.publicKey) throw new Error("Message notifications are temporarily unavailable. You can still read new messages in Wildz.");
  const registration = await navigator.serviceWorker.ready;
  const key = Uint8Array.from(atob(config.publicKey.replace(/-/g, "+").replace(/_/g, "/")), (char) => char.charCodeAt(0));
  const subscription = await registration.pushManager.getSubscription() ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  const response = await fetch("/api/wilds/messages/push", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ subscription: subscription.toJSON() }) });
  if (!response.ok) {
    if (response.status === 401) throw new Error("Sign in to enable message notifications.");
    throw new Error("Could not enable message notifications. Please try again.");
  }
}
