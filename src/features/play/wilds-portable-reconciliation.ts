import { canonicalPortableCardJson, sha256PortableBasis } from "./portable-card";

export type PortableReconciliationRecord = { eventId: string; sequence: number; kind: string; payload: unknown; digest: string };

export function appendPortableRecord(records: readonly PortableReconciliationRecord[], record: PortableReconciliationRecord) {
  const existing = records.find((candidate) => candidate.eventId === record.eventId);
  if (existing) {
    if (existing.digest !== record.digest) throw new Error("reconciliation_conflict");
    return [...records];
  }
  if (!record.eventId || !Number.isSafeInteger(record.sequence) || record.sequence < 0) throw new Error("reconciliation_record_invalid");
  return [...records, record].sort((a, b) => a.sequence - b.sequence || a.eventId.localeCompare(b.eventId));
}

export function reconcilePortableRecords(local: readonly PortableReconciliationRecord[], incoming: readonly PortableReconciliationRecord[]) {
  return incoming.reduce((merged, record) => appendPortableRecord(merged, record), [...local]);
}

export function portableRecordDigest(input: Omit<PortableReconciliationRecord, "digest">) {
  return sha256PortableBasis(canonicalPortableCardJson(input));
}
