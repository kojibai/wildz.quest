import { admitLocallySealedWildsInventory, isAdmittedWildsCard } from "./admitted-inventory";
import { admitLegacyCard, compareLivingCardHistoryHeads } from "./living-card-proof";
import { isLivingCardAsset, type LivingCardAsset } from "./living-card-types";
import type { PortableCardAsset } from "./portable-card";

// Only exact immutable admitted objects can carry work across browser turns.
// New bytes, even under the same claimed digest, have no cache authority.
const legacyMigrations = new WeakMap<PortableCardAsset, LivingCardAsset>();
type HistoryComparison = { result: "left" | "right" | "equal" } | { error: unknown };
const historyComparisons = new WeakMap<LivingCardAsset, WeakMap<LivingCardAsset, HistoryComparison>>();
let legacyMigrationExecutions = 0;
let historyComparisonExecutions = 0;

export function migrateWildsInventoryCard(source: PortableCardAsset): LivingCardAsset {
  if (isLivingCardAsset(source)) return source;
  const admitted = isAdmittedWildsCard(source);
  const cached = admitted ? legacyMigrations.get(source) : undefined;
  if (cached) return cached;
  legacyMigrationExecutions++;
  const migrated = admitLegacyCard(source, source.manifest.capturedAt);
  if (admitted) {
    admitLocallySealedWildsInventory([migrated]);
    legacyMigrations.set(source, migrated);
  }
  return migrated;
}

export function compareWildsInventoryHistoryHeads(left: LivingCardAsset, right: LivingCardAsset) {
  const admitted = isAdmittedWildsCard(left) && isAdmittedWildsCard(right);
  let comparisons = admitted ? historyComparisons.get(left) : undefined;
  const cached = comparisons?.get(right);
  if (cached) {
    if ("error" in cached) throw cached.error;
    return cached.result;
  }
  if (admitted && !comparisons) {
    comparisons = new WeakMap();
    historyComparisons.set(left, comparisons);
  }
  historyComparisonExecutions++;
  try {
    const result = compareLivingCardHistoryHeads(left, right);
    comparisons?.set(right, { result });
    return result;
  } catch (error) {
    comparisons?.set(right, { error });
    throw error;
  }
}

/** Precompute exactly the work the normal parser will consume later. Keep
 * conflicting histories in the input: the parser retains its rejection behavior.
 */
export function prepareWildsInventoryCardConvergence(source: PortableCardAsset, known?: PortableCardAsset) {
  const card = migrateWildsInventoryCard(source);
  if (!known || known === source || known.id !== source.id) return;
  const existing = migrateWildsInventoryCard(known);
  if (existing === card || !existing.manifest.history || !card.manifest.history) return;
  try { compareWildsInventoryHistoryHeads(existing, card); } catch { /* The parser consumes the cached rejection. */ }
}

export function wildsInventoryConvergenceDiagnostics() {
  return Object.freeze({ legacyMigrations: legacyMigrationExecutions, historyComparisons: historyComparisonExecutions });
}
