import { receizOidcScopesForRails, type ReceizRailScopeKey } from "@receiz/sdk";

const RECEIZ_APP_RAILS: ReceizRailScopeKey[] = [
  "identity",
  "proofStore",
  "wallet",
  "payments",
  "appState",
  "publicStore",
  "commerce",
  "rewards",
  "customers",
  "merchants",
  "media",
  "domains",
  "events",
  "search",
  "permissions",
  "jobs",
  "audit",
  "risk",
  "compliance",
  "portability",
  "notifications",
  "offline",
  "releases"
];

const RECEIZ_NOTE_SCOPES = ["receiz:notes.mint", "receiz:notes.claim", "receiz:notes.read"];
const RECEIZ_WORLD_OIDC_SCOPES = ["receiz:world.read", "receiz:world.write"];
export const RECEIZ_TWIN_OIDC_SCOPES = ["receiz:twin.read", "receiz:twin.write"];

function uniqueScopes(scopes: string[]) {
  return Array.from(new Set(scopes));
}

export const RECEIZ_BASE_OIDC_SCOPES = [
  "offline_access",
  ...receizOidcScopesForRails(...RECEIZ_APP_RAILS),
  ...RECEIZ_NOTE_SCOPES,
  ...RECEIZ_WORLD_OIDC_SCOPES,
  ...RECEIZ_TWIN_OIDC_SCOPES
];

function disabled(value: string | undefined) {
  return value === "0" || value === "false";
}

export function receizOidcScopesFromEnv(env: Partial<Record<string, string | undefined>>) {
  const scopes = RECEIZ_BASE_OIDC_SCOPES.filter((scope) => {
    if (scope.startsWith("receiz:twin.")) return !disabled(env.RECEIZ_ENABLE_TWIN_SCOPES);
    if (scope.startsWith("receiz:world.")) return !disabled(env.RECEIZ_ENABLE_WORLD_SCOPES);
    return true;
  });

  return uniqueScopes(scopes);
}
