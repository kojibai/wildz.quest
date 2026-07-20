export const WILDS_WORLD_OFFLINE_MESSAGE = "Connection unavailable — this live action is saved and will keep retrying until globally committed.";
export const WILDS_MULTIPLAYER_OFFLINE_MESSAGE = "Connection unavailable — live global presence resumes automatically when connected.";
export const WILDS_NETWORK_RETRY_BACKOFF_MS = 15_000;

type NetworkStatus = { onLine?: boolean } | null | undefined;

function browserNetworkStatus(): NetworkStatus {
  return typeof navigator === "undefined" ? undefined : navigator;
}

export function shouldAttemptWildsNetwork(status: NetworkStatus = browserNetworkStatus()) {
  return status?.onLine !== false;
}

export function isOpaqueWildsNetworkFailure(cause: unknown) {
  const message = cause instanceof Error ? cause.message.trim() : "";
  return /failed to fetch|networkerror|load failed|^connection unavailable —/i.test(message);
}

export function wildsNetworkFailureMessage(
  cause: unknown,
  surface: "world" | "multiplayer",
  online = shouldAttemptWildsNetwork()
) {
  const offlineMessage = surface === "world" ? WILDS_WORLD_OFFLINE_MESSAGE : WILDS_MULTIPLAYER_OFFLINE_MESSAGE;
  if (!online) return offlineMessage;

  const message = cause instanceof Error ? cause.message.trim() : "";
  if (!message || isOpaqueWildsNetworkFailure(cause)) return offlineMessage;
  if (message === "wilds_multiplayer_card_owner_invalid") {
    return "That companion is not admitted to this verified Vault session yet.";
  }
  return message;
}
