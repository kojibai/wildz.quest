export const WILDS_WALLET_READ_AUTHORITY_SCOPES = Object.freeze([
  "openid",
  "profile",
  "receiz:wallet.read"
] as const);

export function hasExactWildsWalletReadAuthorityScopes(value: readonly string[]) {
  return value.length === WILDS_WALLET_READ_AUTHORITY_SCOPES.length
    && WILDS_WALLET_READ_AUTHORITY_SCOPES.every((scope, index) => value[index] === scope);
}
