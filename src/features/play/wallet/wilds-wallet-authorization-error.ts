// Only bounded protocol codes cross into presentation or operational logs.
export function walletAuthorizationFailureCode(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "AUTHORIZATION_UNAVAILABLE";
  const record = value as Record<string, unknown>;
  const code = record.code ?? record.error;
  return typeof code === "string" && /^[A-Za-z][A-Za-z0-9_]{2,80}$/.test(code)
    ? code : "AUTHORIZATION_UNAVAILABLE";
}

export class WildsWalletAuthorizationError extends Error {
  constructor(readonly code: string) {
    const reason = code === "IDENTITY_NOT_BOUND"
      ? "Receiz has not connected this seal to its remote account."
      : code === "APPLICATION_NOT_AUTHORIZED" || code === "SCOPE_NOT_GRANTED"
        ? "Receiz has not enabled this wallet connection for Wildz."
        : code === "CHALLENGE_EXPIRED" || code === "CHALLENGE_REPLAYED"
          ? "The wallet connection challenge expired. Please retry."
          : "Receiz could not complete the wallet connection.";
    super(`${reason} No transfer was submitted. Reference: ${code}.`);
    this.name = "WildsWalletAuthorizationError";
  }
}
