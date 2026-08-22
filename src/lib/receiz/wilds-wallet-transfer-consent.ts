import { canonicalizeReceizV122, sha256ReceizBytes } from "@receiz/sdk";

export type WildsWalletTransferConsentBasis = Readonly<{
  attempt: string;
  amountPhiMicro: string;
  rail: "settlement" | "reserve";
}>;

export function wildsWalletTransferConsentStatementDigest(input: WildsWalletTransferConsentBasis) {
  return sha256ReceizBytes(new TextEncoder().encode(canonicalizeReceizV122({
    schema: "wildz.wallet.transfer-consent.v1",
    applicationId: "wildz.quest",
    attempt: input.attempt,
    amountPhiMicro: input.amountPhiMicro,
    rail: input.rail
  })));
}
