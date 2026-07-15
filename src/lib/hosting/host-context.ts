import { cleanHost, isPlatformHost, tenantSlugFromHost } from "./domain-utils";
import { platform } from "../platform";

export type HostContext = {
  host: string;
  surface: "platform" | "tenant";
  tenantSlug: string | null;
  tenantHost: string | null;
  customDomain: string | null;
  storageKey: string;
};

export const BASE_STORAGE_KEY = "receiz-app-commerce-state-v1";

export function hostContextFromHost(hostInput: string | null | undefined): HostContext {
  const host = cleanHost(hostInput);
  const tenantSlug = tenantSlugFromHost(host);
  const platformHost = isPlatformHost(host);
  const customDomain = host && !platformHost && !tenantSlug ? host : null;
  const surface = tenantSlug || customDomain ? "tenant" : "platform";
  const tenantHost = tenantSlug ? `${tenantSlug}.${platform.domain}` : customDomain;
  const scope = surface === "platform" ? "platform" : `tenant:${tenantHost}`;

  return {
    host,
    surface,
    tenantSlug,
    tenantHost,
    customDomain,
    storageKey: `${BASE_STORAGE_KEY}:${scope}`
  };
}

export function currentHostContext(): HostContext {
  if (typeof window === "undefined") return hostContextFromHost(null);
  return hostContextFromHost(window.location.host);
}
