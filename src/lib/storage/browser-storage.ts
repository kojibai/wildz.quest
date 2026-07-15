type BrowserStorage = Pick<Storage, "getItem" | "removeItem" | "setItem">;

export type SafeStorageWriteResult = {
  ok: boolean;
  reason?: "quota_exceeded" | "unavailable";
};

function isQuotaExceeded(error: unknown) {
  if (!(error instanceof Error)) return false;
  return error.name === "QuotaExceededError" || error.message.toLowerCase().includes("quota");
}

export function safeGetLocalStorage(storage: Pick<Storage, "getItem">, key: string) {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

export function safeRemoveLocalStorage(storage: Pick<Storage, "removeItem">, key: string) {
  try {
    storage.removeItem(key);
  } catch {
    // Browser storage can be blocked or over quota; remove should never break rendering.
  }
}

export function safeSetLocalStorage(storage: Pick<BrowserStorage, "removeItem" | "setItem">, key: string, value: string): SafeStorageWriteResult {
  try {
    storage.setItem(key, value);
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: isQuotaExceeded(error) ? "quota_exceeded" : "unavailable" };
  }
}
