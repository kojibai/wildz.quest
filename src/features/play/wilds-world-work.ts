import {
  prepareWildsWorldOutboxEntry,
  enqueueWildsWorldCommand,
  readWildsWorldOutbox,
  acknowledgeWildsWorldCommand,
  restoreWildsWorldEdgeSource,
  type WildsWorldOutboxEntry
} from "./wilds-world-outbox";
import type { WildsWorldProjection } from "./wilds-world-state";

export type WildsWorldWork =
  | { kind: "prepare"; base: WildsWorldProjection; entry: WildsWorldOutboxEntry }
  | { kind: "persist"; entry: WildsWorldOutboxEntry }
  | { kind: "read"; actorId: string }
  | { kind: "acknowledge"; actorId: string; commandId: string }
  | { kind: "restore"; base: WildsWorldProjection; actorId: string };

export async function performWildsWorldWork(work: WildsWorldWork) {
  switch (work.kind) {
    case "prepare": return prepareWildsWorldOutboxEntry(work.base, work.entry);
    case "persist": await enqueueWildsWorldCommand(work.entry); return undefined;
    case "read": return readWildsWorldOutbox(work.actorId);
    case "acknowledge": return acknowledgeWildsWorldCommand(work.actorId, work.commandId);
    case "restore": return restoreWildsWorldEdgeSource(work.base, work.actorId);
  }
}
