export const WILDS_WALLET_READ_AUTHORITY_SCOPES = Object.freeze([
  "openid",
  "profile",
  "receiz:wallet.read"
] as const);

// Receiz V123 evaluates authority challenges in whole Kai pulses.
// Sixty pulses is about 314 seconds and remains well within its 600-pulse cap.
export const WILDS_WALLET_AUTHORITY_WINDOW_PULSES = 60 as const;

export function hasExactWildsWalletReadAuthorityScopes(value: readonly string[]) {
  return value.length === WILDS_WALLET_READ_AUTHORITY_SCOPES.length
    && WILDS_WALLET_READ_AUTHORITY_SCOPES.every((scope, index) => value[index] === scope);
}
