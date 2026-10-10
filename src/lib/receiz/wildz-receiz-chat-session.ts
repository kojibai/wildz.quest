import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { createReceizClient } from "@receiz/sdk";
import type { NextRequest } from "next/server";
import { receizOAuthSecret } from "./oauth-state";
import { normalizeWildsWalletPublicUsername } from "./wilds-wallet-projections";

export const WILDZ_RECEIZ_CHAT_SESSION_COOKIE = "wildz_receiz_chat_session";
const PURPOSE = "wildz.receiz.chat-session.v1";
const MAX_AGE = 30 * 24 * 60 * 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export type WildzReceizChatSession = Readonly<{
  schema: "wildz.receiz.chat-session.v1";
  origin: string;
  userId: string;
  keyId: string;
  profileHandle: string;
  cookie: string;
  issuedAt: number;
}>;
export const wildzReceizChatSessionCookieOptions = () => ({ httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: MAX_AGE });
function key(secret: string) { return createHash("sha256").update(PURPOSE).update("\0").update(secret).digest(); }

/** Retain only a credential actually issued by signed Receiz device continuation. */
export function retainWildzReceizChatSession(input: { response: Response; baseUrl: string; userId: string; keyId: string; profileHandle: string }, secret = receizOAuthSecret()): string | null {
  const values = input.response.headers.getSetCookie?.() ?? [input.response.headers.get("set-cookie") ?? ""];
  const matches = values.flatMap(value => [...value.matchAll(/(?:^|,\s*)receiz_session=([A-Za-z0-9._~-]{1,2200})(?:;|$)/g)].map(match => match[1]));
  if (matches.length !== 1 || !UUID.test(input.userId) || !/^[a-f0-9]{64}$/.test(input.keyId)) return null;
  const origin = new URL(input.baseUrl).origin;
  if (!origin.startsWith("https://")) return null;
  const payload: WildzReceizChatSession = { schema: PURPOSE, origin, userId: input.userId.toLowerCase(), keyId: input.keyId, profileHandle: `${normalizeWildsWalletPublicUsername(input.profileHandle)}.receiz.id`, cookie: matches[0], issuedAt: Date.now() };
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(secret), iv);
  cipher.setAAD(Buffer.from(PURPOSE));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  const token = `v1.${iv.toString("base64url")}.${encrypted.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}`;
  return token.length <= 3800 ? token : null;
}

export function readWildzReceizChatSession(request: NextRequest, expected: { ownerReceizId: string; profileHandle: string; keyId: string }, secret = receizOAuthSecret()): WildzReceizChatSession {
  const token = request.cookies.get(WILDZ_RECEIZ_CHAT_SESSION_COOKIE)?.value;
  if (!token) throw new Error("receiz_wallet_connect_session_required");
  try {
    if (token.length > 3800) throw new Error("shape");
    const [version, iv, bytes, tag, ...extra] = token.split(".");
    if (version !== "v1" || !iv || !bytes || !tag || extra.length) throw new Error("shape");
    const decipher = createDecipheriv("aes-256-gcm", key(secret), Buffer.from(iv, "base64url"));
    decipher.setAAD(Buffer.from(PURPOSE)); decipher.setAuthTag(Buffer.from(tag, "base64url"));
    const payload = JSON.parse(Buffer.concat([decipher.update(Buffer.from(bytes, "base64url")), decipher.final()]).toString("utf8")) as WildzReceizChatSession;
    if (payload.schema !== PURPOSE || payload.origin !== new URL(process.env.RECEIZ_BASE_URL || "https://receiz.com").origin
      || payload.userId !== expected.ownerReceizId || payload.keyId !== expected.keyId
      || normalizeWildsWalletPublicUsername(payload.profileHandle) !== normalizeWildsWalletPublicUsername(expected.profileHandle)
      || typeof payload.cookie !== "string" || !/^[A-Za-z0-9._~-]{1,2200}$/.test(payload.cookie)
      || !Number.isSafeInteger(payload.issuedAt) || payload.issuedAt > Date.now() + 30_000 || Date.now() - payload.issuedAt >= MAX_AGE * 1000) throw new Error("binding");
    return Object.freeze(payload);
  } catch { throw new Error("receiz_wallet_connect_session_binding_invalid"); }
}

/** The public SDK request port is limited to the two existing cookie-authenticated chat routes. */
export function createWildzReceizChatClient(session: WildzReceizChatSession, fetchImpl: typeof fetch = globalThis.fetch) {
  return createReceizClient({ baseUrl: session.origin, fetchImpl: async (input, init) => {
    const url = new URL(String(input));
    if (url.origin !== session.origin || url.protocol !== "https:" || !(url.pathname === "/api/chat/conversations" || /^\/api\/chat\/conversations\/[0-9a-f-]{36}\/messages$/i.test(url.pathname))) throw new Error("receiz_wallet_connect_chat_path_invalid");
    const headers = new Headers(init?.headers);
    headers.delete("authorization"); headers.set("cookie", `receiz_session=${session.cookie}`);
    return fetchImpl(url, { ...init, headers, redirect: "error", cache: "no-store" });
  } });
}
