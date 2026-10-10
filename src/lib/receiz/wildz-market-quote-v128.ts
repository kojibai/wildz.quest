import { quoteReceizDisplayUsdV122 } from "@receiz/sdk";
import { canonicalPortableCardJson, sha256PortableBasis } from "../../features/play/portable-card";
import { parseWildzPlayerCoordinate } from "./wildz-player-coordinate";

export type WildzMarketConnectQuoteV128 = Readonly<{
  schema: "wildz.market.connect-quote.v128"; ownerHandle: string; priceUsdCents: string;
  amountPhiMicro: string; usdPerPhiMicrocents: string; basisDigest: string; issuedAtKai: number; expiresAtKai: number;
}>;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const positive = (value: unknown): value is string => typeof value === "string" && /^[1-9][0-9]{0,29}$/.test(value);
const unsigned = (value: unknown): value is string => typeof value === "string" && /^(?:0|[1-9][0-9]{0,29})$/.test(value);
const decimalCents = (value: unknown) => {
  if (typeof value !== "string" || !/^(?:0|[1-9][0-9]{0,29})(?:\.[0-9]{1,2})?$/.test(value)) throw Error("The actual Connect wallet USD display is unavailable.");
  const [whole, fraction = ""] = value.split("."); return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
};

/** Matches the released Connect host's effective-rate and half-up integer law.
 * Wallet JSON is a pricing read, never a new funded native value origin. */
export function deriveWildzMarketConnectQuoteV128(response: unknown, input: Readonly<{ ownerUserId: string; ownerHandle: string; priceUsdCents: string; currentKai: number }>): WildzMarketConnectQuoteV128 {
  if (!object(response) || response.ok !== true || !object(response.wallet) || response.wallet.userId !== input.ownerUserId || !positive(input.priceUsdCents)
    || parseWildzPlayerCoordinate(input.ownerHandle)?.profileHandle !== input.ownerHandle || !Number.isSafeInteger(input.currentKai) || input.currentKai < 0) throw Error("The actual buyer wallet quote is required.");
  const wallet = response.wallet;
  if (!unsigned(wallet.balancePhiMicro) || !object(wallet.quote) || !positive(wallet.quote.usdPerPhiMicrocents)) throw Error("The actual Connect wallet quote is unavailable.");
  const balancePhiMicro = BigInt(wallet.balancePhiMicro), balanceUsdCents = decimalCents(wallet.balanceUsd);
  const fallbackRate = BigInt(wallet.quote.usdPerPhiMicrocents);
  const derived = balancePhiMicro > 0n && balanceUsdCents > 0n ? (balanceUsdCents * 1_000_000_000_000n + balancePhiMicro / 2n) / balancePhiMicro : fallbackRate;
  const rate = derived > 0n ? derived : fallbackRate;
  const amount = (BigInt(input.priceUsdCents) * 1_000_000_000_000n + rate / 2n) / rate;
  if (amount <= 0n || amount.toString().length > 30 || quoteReceizDisplayUsdV122(amount.toString(), rate.toString()) !== input.priceUsdCents) throw Error("The USD price cannot be quoted exactly in Phi micro-units.");
  const basisDigest = sha256PortableBasis(canonicalPortableCardJson({ ownerUserId: input.ownerUserId, balancePhiMicro: wallet.balancePhiMicro, balanceUsdCents: balanceUsdCents.toString(), fallbackRate: fallbackRate.toString(), effectiveRate: rate.toString() })).replace(/^sha256:/, "");
  return Object.freeze({ schema: "wildz.market.connect-quote.v128", ownerHandle: input.ownerHandle, priceUsdCents: input.priceUsdCents, amountPhiMicro: amount.toString(), usdPerPhiMicrocents: rate.toString(), basisDigest, issuedAtKai: input.currentKai, expiresAtKai: input.currentKai + 120 });
}

export function admitWildzMarketConnectQuoteV128(value: unknown): WildzMarketConnectQuoteV128 {
  if (!object(value) || Object.keys(value).sort().join(",") !== "amountPhiMicro,basisDigest,expiresAtKai,issuedAtKai,ownerHandle,priceUsdCents,schema,usdPerPhiMicrocents" || value.schema !== "wildz.market.connect-quote.v128"
    || parseWildzPlayerCoordinate(String(value.ownerHandle))?.profileHandle !== value.ownerHandle || !positive(value.priceUsdCents) || !positive(value.amountPhiMicro) || !positive(value.usdPerPhiMicrocents)
    || typeof value.basisDigest !== "string" || !/^[a-f0-9]{64}$/.test(value.basisDigest) || !Number.isSafeInteger(value.issuedAtKai) || !Number.isSafeInteger(value.expiresAtKai)
    || Number(value.issuedAtKai) < 0 || Number(value.expiresAtKai) !== Number(value.issuedAtKai) + 120 || quoteReceizDisplayUsdV122(value.amountPhiMicro, value.usdPerPhiMicrocents) !== value.priceUsdCents) throw Error("The exact marketplace quote is invalid.");
  return Object.freeze(structuredClone(value)) as WildzMarketConnectQuoteV128;
}
export function sameWildzMarketConnectQuoteV128(left: WildzMarketConnectQuoteV128, right: WildzMarketConnectQuoteV128) {
  const a = admitWildzMarketConnectQuoteV128(left), b = admitWildzMarketConnectQuoteV128(right);
  return a.ownerHandle === b.ownerHandle && a.priceUsdCents === b.priceUsdCents && a.amountPhiMicro === b.amountPhiMicro && a.usdPerPhiMicrocents === b.usdPerPhiMicrocents;
}
