import type { ReceizWorldValueIntentV122 } from "@receiz/sdk";

export type WildsWalletTransferJournalEntry = Readonly<{
  schema: "wildz.wallet.phi-transfer-journal.v1";
  ownerBinding: string;
  applicationId: string;
  idempotencyKey: string;
  rail: "settlement" | "reserve";
  intent: ReceizWorldValueIntentV122;
  authorityDigest: string | null;
}>;

/**
 * Server-only durable storage boundary. Implementations must be cross-instance,
 * encrypted at rest, and owner-scoped. There is intentionally no process-local
 * or browser fallback.
 */
export interface WildsWalletTransferJournalPort {
  readonly durable: true;
  load(ownerBinding: string, idempotencyKey: string): Promise<WildsWalletTransferJournalEntry | null>;
  /** Atomically inserts when absent and otherwise returns the existing exact winner. */
  stage(entry: WildsWalletTransferJournalEntry): Promise<WildsWalletTransferJournalEntry>;
  /** Atomically binds once; a different existing digest must never be overwritten. */
  bindAuthority(
    ownerBinding: string,
    idempotencyKey: string,
    authorityDigest: string
  ): Promise<WildsWalletTransferJournalEntry | null>;
  /** Atomically removes only when the entire supplied entry is still current. */
  remove(entry: WildsWalletTransferJournalEntry): Promise<boolean>;
}

export function requireWildsWalletTransferJournal(
  journal: WildsWalletTransferJournalPort | undefined
): WildsWalletTransferJournalPort {
  if (!journal || journal.durable !== true) {
    throw new Error("wilds_wallet_durable_journal_required");
  }
  return journal;
}
