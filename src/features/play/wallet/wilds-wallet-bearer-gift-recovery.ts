import type { ReceizPortableSealedArtifactV124 } from "@receiz/sdk";
import { defaultContinuityDatabase } from "../../../lib/receiz/wildz-active-identity";
import type { WildzContinuityDatabase } from "../../../lib/storage/wildz-indexed-db";
import { canonicalPortableCardJson } from "../portable-card";
import { admitWildsWalletBearerOriginal } from "./wilds-wallet-bearer-gift-proof";
import type { WildsWalletBearerGiftLeg } from "./wilds-wallet-bearer-gift-proof";
import type { WildsWalletStagedTradeNativeSourceHead } from "./wilds-wallet-staged-trade-types";

export type WildsWalletBearerGiftCheckpoint = Readonly<{
  schema: "wildz.wallet.bearer-gift-attempt.v128";
  ownerHandle: string; keyId: string; leg: WildsWalletBearerGiftLeg;
  descriptor: WildsWalletStagedTradeNativeSourceHead;
  state: "prepared" | "submitted" | "delivered" | "accepted";
  successorArtifactSha256: string | null;
  projected: boolean;
}>;
export type WildsWalletBearerGiftSource = Readonly<{ original: ReceizPortableSealedArtifactV124; originProof: unknown; projectionOriginal: ReceizPortableSealedArtifactV124 }>;
export type WildsWalletBearerGiftRecoveryStore = Readonly<{
  readAttempt(owner: string, keyId: string, legId: string): Promise<WildsWalletBearerGiftCheckpoint | null>;
  saveAttempt(checkpoint: WildsWalletBearerGiftCheckpoint): Promise<void>;
  readSource(owner: string, keyId: string, sha: string, projectionSha: string): Promise<WildsWalletBearerGiftSource | null>;
  retainSource(owner: string, keyId: string, source: WildsWalletBearerGiftSource): Promise<void>;
}>;
const same = (a: unknown, b: unknown) => canonicalPortableCardJson(a) === canonicalPortableCardJson(b);
const coordinate = (kind: string, owner: string, keyId: string, id: string) => JSON.stringify(["wildz.wallet.bearer-gift.v128", kind, owner, keyId, id]);
const safeClone = <T>(value: T): T => {
  const encoded = canonicalPortableCardJson(value);
  if (new TextEncoder().encode(encoded).length > 2_000_000) throw Error("The durable native gift checkpoint is too large.");
  return JSON.parse(encoded) as T;
};

/** Exact bytes are stored separately from thin trade receipts. A successful
 * write AND readback are mandatory before delivery/claim. Quota/read failures
 * close the operation; no memory fallback, pending eviction, or trusted flag. */
export function createWildsWalletBearerGiftRecoveryStore(database: WildzContinuityDatabase = defaultContinuityDatabase): WildsWalletBearerGiftRecoveryStore {
  return {
    readAttempt: (owner, keyId, legId) => database.read("meta", coordinate("attempt", owner, keyId, legId)),
    async saveAttempt(checkpoint) {
      const value = safeClone(checkpoint), key = coordinate("attempt", value.ownerHandle, value.keyId, value.leg.legId);
      await database.transaction(["meta"], "readwrite", tx => tx.put("meta", value, key));
      const saved = await database.read("meta", key);
      if (!same(saved, value)) throw Error("The exact native gift checkpoint could not be saved. No claim was started.");
    },
    readSource: (owner, keyId, sha, projectionSha) => database.read("artifacts", coordinate("source", owner, keyId, `${sha}:${projectionSha}`)),
    async retainSource(owner, keyId, source) {
      const value = safeClone({ original: admitWildsWalletBearerOriginal(source.original), originProof: source.originProof, projectionOriginal: admitWildsWalletBearerOriginal(source.projectionOriginal) });
      const key = coordinate("source", owner, keyId, `${value.original.artifactSha256}:${value.projectionOriginal.artifactSha256}`);
      const previous = await database.read("artifacts", key);
      if (previous && !same(previous, value)) throw Error("An exact native gift Original already exists with different provenance.");
      await database.transaction(["artifacts"], "readwrite", tx => tx.put("artifacts", value, key));
      if (!same(await database.read("artifacts", key), value)) throw Error("The exact native gift Original could not be saved.");
    },
  };
}
