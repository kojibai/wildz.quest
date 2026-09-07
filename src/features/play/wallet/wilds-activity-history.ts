import type { ConstitutionalDecision } from "../wilds-constitution";
import { deriveKaiKlokMoment, deriveKaiKlokMomentFromUPulse } from "../kai-klok-moment";

export type WildsActivityEntry = Readonly<{
  id: string;
  kind: "activity";
  title: string;
  detail: string;
  uPulse: number;
  authority: "local" | "world";
  constitution?: ConstitutionalDecision;
}>;

export function normalizeWildsActivityHistory(value: unknown): WildsActivityEntry[] {
  if (!Array.isArray(value)) return [];
  const entries = value.filter((entry): entry is WildsActivityEntry => Boolean(entry)
    && typeof entry.id === "string" && entry.kind === "activity" && typeof entry.title === "string"
    && typeof entry.detail === "string" && Number.isSafeInteger(entry.uPulse)
    && (entry.authority === "local" || entry.authority === "world"));
  return [...new Map(entries.map((entry) => [entry.id, {
    ...entry,
    constitution: entry.constitution?.schema === "wildz.constitutional-decision.v1" && Array.isArray(entry.constitution.rulesApplied) ? entry.constitution : undefined
  }])).values()];
}

export function appendWildsActivity(history: readonly WildsActivityEntry[] | undefined, entry: WildsActivityEntry): WildsActivityEntry[] {
  return normalizeWildsActivityHistory([...(history ?? []), entry]);
}

/** Missing historical coordinates stay unknown; never substitute the current clock. */
export function ledgerKaiTime(input: { uPulse?: number; occurredAt?: string }): { timing: string; uPulse: number | null } {
  try {
    const moment = input.uPulse !== undefined
      ? deriveKaiKlokMomentFromUPulse({ uPulse: input.uPulse, authority: "admitted" })
      : deriveKaiKlokMoment({ occurredAt: input.occurredAt ?? "", authority: "admitted" });
    return { timing: `Kai Klok ${moment.latticeCoordinate}`, uPulse: moment.uPulse };
  } catch {
    return { timing: "Kai Klok unavailable · source has no valid time", uPulse: null };
  }
}
