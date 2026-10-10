import { createReceizClient } from "@receiz/sdk";
import type { WildzReceizChatSession } from "./wildz-receiz-chat-session";

/** Only existing published native endpoints accept the genuine retained device
 * continuation cookie. This bridge never mints bearer tokens or impersonates a
 * receiver, and cannot call any historical V120 route. */
export function createWildzReceizBearerClient(session: WildzReceizChatSession, fetchImpl: typeof fetch = globalThis.fetch) {
  return createReceizClient({ baseUrl: session.origin, fetchImpl: async (input, init) => {
    const url = new URL(String(input));
    if (url.origin !== session.origin || url.protocol !== "https:" || init?.method !== "POST" || url.search
      || !["/api/receiz/ownership/bearer-claim", "/api/sdk/v1/assets/seal"].includes(url.pathname)
      || !(init.body instanceof FormData)) throw Error("wildz_native_bearer_path_invalid");
    const headers = new Headers(init.headers); headers.delete("authorization"); headers.set("cookie", `receiz_session=${session.cookie}`);
    return fetchImpl(url, { ...init, headers, redirect: "error", cache: "no-store" });
  } });
}
