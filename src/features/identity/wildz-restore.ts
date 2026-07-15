export type WildzRestoreCandidate =
  | {
      kind: "identity-seal";
      keyId: string;
      username: string | null;
      displayName: string | null;
      portableStateVerified: boolean;
    }
  | { kind: "vault"; cardCount: number; vaultDigest: string };

export function restoreSummary(candidate: WildzRestoreCandidate) {
  if (candidate.kind === "identity-seal") {
    return {
      kind: candidate.kind,
      keyId: candidate.keyId,
      username: candidate.username,
      displayName: candidate.displayName,
      portableStateVerified: candidate.portableStateVerified,
      authorityRestored: true,
      requiresOwnershipReconciliation: false,
      cardCount: 0
    } as const;
  }

  return {
    kind: candidate.kind,
    vaultDigest: candidate.vaultDigest,
    authorityRestored: false,
    requiresOwnershipReconciliation: true,
    cardCount: candidate.cardCount
  } as const;
}
