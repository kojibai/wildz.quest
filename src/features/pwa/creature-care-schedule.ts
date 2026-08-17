import { projectCreatureCare } from "@/features/play/creature-care";
import type { PortableCardAsset } from "@/features/play/portable-card";

export const WILDZ_CARE_PERIODIC_TAG = "wildz-creature-care" as const;

export type CreatureCareNotificationEntry = Readonly<{
  id: string;
  assetId: string;
  name: string;
  notifyAt: string;
  level: "needs-care" | "urgent" | "sick" | "dead";
  body: string;
}>;

const HOUR_MS = 3_600_000;
const MAX_LOOKAHEAD_HOURS = 168;
const NOTIFYING_STATUSES = new Set<CreatureCareNotificationEntry["level"]>(["needs-care", "urgent", "sick", "dead"]);

function bodyFor(name: string, level: CreatureCareNotificationEntry["level"]) {
  if (level === "needs-care") return `${name} is getting hungry and wants attention. Play, earn trail beans, and care for them.`;
  if (level === "urgent") return `${name} urgently needs food or attention. Return to Wildz before their wellness declines.`;
  if (level === "sick") return `${name} has become sick and needs restorative care now.`;
  return `${name}'s active care mandate has reached its final threshold.`;
}

export function creatureCareNotificationSchedule(
  assets: readonly PortableCardAsset[],
  at: string
): readonly CreatureCareNotificationEntry[] {
  const start = Date.parse(at);
  if (!Number.isFinite(start)) return [];
  const entries: CreatureCareNotificationEntry[] = [];
  for (const asset of assets) {
    let previous = projectCreatureCare(asset, at).status;
    if (previous === "resting" || previous === "dead") continue;
    for (let hour = 1; hour <= MAX_LOOKAHEAD_HOURS; hour += 1) {
      const notifyAt = new Date(start + hour * HOUR_MS).toISOString();
      const level = projectCreatureCare(asset, notifyAt).status;
      if (level !== previous && NOTIFYING_STATUSES.has(level as CreatureCareNotificationEntry["level"])) {
        const notifyingLevel = level as CreatureCareNotificationEntry["level"];
        entries.push({
          id: `${asset.id}:${notifyingLevel}:${notifyAt}`,
          assetId: asset.id,
          name: asset.manifest.name.slice(0, 80),
          notifyAt,
          level: notifyingLevel,
          body: bodyFor(asset.manifest.name.slice(0, 80), notifyingLevel)
        });
      }
      previous = level;
      if (level === "dead") break;
    }
  }
  return entries.sort((left, right) => left.notifyAt.localeCompare(right.notifyAt)).slice(0, 128);
}
