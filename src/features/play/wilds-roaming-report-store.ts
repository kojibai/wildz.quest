import { createWildzContinuityDatabase, type WildzContinuityDatabase } from "../../lib/storage/wildz-indexed-db";
import { sameWildzPlayerCoordinate } from "../../lib/receiz/wildz-player-coordinate";
import { canonicalPortableCardJson } from "./portable-card";
import { projectWildsRoamingBattleReport, replayWildsRoamingBattle } from "./wilds-roaming-battle";
import type { WildsRoamingEncounter } from "./wilds-roaming-encounter";

export type WildsRoamingHistoryReport = Readonly<{
  encounterId: string; assetId: string; kaiUPulse: number;
  outcome: string; events: readonly string[];
}>;

/** Device-local battle observations, never proof of capture or ownership. Both
 * crew surfaces read these same immutable rows. Native card sources stay separate. */
export function createWildsRoamingReportStore(database: WildzContinuityDatabase = createWildzContinuityDatabase()) {
  const key = (owner: string, kind: string, id: string) => JSON.stringify(["wildz.roaming-reports.v1", owner, kind, id]);
  return {
    async append(owner: string, encounter: WildsRoamingEncounter) {
      if (!encounter.session || !encounter.defenderAsset || encounter.session.outcome === "active") return;
      const defender = sameWildzPlayerCoordinate(owner, encounter.defenderId);
      if (!defender && !sameWildzPlayerCoordinate(owner, encounter.challenger.playerId)) throw new Error("roaming_report_participant_required");
      const session = replayWildsRoamingBattle(encounter.session, { challengerAsset: encounter.challengerAsset, defenderAsset: encounter.defenderAsset });
      const assetId = defender ? encounter.defenderAssetId : encounter.challengerAsset.id;
      const report: WildsRoamingHistoryReport = { encounterId: encounter.id, assetId, kaiUPulse: session.kaiUPulse,
        outcome: session.outcome, events: projectWildsRoamingBattleReport(session) };
      await database.transaction(["meta"], "readwrite", async tx => {
        const rowKey = key(owner, "report", encounter.id);
        const existing = await tx.get<WildsRoamingHistoryReport>("meta", rowKey);
        if (existing) {
          if (canonicalPortableCardJson(existing) !== canonicalPortableCardJson(report)) throw new Error("roaming_report_conflict");
          return;
        }
        const indexKey = key(owner, "asset", assetId);
        const ids = await tx.get<string[]>("meta", indexKey) ?? [];
        await tx.put("meta", report, rowKey);
        await tx.put("meta", [encounter.id, ...ids].slice(0, 256), indexKey);
      });
    },
    async history(owner: string, assetId: string, limit = 24): Promise<WildsRoamingHistoryReport[]> {
      const ids = await database.read<string[]>("meta", key(owner, "asset", assetId)) ?? [];
      const rows = await Promise.all(ids.slice(0, Math.max(1, Math.min(64, limit))).map(id => database.read<WildsRoamingHistoryReport>("meta", key(owner, "report", id))));
      return rows.filter((row): row is WildsRoamingHistoryReport => Boolean(row && row.assetId === assetId)).sort((a, b) => b.kaiUPulse - a.kaiUPulse);
    }
  };
}
