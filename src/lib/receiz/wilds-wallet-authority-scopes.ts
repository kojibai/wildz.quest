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

export type WildsIdentityAuthorityPurpose = "wallet-read" | "artifact-claim";
// The SDK canonicalizes proof-authority scopes in lexical order before signing
// and validating the response. Keep our exact scope comparison in that order.
export const WILDS_ARTIFACT_CLAIM_AUTHORITY_SCOPES = Object.freeze([
  "openid", "profile", "receiz:record", "receiz:seal", "receiz:wallet.read"
] as const);
export function wildsIdentityAuthorityScopes(purpose: WildsIdentityAuthorityPurpose) {
  return purpose === "artifact-claim" ? WILDS_ARTIFACT_CLAIM_AUTHORITY_SCOPES : WILDS_WALLET_READ_AUTHORITY_SCOPES;
}
export function hasExactWildsIdentityAuthorityScopes(value: readonly string[], purpose: WildsIdentityAuthorityPurpose) {
  const expected = wildsIdentityAuthorityScopes(purpose);
  return value.length === expected.length && expected.every((scope, index) => value[index] === scope);
}
