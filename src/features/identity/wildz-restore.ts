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

export function friendlyWildzRestoreError(cause: unknown) {
  const code = cause instanceof Error ? cause.message : "wildz_restore_invalid";
  if (code === "receiz_key_identity_record_missing") {
    return "This image is identity artwork, not account authority. Download your owner-only Identity Record or Receiz Key from Receiz and choose that file.";
  }
  if (code === "receiz_key_file_too_large") return "This Receiz identity artifact is too large.";
  if (code === "receiz_key_invalid") return "This file is not a valid Receiz Identity Record or Receiz Key.";
  return code;
}
