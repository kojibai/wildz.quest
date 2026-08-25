import { canonicalizeReceizV122, sha256ReceizBytes } from "@receiz/sdk";
import type { WildsPortableClaimKind } from "./wilds-portable-claim";

export type WildsPortableClaimAuthorizationRequest = Readonly<{
  claimId: string;
  exactPlanDigest: string;
  kind: WildsPortableClaimKind;
}>;

export async function wildsPortableClaimConsentStatementDigest(input: WildsPortableClaimAuthorizationRequest) {
  const statement = canonicalizeReceizV122({
    schema: "wildz.portable-claim-consent.v1",
    claimId: input.claimId,
    exactPlanDigest: input.exactPlanDigest,
    kind: input.kind
  });
  return sha256ReceizBytes(new TextEncoder().encode(statement));
}
