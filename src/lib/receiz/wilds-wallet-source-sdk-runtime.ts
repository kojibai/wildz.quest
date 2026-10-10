import { createReceizClient, readReceizIdentityArtifact, receizBase64UrlDecode, sha256ReceizBytes } from "@receiz/sdk";
import type { NextRequest } from "next/server";
import { createReceizCommerceAdapter } from "./adapter";
import { resolveWildsWalletReadAuthority } from "./wilds-wallet-route-authority";
import { readWildzProofSessionCookie } from "./wildz-proof-session";
import { readWildzReceizChatSession, type WildzReceizChatSession } from "./wildz-receiz-chat-session";
import { isWildsWalletSourceSdkPathV128, isWildsWalletMarketSourcePageUrlV128, isWildsWalletResourceSourcePageUrlV128, WILDS_WALLET_RESOURCE_SOURCE_URL_V128, WILDS_WALLET_MARKET_SOURCE_URL_V128 } from "../../features/play/wallet/wilds-wallet-source-sdk-v128";
import { describeWildzMarketSourceArchivePageV128, type WildzMarketSourceArchivePageV128 } from "./wildz-market-source-archive-v128";
import {describeWildzMarketSourceBytesPageV128} from "./wildz-market-source-original-locator-v128";
import {describeWildsResourceSourceArchivePageV128} from "./wilds-resource-source-archive-v128";
import { normalizeWildsWalletPublicUsername } from "./wilds-wallet-projections";

const MAX_BYTES = 2_000_000;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const configuredApplication = () => { const id = process.env.RECEIZ_CLIENT_ID?.trim(); if (!id) throw Error("The registered Receiz application is required for source authority."); return id; };
/** Content-addressed transport only; each source still needs native admission. */
export function assertWildsWalletSourceArchivePageV128(namespace: string, url: string, page: unknown): void {
  if (!object(page)) throw Error("The exact source archive page is required.");
  const resource = namespace === "wildz.resources.v128" && isWildsWalletResourceSourcePageUrlV128(url);
  const market = namespace === "wildz.market.v128" && isWildsWalletMarketSourcePageUrlV128(url);
  if (!resource && !market) throw Error("The source archive page belongs to another namespace.");
  const digest = page.schema === "wildz.market-source-bytes-page.v128"
    ? describeWildzMarketSourceBytesPageV128(page).digest
    : resource && page.schema === "wildz.resource-source-page.v128"
      ? describeWildsResourceSourceArchivePageV128(page).digest
      : market && page.schema === "wildz.market-source-page.v128"
        ? describeWildzMarketSourceArchivePageV128(page as WildzMarketSourceArchivePageV128).digest
        : null;
  if (digest !== url.split("/").at(-1)) throw Error("The exact source archive page must match its content address.");
}
async function context(request: NextRequest) {
  const authority = await resolveWildsWalletReadAuthority(request), proof = readWildzProofSessionCookie(request);
  return { authority, proof, session: readWildzReceizChatSession(request, { ...authority, keyId: proof.keyId }) };
}
export async function wildsWalletSourceSdkConfigV128(request: NextRequest,
  resolveSession: (request: NextRequest) => Promise<WildzReceizChatSession> = async request => (await context(request)).session) {
  const session = await resolveSession(request);
  return { applicationId: configuredApplication(), baseUrl: session.origin };
}

/** A bounded transport for actual published source APIs. Current account/key
 * and real scoped token admission happen before proxying any edge. The native
 * host independently enforces its signed authority/source-head laws. */
