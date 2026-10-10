import { createReceizClient } from "@receiz/sdk";

export const WILDS_WALLET_RESOURCE_SOURCE_URL_V128 = "https://wildz.quest/receiz/resource-source-v128";
export const WILDS_WALLET_MARKET_SOURCE_URL_V128 = "https://wildz.quest/receiz/market-source-v128";
export const isWildsWalletMarketSourcePageUrlV128 = (value:string) => /^https:\/\/wildz\.quest\/receiz\/market-source-v128\/pages\/[a-f0-9]{64}$/.test(value);
export const isWildsWalletResourceSourcePageUrlV128 = (value:string) => /^https:\/\/wildz\.quest\/receiz\/resource-source-v128\/pages\/[a-f0-9]{64}$/.test(value);
export function isWildsWalletSourceSdkPathV128(path: string, method: string, query: string): boolean {
  const params = new URLSearchParams(query);
  if (path === "/api/public-proof/by-url" && method === "GET") return params.size === 1 && ([WILDS_WALLET_RESOURCE_SOURCE_URL_V128, WILDS_WALLET_MARKET_SOURCE_URL_V128].includes(params.get("url") ?? "") || isWildsWalletMarketSourcePageUrlV128(params.get("url") ?? "") || isWildsWalletResourceSourcePageUrlV128(params.get("url") ?? ""));
  if (params.size > 1 || params.size === 1 && (!params.has("applicationId") || !params.get("applicationId"))) return false;
  if (method === "GET") return /^\/api\/sdk\/v1\/subjects\/receiz(?::|%3A)subject(?::|%3A)[a-f0-9]{64}\/state$/i.test(path);
  return method === "POST" && ["/api/sdk/v1/identity/proof-authority/exchange", "/api/sdk/v1/subjects/admit", "/api/sdk/v1/sources/publish", "/api/sdk/v1/runtime/authority-sessions/open", "/api/sdk/v1/domains/verified-replay", "/api/sdk/v1/assets/seal", "/api/public-proof/registry/feed"].includes(path);
}

/** The released SDK still builds, signs and verifies each real request. Only
 * transport changes to a bounded same-origin port. Tokens stay in memory. */
export function createWildsWalletSourceSdkClientV128(input: Readonly<{ applicationId: string; accessToken?: string; baseUrl?: string; fetcher?: typeof fetch }>) {
  const origin = new URL(input.baseUrl ?? "https://receiz.com").origin;
  return createReceizClient({ applicationId: input.applicationId, baseUrl: origin, ...(input.accessToken ? { accessToken: input.accessToken } : {}), fetchImpl: async (request, init) => {
    const url = new URL(String(request)), method = init?.method ?? "GET", query = url.search.slice(1);
    if (url.origin !== origin || !isWildsWalletSourceSdkPathV128(url.pathname, method, query)) throw Error("wildz_resource_sdk_path_invalid");
    const headers = new Headers();
    const actualHeaders = new Headers(init?.headers);
    for (const name of ["authorization", "x-idempotency-key", "idempotency-key"]) { const value = actualHeaders.get(name); if (value) headers.set(name, value); }
    let body: BodyInit;
    if (init?.body instanceof FormData) {
      const form = new FormData();
      for (const [name, value] of init.body.entries()) form.append(name, value);
      form.set("wildzSdkPath", url.pathname); form.set("wildzSdkQuery", query); form.set("wildzSdkMethod", method);
      body = form;
    } else {
      if (init?.body !== undefined && init.body !== null && typeof init.body !== "string") throw Error("wildz_resource_sdk_body_invalid");
      const native = init?.body ? JSON.parse(init.body) : null;
      body = JSON.stringify({ path: url.pathname, query, method, body: native }); headers.set("content-type", "application/json");
    }
    return (input.fetcher ?? fetch)("/api/wilds/wallet/source-sdk", { method: "POST", headers, body, credentials: "same-origin", cache: "no-store", redirect: "error" });
  } });
}
