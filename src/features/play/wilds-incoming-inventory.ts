import { isAdmittedWildsCard, verifyAndAdmitWildsCard } from "./admitted-inventory";
import { canonicalPortableCardJson, type PortableCardAsset } from "./portable-card";
import { wildzGameplayBackground } from "../../lib/performance/wildz-gameplay-background";
import { prepareWildsInventoryCardConvergence } from "./wilds-inventory-convergence";
import { isLivingCardAsset } from "./living-card-types";
import { verifyCreatureHistoryCooperatively } from "./creature-history";

/** Keep source admission responsive. A claimed ID/digest never admits bytes:
 * reuse requires identical full content of an immutable already-verified card.
 * Leave this array unregistered so the normal parser still migrates legacy
 * cards, resolves competing history heads and restores discovered families.
 */
export async function prepareWildsIncomingInventory(
  incoming: readonly PortableCardAsset[],
  known: readonly PortableCardAsset[] = [],
  environment: { now?: () => number; yield?: () => Promise<void> } = {}
): Promise<PortableCardAsset[]> {
  const source = Array.isArray(incoming) ? Array.from(incoming) : [];
  const knownById = new Map(known.filter(isAdmittedWildsCard).map(card => [card.id, card]));
  const now = environment.now ?? (() => performance.now());
  const yieldToBrowser = environment.yield ?? (() => wildzGameplayBackground.run(() => undefined));
  const prepared: PortableCardAsset[] = [];
  let index = 0;
  while (index < source.length) {
    await yieldToBrowser();
    const started = now();
    do {
      const card = source[index++]!;
      try {
        if (!card) continue;
        const existing = knownById.get(card.id);
        let admitted = isAdmittedWildsCard(card) ? card
          : existing && canonicalPortableCardJson(card) === canonicalPortableCardJson(existing) ? existing : null;
        if (!admitted) {
          if (isLivingCardAsset(card) && card.manifest.history && card.manifest.history.events.length > 64) {
            const history = await verifyCreatureHistoryCooperatively(card.manifest.history, { now, yield: yieldToBrowser });
            if (!history.ok) continue;
          }
          admitted = verifyAndAdmitWildsCard(card) ? card : null;
        }
        if (!admitted) continue;
        try { prepareWildsInventoryCardConvergence(admitted, existing); } catch {
          // Proof verification and migration are separate boundaries. Retain a
          // verified source even if migration fails so the parser still recovers.
        }
        prepared.push(admitted);
        if (!existing) knownById.set(admitted.id, admitted);
      } catch {
        // Malformed external data supplies no card authority.
      }
    } while (index < source.length && now() - started < 4);
  }
  return prepared;
}
