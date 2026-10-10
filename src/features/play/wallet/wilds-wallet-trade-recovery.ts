import { admitWildsWalletTradeDraft, wildsWalletTradeDraftDigest, type WildsWalletTradeDraft, type WildsWalletTradeResult } from "./wilds-wallet-trade";
import { validateWildsWalletTradeMessage, type WildsWalletTradeReply } from "./wilds-wallet-trade-messaging";
import { canonicalPortableCardJson } from "../portable-card";

export type WildsWalletTradeReview = Readonly<{
  schema: "wildz.wallet.trade-review.v1";
  owner: string;
  draft: WildsWalletTradeDraft;
  labels: readonly Readonly<{ id: string; label: string; quantity: number }>[];
  status: "reviewed" | "pending" | "offered";
  result?: WildsWalletTradeResult;
  inReplyTo?: WildsWalletTradeReply;
}>;
export type WildsWalletTradeRecoveryStore = Readonly<{
  load(owner: string): unknown;
  write(owner: string, review: WildsWalletTradeReview): void;
  clear(owner: string): void;
}>;
const MAX_BYTES = 64_000;
const failure = () => Error("Save this trade review on this device before sending. Wallet recovery storage is unavailable.");

export function admitWildsWalletTradeReview(value: unknown, owner: string): WildsWalletTradeReview | null {
  if (value === null || value === undefined) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw failure();
  const review = value as WildsWalletTradeReview;
  if (JSON.stringify(value).length > MAX_BYTES || review.schema !== "wildz.wallet.trade-review.v1" || review.owner !== owner
    || !["reviewed", "pending", "offered"].includes(review.status) || !Array.isArray(review.labels) || review.labels.length > 32
    || Object.keys(value).some(key => !["schema", "owner", "draft", "labels", "status", "result", "inReplyTo"].includes(key))) throw failure();
  const draft = admitWildsWalletTradeDraft(review.draft, owner);
  const message = validateWildsWalletTradeMessage({kind: "trade-package", stage: review.inReplyTo ? "counteroffer" : "offer", draft,
    ...(review.inReplyTo ? {inReplyTo: review.inReplyTo} : {})}, owner, draft.recipientHandle);
  if (review.labels.length !== draft.offered.assets.length || review.labels.some(label => !label || typeof label.id !== "string"
    || label.id.length > 808 || typeof label.label !== "string" || !label.label || label.label.length > 200
    || !Number.isSafeInteger(label.quantity) || label.quantity < 1)) throw failure();
  if (review.result && (!review.result.message || review.result.message.length > 1000
    || !["offered", "pending", "failed"].includes(review.result.status))) throw failure();
  return Object.freeze({ ...review, draft, ...(message.inReplyTo ? {inReplyTo: message.inReplyTo} : {}), labels: Object.freeze(review.labels.map(label => Object.freeze({ ...label }))) });
}

const key = (owner: string) => `wildz:wallet:trade-review:v1:${encodeURIComponent(owner)}`;
export const wildsWalletBrowserTradeRecoveryStore: WildsWalletTradeRecoveryStore = {
  load(owner) {
    try {
      if (typeof window === "undefined") return null;
      const raw = window.localStorage.getItem(key(owner));
      if (raw === null) return null;
      if (raw.length > MAX_BYTES) throw failure();
      return admitWildsWalletTradeReview(JSON.parse(raw), owner);
    } catch { throw failure(); }
  },
  write(owner, review) {
    try {
      admitWildsWalletTradeReview(review, owner);
      const raw = JSON.stringify(review);
      window.localStorage.setItem(key(owner), raw);
      if (window.localStorage.getItem(key(owner)) !== raw) throw failure();
    } catch { throw failure(); }
  },
  clear(owner) {
    try { window.localStorage.removeItem(key(owner)); if (window.localStorage.getItem(key(owner)) !== null) throw failure(); }
    catch { throw failure(); }
  }
};

/** Persist and read back the exact agreement before invoking any transport or native action. */
export async function sendSavedWildsWalletTradeReview(input: {
  review: WildsWalletTradeReview; store: WildsWalletTradeRecoveryStore;
  propose(draft: WildsWalletTradeDraft, inReplyTo?: WildsWalletTradeReply): Promise<WildsWalletTradeResult>;
}): Promise<WildsWalletTradeReview> {
  const review = admitWildsWalletTradeReview(input.review, input.review.owner)!;
  const pending: WildsWalletTradeReview = Object.freeze({ ...review, status: "pending", result: undefined });
  input.store.write(review.owner, pending);
  const saved = admitWildsWalletTradeReview(input.store.load(review.owner), review.owner);
  if (!saved || saved.status !== "pending" || wildsWalletTradeDraftDigest(saved.draft) !== wildsWalletTradeDraftDigest(review.draft)
    || canonicalPortableCardJson(saved.inReplyTo ?? null) !== canonicalPortableCardJson(review.inReplyTo ?? null)) throw failure();
  let result: WildsWalletTradeResult;
  try { result = await input.propose(saved.draft, saved.inReplyTo); }
  catch { result = { status: "pending", message: "Checking this same offer. Reopen Trade to recover its status." }; }
  const updated: WildsWalletTradeReview = Object.freeze({ ...saved, status: result.status === "offered" ? "offered" : result.status === "failed" ? "reviewed" : "pending", result });
  try { input.store.write(review.owner, updated); }
  catch { return Object.freeze({ ...pending, result: { status: "pending" as const, message: "Recover this same offer before creating another trade." } }); }
  return updated;
}