export async function proxyWildsWalletSourceSdkV128(request: NextRequest): Promise<Response> {
  const { authority, proof, session } = await context(request);
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BYTES) throw Error("The exact source SDK request is too large.");
  let path: string, query: string, method: string, body: unknown;
  if (request.headers.get("content-type")?.startsWith("multipart/form-data")) {
    const bytes = await request.arrayBuffer(); if (bytes.byteLength > MAX_BYTES) throw Error("The exact source SDK request is too large.");
    const form = await new Response(bytes, { headers: { "content-type": request.headers.get("content-type")! } }).formData();
    path = String(form.get("wildzSdkPath") ?? ""); query = String(form.get("wildzSdkQuery") ?? ""); method = String(form.get("wildzSdkMethod") ?? "");
    if ([...form.keys()].sort().join(",") !== "file,wildzSdkMethod,wildzSdkPath,wildzSdkQuery" || !(form.get("file") instanceof File)) throw Error("The exact source SDK file is required.");
    const native = new FormData(); native.set("file", form.get("file")!); body = native;
  } else {
    const text = await request.text(); if (new TextEncoder().encode(text).length > MAX_BYTES) throw Error("The exact source SDK request is too large.");
    const wire = JSON.parse(text);
    if (!object(wire) || Object.keys(wire).sort().join(",") !== "body,method,path,query" || typeof wire.path !== "string" || typeof wire.query !== "string" || typeof wire.method !== "string") throw Error("The exact SDK source request is required.");
    ({ path, query, method, body } = wire as { path: string; query: string; method: string; body: unknown });
  }
  if (!isWildsWalletSourceSdkPathV128(path, method, query) || path.length > 400 || query.length > 800) throw Error("wildz_resource_sdk_path_invalid");
  const applicationId = configuredApplication(), params = new URLSearchParams(query);
  if (params.has("applicationId") && params.get("applicationId") !== applicationId || object(body) && typeof body.applicationId === "string" && body.applicationId !== applicationId) throw Error("The native source request names another application.");
  const headers = new Headers({ accept: request.headers.get("accept") ?? "application/json" });
  for (const name of ["x-idempotency-key", "idempotency-key"]) {
    const value = request.headers.get(name); if (value) { if (value.length > 256 || /[\r\n]/.test(value)) throw Error("The exact native idempotency key is invalid."); headers.set(name, value); }
  }
  const nativeExchange = path === "/api/sdk/v1/identity/proof-authority/exchange";
  const nativeSeal = path === "/api/sdk/v1/assets/seal";
  const publicRead = path === "/api/public-proof/by-url";
  const signedPublish = path === "/api/public-proof/registry/feed";
  if (nativeExchange) {
    if (!object(body) || !object(body.artifact) || typeof body.artifact.exactBytesB64u !== "string" || body.artifact.exactBytesB64u.length > 700_000 || body.applicationId !== applicationId || !object(body.challenge) || !object(body.challenge.proof)) throw Error("The exact native device grant request is required.");
    const bytes = receizBase64UrlDecode(body.artifact.exactBytesB64u), key = await readReceizIdentityArtifact(bytes);
    // A locally created identity uid may differ from its continued native user
    // UUID. The authenticated continuation binds this exact key to the account;
    // the native exchange independently resolves its registered public key.
    if (key.crypto.privateKeyPkcs8B64u || key.keyId !== proof.keyId
      || normalizeWildsWalletPublicUsername(key.owner.username) !== normalizeWildsWalletPublicUsername(authority.profileHandle)
      || body.challenge.proof.keyId !== proof.keyId || body.artifact.digest !== await sha256ReceizBytes(bytes)) throw Error("The source grant does not match the current safe Identity Seal.");
    // The upstream SDK service admits the exact device proof/allowed scopes and
    // current key. Its real returned token is not fabricated or persisted here.
  } else if (signedPublish) {
    if (!object(body) || !object(body.identityProof) || body.identityProof.keyId !== proof.keyId || body.merchantReceizId !== authority.profileHandle
      || body.tenantHost !== "wildz.quest" || !object(body.feed) || JSON.stringify(body.feed).includes("privateKeyPkcs8B64u")) throw Error("The public source locator must be signed by the current Explorer.");
    // A public locator is weaker than root source proof. It may name ONLY the
    // fixed Wildz source URL, never a user-selected URL/private account export.
    const records = body.feed.records;
    const pageUrl=Array.isArray(records)&&records.length===1&&object(records[0])&&typeof records[0].sourceUrl==="string"&&(isWildsWalletMarketSourcePageUrlV128(records[0].sourceUrl)||isWildsWalletResourceSourcePageUrlV128(records[0].sourceUrl))?records[0].sourceUrl:null;
    const locator = body.feed.namespace === "wildz.resources.v128"
      ? { url: pageUrl&&isWildsWalletResourceSourcePageUrlV128(pageUrl)?pageUrl:WILDS_WALLET_RESOURCE_SOURCE_URL_V128, schema: pageUrl&&isWildsWalletResourceSourcePageUrlV128(pageUrl)?"wildz.resource-source-page-locator.v128":"wildz.resource-source-locator.v128" }
      : body.feed.namespace === "wildz.market.v128" ? { url: pageUrl&&isWildsWalletMarketSourcePageUrlV128(pageUrl)?pageUrl:WILDS_WALLET_MARKET_SOURCE_URL_V128, schema: pageUrl&&isWildsWalletMarketSourcePageUrlV128(pageUrl)?"wildz.market-source-page-locator.v128":"wildz.market-source-locator.v128" } : null;
    if (!locator || body.feed.externalCreatorId !== authority.profileHandle
      || !Array.isArray(records) || records.length !== 1 || !object(records[0])
      || records[0].sourceUrl !== locator.url || records[0].externalCreatorId !== authority.profileHandle
      || records[0].namespace !== body.feed.namespace || !object(body.storeStateRecord)
      || body.storeStateRecord.schema !== locator.schema) throw Error("The fixed source locator is required.");
    if(pageUrl){
      assertWildsWalletSourceArchivePageV128(String(body.feed.namespace),pageUrl,body.storeStateRecord.page);
    }
  } else if (!publicRead) {
    const bearer = request.headers.get("authorization")?.match(/^Bearer ([^\s]{1,12000})$/)?.[1];
    if (!bearer) throw Error("An actual scoped device grant is required for this source edge.");
    const checked = await createReceizCommerceAdapter({ accessToken: bearer }).introspectAccessToken();
    const required = nativeSeal ? ["receiz:record","receiz:seal"] : [path.includes("/domains/") ? "receiz:domains.read" : path === "/api/sdk/v1/sources/publish" ? "receiz:domains.write" : method === "GET" ? "receiz:subjects.read" : "receiz:subjects.write"];
    const scopes = typeof checked.scope === "string" ? checked.scope.split(/\s+/) : [];
    if (checked.active !== true || checked.sub !== authority.ownerReceizId || checked.actor_label !== proof.keyId || !required.every(scope => scopes.includes(scope))) throw Error("The source grant belongs to another account, key, or scope.");
    headers.set("authorization", `Bearer ${bearer}`);
  }
  if (nativeSeal) { if (!(body instanceof FormData)) throw Error("The native source seal requires its exact file."); headers.set("cookie", `receiz_session=${session.cookie}`); }
  if (body !== null && !(body instanceof FormData)) headers.set("content-type", "application/json");
  // SDK constructs the exact route/body; this bridge never reinterprets amounts,
  // custody, heads or proofs. For multipart, the public SDK generated FormData
  // is forwarded unchanged after removing only local routing fields.
  const sdk = createReceizClient({ baseUrl: session.origin, applicationId, fetchImpl: async (input, init) => {
    const url = new URL(String(input)); if (url.origin !== session.origin || !isWildsWalletSourceSdkPathV128(url.pathname, method, url.search.slice(1))) throw Error("wildz_resource_sdk_path_invalid");
    const forwarded = new Headers(init?.headers); for (const [key, value] of headers) forwarded.set(key, value);
    return fetch(url, { ...init, headers: forwarded, redirect: "error", cache: "no-store" });
  } });
  if (nativeSeal) {
    // Public SDK request() serializes JSON only; its native sealer already made
    // this exact multipart file, so use that same bounded transport directly.
    return fetch(`${session.origin}${path}${query ? `?${query}` : ""}`, { method, headers, body: body as FormData, redirect: "error", cache: "no-store" });
  }
  if (body !== null && !object(body)) throw Error("The exact SDK source body must be an object.");
  const result = await sdk.request<unknown>(`${path}${query ? `?${query}` : ""}`, { method, ...(body === null ? {} : { body }) });
  return Response.json(result, { headers: { "cache-control": "private, no-store" } });
}
