import { checkpointWildsWorld } from "./wilds-world-state";
import { canonicalPortableCardJson } from "./portable-card";
import { findWildsWorldRecord } from "./wilds-world-record";
import { verifyWildsWorldAdmittedSource, type WildsWorldOutboxEntry } from "./wilds-world-outbox";
import { createWildsWorldIdentityPublicationDraft, publishActiveWildsWorldWithIdentityProof } from "@/lib/receiz/wilds-world-identity-publication";

/** Replication uses the persisted source verbatim, never executes the intent again. */
export async function publishWildsConstructionEntry(entry: WildsWorldOutboxEntry, sourceUrl: string, transport?: {
  read: (url: string) => Promise<unknown>;
  publish: (draft: ReturnType<typeof createWildsWorldIdentityPublicationDraft>) => Promise<unknown>;
}) {
  const projection = verifyWildsWorldAdmittedSource(entry);
  const source = entry.admittedSource!;
  const baseCheckpoint = source.checkpoint!;
  const record = { checkpoint: checkpointWildsWorld(projection), eventTail: source.events };
  const adapter = transport ?? {
    read: async (url: string) => (await import("@/lib/receiz/adapter")).createReceizCommerceAdapter().readAppStateByUrl(url),
    publish: publishActiveWildsWorldWithIdentityProof
  };
  const recovered = findWildsWorldRecord(await adapter.read(sourceUrl));
  if (recovered && canonicalPortableCardJson(recovered) === canonicalPortableCardJson(record)) return { projection, commandId: entry.command.commandId, globallyPublished: true, mode: "receiz_live" as const };
  if (recovered && recovered.checkpoint.projectionDigest !== baseCheckpoint.projectionDigest) throw new Error("wilds_construction_publication_source_conflict");
  const draft = createWildsWorldIdentityPublicationDraft({ sourceUrl, merchantReceizId: entry.actorId.endsWith(".receiz.id") ? entry.actorId : `${entry.actorId}.receiz.id`, record, expectedHead: { revision: baseCheckpoint.revision, lastEventId: baseCheckpoint.lastEventId } });
  await adapter.publish(draft);
  return { projection, commandId: entry.command.commandId, globallyPublished: true, mode: "receiz_live" as const };
}
