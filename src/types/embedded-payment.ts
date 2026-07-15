export type EmbeddedPaymentPurpose = "storefront_checkout" | "hosting_plan" | "custom_domain" | "exchange_trade";

export type EmbeddedPaymentSession = {
  purpose: EmbeddedPaymentPurpose;
  title: string;
  checkoutSessionId?: string;
  checkoutUrl?: string;
  clientSecret?: string;
  status?: string;
  resumeDomain?: string;
  resumePlan?: "starter" | "pro" | "scale";
  resumeProductId?: string;
  resumeReferenceId?: string;
  resumeExchangeAssetId?: string;
  resumeExchangeSide?: "buy" | "sell";
  resumeExchangeShares?: number;
};
