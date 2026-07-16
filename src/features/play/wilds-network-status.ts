export const WILDS_WORLD_OFFLINE_MESSAGE = "Offline — local play continues. Shared world sync resumes when connected.";
export const WILDS_MULTIPLAYER_OFFLINE_MESSAGE = "Offline — local play continues. Nearby explorers resume when connected.";
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
  return /failed to fetch|networkerror|load failed|^offline — local play continues\./i.test(message);
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
  return message;
}
