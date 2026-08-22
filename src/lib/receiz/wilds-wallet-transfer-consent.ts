import { canonicalizeReceizV122, sha256ReceizBytes } from "@receiz/sdk";
import { WILDZ_RECEIZ_APPLICATION_ID } from "./wildz-application";

export type WildsWalletTransferConsentBasis = Readonly<{
  attempt: string;
  amountPhiMicro: string;
  rail: "settlement" | "reserve";
}>;

export function wildsWalletTransferConsentStatementDigest(input: WildsWalletTransferConsentBasis) {
  return sha256ReceizBytes(new TextEncoder().encode(canonicalizeReceizV122({
    schema: "wildz.wallet.transfer-consent.v1",
    applicationId: WILDZ_RECEIZ_APPLICATION_ID,
    attempt: input.attempt,
    amountPhiMicro: input.amountPhiMicro,
    rail: input.rail
  })));
}
