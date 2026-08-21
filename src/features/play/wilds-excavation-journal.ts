import { createWildzContinuityDatabase, type WildzContinuityDatabase } from "@/lib/storage/wildz-indexed-db";
import type { WildsExcavationAdmissionJournal, WildsExcavationPendingAdmission } from "./wilds-excavation";

const PREFIX = "receiz:wildz-excavation-pending:v1:";

function journalKey(ownerSubjectId: string, worldId: string, idempotencyKey: string) {
  return `${PREFIX}${ownerSubjectId}:${worldId}:${idempotencyKey}`;
}

function validPending(value: unknown, worldId: string, idempotencyKey: string): value is WildsExcavationPendingAdmission {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<WildsExcavationPendingAdmission>;
  return candidate.schema === "wildz.excavation.pending_admission.v1"
    && candidate.preview?.worldId === worldId
    && candidate.preview.idempotencyKey === idempotencyKey
    && candidate.commandPlans?.length === 2
    && candidate.commandPlans.every((plan) => plan.schema === "receiz.world.command_plan.v1")
    && candidate.transaction?.schema === "receiz.world.transaction.v1"
    && candidate.transaction.commands?.length === 2
    && candidate.transaction.commands.every((command, index) => command.commandId === candidate.commandPlans![index]!.command.commandId);
}

export function createPersistentWildsExcavationJournal(
  ownerSubjectId: string,
  database: WildzContinuityDatabase = createWildzContinuityDatabase()
): WildsExcavationAdmissionJournal {
  if (!ownerSubjectId) throw new Error("wilds_excavation_journal_owner_required");
  return {
    async read(worldId, idempotencyKey) {
      const value = await database.read<unknown>("meta", journalKey(ownerSubjectId, worldId, idempotencyKey));
      return validPending(value, worldId, idempotencyKey) ? value : null;
    },
    async stage(entry) {
      await database.transaction(["meta"], "readwrite", async (transaction) => {
        await transaction.put("meta", entry, journalKey(ownerSubjectId, entry.preview.worldId, entry.preview.idempotencyKey));
      });
    },
    async remove(worldId, idempotencyKey) {
      await database.transaction(["meta"], "readwrite", async (transaction) => {
        await transaction.delete("meta", journalKey(ownerSubjectId, worldId, idempotencyKey));
      });
    }
  };
}
