export type LineageUtilityInput = { rootAssetId: string; rootDigest: string; previousAssetId: string | null; previousDigest: string | null; evolvedAt: string | null; parentAssetIds?: [string, string]; parentDigests?: [string, string] };

export function lineagePath(lineage: LineageUtilityInput): string[] {
  return [lineage.rootAssetId, ...(lineage.previousAssetId ? [lineage.previousAssetId] : [])];
}

export function lineageUtility(lineage: LineageUtilityInput): number {
  return 1 + (lineage.previousAssetId ? 1 : 0) + (lineage.parentAssetIds?.length ?? 0);
}

export function lineageSummary(lineage: LineageUtilityInput) {
  return { rootAssetId: lineage.rootAssetId, depth: lineagePath(lineage).length, parentCount: lineage.parentAssetIds?.length ?? 0, utility: lineageUtility(lineage) };
}
