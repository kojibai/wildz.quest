import { receizBase64UrlEncode, verifyReceizIdentityPublicKeyProjectionSignature, type ReceizIdentityKeyAlgorithm, type ReceizIdentityLoginProof } from "@receiz/sdk";
import { canonicalPortableCardJson } from "../portable-card";
import type { WildsWalletResourceProjectionRowV128 } from "./wilds-wallet-resource-projection-v128";
export type ResourceIndexScope = Readonly<{keyId: string; ownerHandle: string}>;
export type SignedRow = Readonly<{row: WildsWalletResourceProjectionRowV128; publicKey: Readonly<{keyId: string; alg: ReceizIdentityKeyAlgorithm; publicKeyRawB64u: string}>; signature: ReceizIdentityLoginProof}>;
export type ResourceIndex = Readonly<{schema: "wildz.wallet.resource-projection-index.v128"; entries: readonly SignedRow[]}>;
const sha = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
export const resourceIndexChallenge = (row: WildsWalletResourceProjectionRowV128) => `WILDZ-RESOURCE-PRESENTATION-CACHE-V128\n${canonicalPortableCardJson(row)}`;
const challenge = resourceIndexChallenge;
export function boundedResourceIndexValue(value: unknown, max: number) { if (new TextEncoder().encode(canonicalPortableCardJson(value)).length > max) throw Error("The resource projection exceeds its local storage limit."); }
export async function admitWalletResourceEntry(entry: SignedRow, input: ResourceIndexScope): Promise<boolean> {
    try {
      const row = entry.row;
      boundedResourceIndexValue(entry, 100_000);
      if (!row || row.schema !== "wildz.wallet.resource-projection.v128" || row.keyId !== input.keyId || row.ownerHandle !== input.ownerHandle
        || !sha(input.keyId) || !/^[a-z0-9_]{3,30}\.receiz\.id$/.test(input.ownerHandle)
        || !/^wildz:package:[a-f0-9]{64}$/.test(row.packageId) || !/^sha256:[a-f0-9]{64}$/.test(row.packageHead)
        || !["reserved", "received", "unpacked", "sent"].includes(row.kind) || !Array.isArray(row.memberRefs) || !row.memberRefs.length || row.memberRefs.length > 64
        || !Array.isArray(row.availableMemberIds) || row.availableMemberIds.some(id => !row.memberRefs.some(m => m.id === id))
        || new Set(row.memberRefs.map(m => m.id)).size !== row.memberRefs.length || new Set(row.availableMemberIds).size !== row.availableMemberIds.length
        || ![row.sourceArtifactSha256, row.sourcePayloadSha256, row.proofDigest, row.detailDigest, row.currentHead].every(sha)
        || entry.publicKey.keyId !== input.keyId || entry.signature.keyId !== input.keyId || entry.signature.alg !== entry.publicKey.alg
        || entry.signature.challengeB64Url !== receizBase64UrlEncode(new TextEncoder().encode(challenge(row)))) return false;
      return verifyReceizIdentityPublicKeyProjectionSignature({ keyId: input.keyId, alg: entry.publicKey.alg, publicKeyRawB64u: entry.publicKey.publicKeyRawB64u, challengeB64Url: entry.signature.challengeB64Url, signatureB64Url: entry.signature.signatureB64Url });
    } catch { return false; }
  }

/** Exact canonical byte limit, counted per entry so fallback never prepares the
 * entire index in one task. JSON key order does not affect its UTF-8 size. */
export async function validateWalletResourceIndex(index: ResourceIndex, input: ResourceIndexScope, yieldTask?: () => Promise<void>): Promise<number[]> {
  if (!index || index.schema !== "wildz.wallet.resource-projection-index.v128" || !Array.isArray(index.entries) || index.entries.length > 256) throw Error("The saved resource cache is invalid. Reopen its exact source.");
  let bytes = new TextEncoder().encode(canonicalPortableCardJson({...index, entries: []})).length;
  const positions: number[] = [];
  for (let i = 0; i < index.entries.length; i++) {
    if (yieldTask) await yieldTask();
    const entry = index.entries[i]!;
    bytes += new TextEncoder().encode(canonicalPortableCardJson([entry])).length - 2 + (i ? 1 : 0);
    if (bytes > 4_000_000) throw Error("The resource projection exceeds its local storage limit.");
    if (await admitWalletResourceEntry(entry, input)) positions.push(i);
  }
  if (bytes > 4_000_000) throw Error("The resource projection exceeds its local storage limit.");
  return positions;
}
