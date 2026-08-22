import { parseWildzPlayerCoordinate } from "./wildz-player-coordinate";

const MAX_MICRO_PHI_DIGITS = 30;
const MAX_CURSOR_LENGTH = 256;
const MAX_LEDGER_ENTRIES = 50;
const MAX_RECEIPT_REFERENCE_LENGTH = 128;
const MAX_PROFILE_MARK_LENGTH = 12;

export type WalletSummaryProjection = Readonly<{
  status: "verified";
  admittedPhiMicro: string;
  displayUsdCents: string | null;
  transferableResourceCount: number;
  transferableCardCount: number;
  reservedCardCount: number;
  pendingCount: number;
}>;

export type WalletLedgerEntryProjection = Readonly<{
  receiptReference: string;
  direction: "sent" | "received" | "unknown";
  state: "committed" | "pending" | "rejected" | "recovered" | "reversed";
  counterpartyUsername?: string;
  amountPhiMicro?: string;
  createdAt: string;
  kaiPulse?: number;
}>;

export type WalletLedgerPageProjection = Readonly<{
  cursor: string | null;
  nextCursor: string | null;
  entries: readonly WalletLedgerEntryProjection[];
}>;

export type WalletRecipientProjection = Readonly<{
  username: string;
  profileMark: string | null;
  allowedTransferKinds: readonly ("phi" | "resource" | "card")[];
}>;

export type WalletCapabilityProjection = Readonly<{
  read: "available";
  receive: "available";
  send: Readonly<{ available: false; reason: "receiz_v123_execution_unavailable" }>;
  resourceTransfer: Readonly<{ available: false; reason: "receiz_v123_execution_unavailable" }>;
  cardTransfer: Readonly<{ available: false; reason: "receiz_v123_execution_unavailable" }>;
  phiSettlement: Readonly<{ available: false; reason: "receiz_v123_execution_unavailable" }>;
  phiReserve: Readonly<{ available: false; reason: "receiz_v123_execution_unavailable" }>;
}>;

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function boundedCount(value: unknown, code: string) {
  if (value === undefined) return 0;
  if (!Number.isInteger(value) || typeof value !== "number" || value < 0 || value > 10_000) {
    throw new Error(code);
  }
  return value;
}

function stringField(record: Record<string, unknown>, keys: readonly string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function normalizeReceiptReference(value: unknown) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) {
    throw new Error("wilds_wallet_ledger_invalid");
  }
  return value;
}

function normalizeCreatedAt(value: unknown) {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw new Error("wilds_wallet_ledger_invalid");
  }
  return value;
}

function normalizePulse(value: unknown) {
  if (value === undefined) return undefined;
  if (!Number.isSafeInteger(value) || typeof value !== "number" || value < 0) {
    throw new Error("wilds_wallet_ledger_invalid");
  }
  return value;
}

function usernameFromPublicActor(value: unknown) {
  const record = asRecord(value);
  const username = stringField(record, ["username", "handle", "preferred_username"]);
  if (!username) return null;
  try {
    return normalizeWildsWalletPublicUsername(username);
  } catch {
    return null;
  }
}

function stateForLedgerKind(value: unknown): WalletLedgerEntryProjection["state"] {
  const kind = typeof value === "string" ? value.toLowerCase() : "";
  if (kind.includes("pending")) return "pending";
  if (kind.includes("reject")) return "rejected";
  if (kind.includes("recover")) return "recovered";
  if (kind.includes("revers")) return "reversed";
  return "committed";
}

export function parseWildsWalletMicroPhi(value: unknown) {
  if (typeof value !== "string" || !/^[0-9]{1,30}$/.test(value)) {
    throw new Error("wilds_wallet_micro_phi_invalid");
  }
  return BigInt(value).toString();
}

export function normalizeWildsWalletPublicUsername(value: unknown) {
  if (typeof value !== "string") throw new Error("wilds_wallet_username_invalid");
  const coordinate = parseWildzPlayerCoordinate(value);
  if (!coordinate) throw new Error("wilds_wallet_username_invalid");
  return coordinate.actorId;
}

