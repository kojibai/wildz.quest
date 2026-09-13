import { canonicalPortableCardJson, verifyAnyWildsCard, type PortableCardAsset } from "../../features/play/portable-card";
import { admitLegacyCard, isLivingCardHistoryDescendant, compareLivingCardHistoryHeads } from "../../features/play/living-card-proof";
import { isLivingCardAsset, type LivingCardAsset } from "../../features/play/living-card-types";
import type { CreatureHistoryAuthorityVerifier } from "../../features/play/creature-history-types";

function livingOriginBasis(asset: LivingCardAsset) {
  const {
    evolvedAt: _evolvedAt,
    childAssetIds: _childAssetIds,
    ...lineageOrigin
  } = asset.manifest.lineage;
  return canonicalPortableCardJson({
    schema: asset.manifest.schema,
    catalogVersion: asset.manifest.catalogVersion,
    assetId: asset.manifest.assetId,
    familyId: asset.manifest.familyId,
    ownerReceizId: asset.manifest.ownerReceizId,
    encounterId: asset.manifest.encounterId,
    capturedAt: asset.manifest.capturedAt,
    variant: asset.manifest.variant,
    lineage: lineageOrigin,
    birth: asset.manifest.birth,
    birthGenome: asset.manifest.birthGenome
  });
}

export function sameLivingOrigin(ancestor: LivingCardAsset, descendant: LivingCardAsset) {
  return livingOriginBasis(ancestor) === livingOriginBasis(descendant)
    && ancestor.manifest.lineage.childAssetIds.every(
      (assetId) => descendant.manifest.lineage.childAssetIds.includes(assetId)
    );
}


export function isVerifiedWildzCardDescendant(ancestor: PortableCardAsset, descendant: PortableCardAsset, historyAuthorityVerifier?: CreatureHistoryAuthorityVerifier) {
    if (!verifyAnyWildsCard(ancestor).ok || !verifyAnyWildsCard(descendant).ok) return false;
    if (ancestor.id !== descendant.id || !isLivingCardAsset(descendant)) return false;
    if (!isLivingCardAsset(ancestor)) {
      if (descendant.manifest.birth.kind !== "legacy_admission"
        || descendant.manifest.birth.legacyDigest !== ancestor.proof.digest) return false;
      const admitted = admitLegacyCard(ancestor, descendant.proof.sealedAt);
      if (!sameLivingOrigin(admitted, descendant)
        || !admitted.manifest.revisions.every(
          (revision, index) => descendant.manifest.revisions[index]?.digest === revision.digest
        )) return false;
      if (admitted.manifest.history && descendant.manifest.history
        && isLivingCardHistoryDescendant(admitted, descendant)) {
        try {
          return compareLivingCardHistoryHeads(admitted, descendant, historyAuthorityVerifier) === "right";
        } catch {
          return false;
        }
      }
      return true;
    }
    if (!sameLivingOrigin(ancestor, descendant)) return false;
    if (ancestor.manifest.history && descendant.manifest.history
      && isLivingCardHistoryDescendant(ancestor, descendant)) {
      try {
        return compareLivingCardHistoryHeads(ancestor, descendant, historyAuthorityVerifier) === "right";
      } catch {
        return false;
      }
    }
    return descendant.manifest.revisions.length > ancestor.manifest.revisions.length
      && ancestor.manifest.revisions.every(
        (revision, index) => descendant.manifest.revisions[index]?.digest === revision.digest
      );
  }
