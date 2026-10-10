import { canonicalPortableCardJson, sha256PortableBasis } from "../portable-card";
import { normalizeWildsWalletPublicUsername } from "../../../lib/receiz/wilds-wallet-projections";
import type { WildzContinuityDatabase } from "../../../lib/storage/wildz-indexed-db";
import type { WildsWalletConnectPhiLeg, WildsWalletConnectPhiReceipt } from "./wilds-wallet-connect-phi-port";

export type WildsWalletConnectPhiArchiveBinding = Readonly<{ ownerHandle: string; keyId: string }>;
export type WildsWalletConnectPhiArchivedEntry = Readonly<{ leg: WildsWalletConnectPhiLeg; attempt: string; phase: "submitted" }>;
export type WildsWalletConnectPhiArchiveStore = Readonly<{
  retain(binding: WildsWalletConnectPhiArchiveBinding, entry: WildsWalletConnectPhiArchivedEntry): Promise<WildsWalletConnectPhiArchivedEntry>;
  read(binding: WildsWalletConnectPhiArchiveBinding, leg: WildsWalletConnectPhiLeg): Promise<WildsWalletConnectPhiArchivedEntry | null>;
}>;
const schema = "wildz.wallet.connect-phi-archive.v1";
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const fields = (value: Record<string, unknown>, expected: readonly string[]) => Object.keys(value).length === expected.length && expected.every(key => Object.hasOwn(value, key));
const same = (left: unknown, right: unknown) => canonicalPortableCardJson(left) === canonicalPortableCardJson(right);
function fail(): never { throw Error("The exact archived native payment could not be retained and read back. Keep its active checkpoint."); }
const handle = (value: unknown): value is string => typeof value === "string" && value === `${normalizeWildsWalletPublicUsername(value)}.receiz.id`;
function closedBinding(value: WildsWalletConnectPhiArchiveBinding): WildsWalletConnectPhiArchiveBinding {
  if (!object(value) || !fields(value, ["ownerHandle", "keyId"]) || !handle(value.ownerHandle) || typeof value.keyId !== "string" || !/^[a-f0-9]{64}$/.test(value.keyId)) fail();
  return Object.freeze({ ownerHandle: value.ownerHandle, keyId: value.keyId });
}
function closedLeg(value: WildsWalletConnectPhiLeg): WildsWalletConnectPhiLeg {
  if (!object(value) || !fields(value, ["attemptId", "senderHandle", "recipientHandle", "amountPhiMicro"])
    || typeof value.attemptId !== "string" || !value.attemptId || value.attemptId.length > 512
    || !handle(value.senderHandle) || !handle(value.recipientHandle) || value.senderHandle === value.recipientHandle
    || typeof value.amountPhiMicro !== "string" || !/^[1-9][0-9]{0,29}$/.test(value.amountPhiMicro)) fail();
  return Object.freeze({ attemptId: value.attemptId, senderHandle: value.senderHandle, recipientHandle: value.recipientHandle, amountPhiMicro: value.amountPhiMicro });
}
function closedEntry(binding: WildsWalletConnectPhiArchiveBinding, value: WildsWalletConnectPhiArchivedEntry): WildsWalletConnectPhiArchivedEntry {
  if (!object(value) || !fields(value, ["leg", "attempt", "phase"]) || value.phase !== "submitted"
    || typeof value.attempt !== "string" || !/^v3\.[A-Za-z0-9_.-]{1,16384}$/.test(value.attempt)) fail();
  const leg = closedLeg(value.leg as WildsWalletConnectPhiLeg);
  if (leg.senderHandle !== binding.ownerHandle) fail();
  return Object.freeze({ leg, attempt: value.attempt, phase: "submitted" });
}
const coordinate = (binding: WildsWalletConnectPhiArchiveBinding, leg: WildsWalletConnectPhiLeg) => JSON.stringify([schema, binding.ownerHandle, binding.keyId, leg.attemptId]);
function envelope(binding: WildsWalletConnectPhiArchiveBinding, entry: WildsWalletConnectPhiArchivedEntry) {
  const exactBytes = canonicalPortableCardJson({ schema, binding, entry });
  return { schema, binding, entry, exactBytes, digest: sha256PortableBasis(exactBytes) };
}
function reopen(value: unknown, binding: WildsWalletConnectPhiArchiveBinding, leg: WildsWalletConnectPhiLeg) {
  if (!object(value) || !fields(value, ["schema", "binding", "entry", "exactBytes", "digest"]) || value.schema !== schema || !same(value.binding, binding)) fail();
  const entry = closedEntry(binding, value.entry as WildsWalletConnectPhiArchivedEntry);
  if (!same(entry.leg, leg) || !same(value, envelope(binding, entry))) fail();
  return entry;
}

/** Private immutable byte retention only. A real canonical read must confirm
 * this exact native attempt before the caller may evict its active checkpoint.
 * Reopening an archive never authorizes another payment or proves settlement. */
export function createWildsWalletConnectPhiArchiveStore(input: Readonly<{
  database?: WildzContinuityDatabase;
  currentBinding?(): WildsWalletConnectPhiArchiveBinding;
  qualifyCommitted(entry: WildsWalletConnectPhiArchivedEntry): Promise<Readonly<{ status: string; receipt?: unknown }>>;
}>): WildsWalletConnectPhiArchiveStore {
  const current = (binding: WildsWalletConnectPhiArchiveBinding) => {
    if (input.currentBinding && !same(closedBinding(input.currentBinding()), binding)) throw Error("The Explorer changed. Keep the original native payment checkpoint.");
  };
  const database = async () => input.database ?? (await import("../../../lib/receiz/wildz-active-identity")).defaultContinuityDatabase;
  const read = async (binding: WildsWalletConnectPhiArchiveBinding, leg: WildsWalletConnectPhiLeg) => {
    current(binding);
    const value = await (await database()).read("meta", coordinate(binding, leg)); current(binding);
    return value === null ? null : reopen(value, binding, leg);
  };
  return {
    async read(rawBinding, rawLeg) {
      const binding = closedBinding(rawBinding), leg = closedLeg(rawLeg);
      if (leg.senderHandle !== binding.ownerHandle) fail();
      return read(binding, leg);
    },
    async retain(rawBinding, rawEntry) {
      const binding = closedBinding(rawBinding), entry = closedEntry(binding, rawEntry); current(binding);
      if (typeof input.qualifyCommitted !== "function") fail();
      const qualified = await input.qualifyCommitted(entry); current(binding);
      const receipt: WildsWalletConnectPhiReceipt = { schema: "wildz.wallet.connect-transfer-receipt.v1", attempt: entry.attempt, leg: entry.leg };
      if (!object(qualified) || qualified.status !== "committed" || !same(qualified.receipt, receipt)) fail();
      const exact = envelope(binding, entry), db = await database(); current(binding);
      await db.transaction(["meta"], "readwrite", async tx => {
        const previous = await tx.get("meta", coordinate(binding, entry.leg)); current(binding);
        if (previous !== null) { reopen(previous, binding, entry.leg); if (!same(previous, exact)) fail(); }
        await tx.put("meta", exact, coordinate(binding, entry.leg));
      });
      current(binding);
      const retained = await read(binding, entry.leg);
      if (!retained || !same(retained, entry)) fail();
      return retained;
    }
  };
}
