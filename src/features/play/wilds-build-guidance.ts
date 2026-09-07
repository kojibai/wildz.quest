export function missingBuildMaterials(required: Partial<Record<"hay" | "timber" | "stone", number>>, available: Partial<Record<"hay" | "timber" | "stone", number>>) {
  return (["hay", "timber", "stone"] as const).map(kind => ({ kind, amount: Math.max(0, (required[kind] ?? 0) - (available[kind] ?? 0)) })).filter(item => item.amount > 0).map(item => `${item.amount} ${item.kind}`).join(" + ");
}
export function gatherBuildGuidance(missing: string) { return `Gather ${missing}. Timber comes from glowing tree rings, stone from rock rings, and hay from hay patches. Stored materials must be taken out of your cache first.`; }