export function normalizeWildsWalletCursor(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || value.length > MAX_CURSOR_LENGTH || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error("wilds_wallet_cursor_invalid");
  }
  return value;
}

export function projectWildsWalletSummary(value: unknown): WalletSummaryProjection {
  const summary = asRecord(value);
  if (summary.ok !== true) throw new Error("wilds_wallet_summary_invalid");
  const balancePhiMicro = parseWildsWalletMicroPhi(summary.balancePhiMicro);
  const displayUsdCents = summary.balanceUsdCents === undefined || summary.balanceUsdCents === null
    ? null
    : parseWildsWalletMicroPhi(summary.balanceUsdCents);
  return Object.freeze({
    status: "verified" as const,
    admittedPhiMicro: balancePhiMicro,
    displayUsdCents,
    transferableResourceCount: boundedCount(summary.transferableResourceCount, "wilds_wallet_summary_invalid"),
    transferableCardCount: boundedCount(summary.transferableCardCount, "wilds_wallet_summary_invalid"),
    reservedCardCount: boundedCount(summary.reservedCardCount, "wilds_wallet_summary_invalid"),
    pendingCount: boundedCount(summary.pendingCount, "wilds_wallet_summary_invalid")
  });
}

export function projectWildsWalletLedgerPage(value: unknown, ownerUsername: unknown): WalletLedgerPageProjection {
  const feed = asRecord(value);
  if (feed.ok !== true || !Array.isArray(feed.events) || feed.events.length > MAX_LEDGER_ENTRIES) {
    throw new Error("wilds_wallet_ledger_invalid");
  }
  const owner = normalizeWildsWalletPublicUsername(ownerUsername);
  const entries = feed.events.map((event) => {
    const source = asRecord(event);
    const from = usernameFromPublicActor(source.fromActor);
    const to = usernameFromPublicActor(source.toActor);
    const direction = from === owner ? "sent" : to === owner ? "received" : "unknown";
    const counterparty = direction === "sent" ? to : direction === "received" ? from : null;
    const amountPhiMicro = source.amountPhiMicro === undefined ? undefined : parseWildsWalletMicroPhi(source.amountPhiMicro);
    const kaiPulse = normalizePulse(source.pulse);
    return Object.freeze({
      receiptReference: normalizeReceiptReference(source.id),
      direction,
      state: stateForLedgerKind(source.kind),
      ...(counterparty ? { counterpartyUsername: counterparty } : {}),
      ...(amountPhiMicro === undefined ? {} : { amountPhiMicro }),
      createdAt: normalizeCreatedAt(source.createdAt),
      ...(kaiPulse === undefined ? {} : { kaiPulse })
    });
  });
  return Object.freeze({
    cursor: normalizeWildsWalletCursor(feed.cursor),
    nextCursor: normalizeWildsWalletCursor(feed.nextCursor),
    entries: Object.freeze(entries)
  });
}

export function projectWildsWalletRecipient(value: unknown): WalletRecipientProjection {
  const recipient = asRecord(value);
  const username = normalizeWildsWalletPublicUsername(recipient.username ?? recipient.handle);
  const profileMark = typeof recipient.profileMark === "string"
    && recipient.profileMark.length <= MAX_PROFILE_MARK_LENGTH
    && /^[A-Za-z0-9 ._-]+$/.test(recipient.profileMark)
    ? recipient.profileMark
    : null;
  const allowed = Array.isArray(recipient.allowedTransferKinds) ? recipient.allowedTransferKinds : [];
  const allowedTransferKinds = ["phi", "resource", "card"].filter((kind) => allowed.includes(kind)) as Array<"phi" | "resource" | "card">;
  return Object.freeze({ username, profileMark, allowedTransferKinds: Object.freeze(allowedTransferKinds) });
}

export function projectWildsWalletCapabilities(): WalletCapabilityProjection {
  const unavailable = Object.freeze({ available: false as const, reason: "receiz_v123_execution_unavailable" as const });
  return Object.freeze({
    read: "available" as const,
    receive: "available" as const,
    send: unavailable,
    resourceTransfer: unavailable,
    cardTransfer: unavailable,
    phiSettlement: unavailable,
    phiReserve: unavailable
  });
}
