import { canonicalizeReceizV122, sha256ReceizBytes } from "@receiz/sdk";

export type WildsLivingWorldAuthorizationRequest = Readonly<{
  operationId: string;
  planDigest: string;
  semanticIdempotencyKey: string;
  amountPhiMicro: string;
}>;

export async function wildsLivingWorldConsentStatementDigest(input: WildsLivingWorldAuthorizationRequest) {
  const statement = canonicalizeReceizV122({
    schema: "wildz.living-world-consent.v1",
    operationId: input.operationId,
    planDigest: input.planDigest,
    semanticIdempotencyKey: input.semanticIdempotencyKey,
    amountPhiMicro: input.amountPhiMicro
  });
  return sha256ReceizBytes(new TextEncoder().encode(statement));
}
