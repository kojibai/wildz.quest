const SESSION_CODES = new Set(["receiz_authority_required", "receiz_identity_key_required", "receiz_profile_required", "wildz_proof_session_required", "unauthorized"]);
const RETRY_DELAYS = [300, 900, 1800] as const;

export function friendlyWildzMarketError(value: unknown, fallback: string): string {
  const code = value instanceof Error ? value.message : value;
  if (typeof code !== "string") return fallback;
  if (SESSION_CODES.has(code)) return "Your Receiz ID is connecting to the market. Refresh in a moment to continue.";
  if (/capability_unavailable|resource_custody_unavailable|conditional_resource_custody_unavailable/.test(code)) {
    return "Trading is temporarily unavailable. Refresh to check again; your items stay in your Vault and Resources pack.";
  }
  if (/revision_conflict|listing_not_active/.test(code)) return "This listing changed. Refresh the market before trying again.";
  return /^[a-z][a-z0-9_.:-]*$/i.test(code) ? fallback : code;
}

function waitForRetry(delayMs: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(new DOMException("Market closed", "AbortError")); };
    const timer = setTimeout(() => { signal?.removeEventListener("abort", abort); resolve(); }, delayMs);
    if (signal?.aborted) abort();
    else signal?.addEventListener("abort", abort, { once: true });
  });
}

/** Retries only a public GET while an authenticated cookie is still arriving.
 * Purchases, reservations and payment recovery are always explicit user actions. */
export async function readWildzMarket<T>(url: string, options: {
  signal?: AbortSignal;
  fetcher?: typeof fetch;
  wait?: (delayMs: number, signal?: AbortSignal) => Promise<void>;
} = {}): Promise<{ response: Response; result: T | null }> {
  const fetcher = options.fetcher ?? globalThis.fetch;
  for (let attempt = 0; ; attempt++) {
    options.signal?.throwIfAborted();
    const response = await fetcher(url, { method: "GET", credentials: "same-origin", cache: "no-store", signal: options.signal });
    const result = await response.json().catch(() => null) as T | null;
    const code = result && typeof result === "object" ? (result as { error?: unknown }).error : null;
    const sessionPending = response.status === 401 || (typeof code === "string" && SESSION_CODES.has(code));
    if (response.ok || !sessionPending || attempt >= RETRY_DELAYS.length) return { response, result };
    await (options.wait ?? waitForRetry)(RETRY_DELAYS[attempt], options.signal);
  }
}
