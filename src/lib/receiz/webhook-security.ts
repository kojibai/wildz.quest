import type { CommerceEventRecord } from "./proof-state";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function webhookTimestampIsFresh(value: string, now = Date.now()) {
  const numeric = Number(value);
  const timestamp = Number.isFinite(numeric)
    ? numeric < 10_000_000_000 ? numeric * 1000 : numeric
    : Date.parse(value);
  return Number.isFinite(timestamp) && timestamp <= now + 30_000 && timestamp >= now - 5 * 60_000;
}

export function explicitWebhookEventId(value: unknown) {
  if (!isRecord(value)) return "";
  const data = isRecord(value.data) ? value.data : {};
  for (const record of [data, value]) {
    for (const key of ["id", "eventId", "event_id", "paymentId", "payment_id", "transferId", "transfer_id", "checkoutSessionId", "checkout_session_id", "receiptId", "receipt_id"]) {
      const candidate = record[key];
      if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    }
  }
  return "";
}

export function commerceWebhookAuthorityIsComplete(event: CommerceEventRecord, explicitEventId: string) {
  if (!explicitEventId || event.id !== explicitEventId || !event.tenantHost.trim() || !event.merchantReceizId.trim()) return false;
  if (event.type === "checkout.settled" || event.type === "payment.refunded") {
    const amount = Number(String(event.data.totalLabel ?? "").replace(/[^0-9.]/g, ""));
    return Boolean(event.data.receiptId && Number.isFinite(amount) && amount > 0);
  }
  return true;
}
