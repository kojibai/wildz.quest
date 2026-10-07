import { WildsWorldService } from "../../features/play/wilds-world-service";
import { canonicalPortableCardJson } from "../../features/play/portable-card";
import type { WildsWorldRepository, WildsWorldRepositoryActor } from "./wilds-world-repository";

/** A candidate is private until the conditional source rail admits its exact
 * record. A CAS loser installs the verified winner, never its own failed head. */
export async function commitWildsConditionalWorldCandidate(input: {
  repository: WildsWorldRepository;
  sourceUrl: string;
  actor: WildsWorldRepositoryActor;
  before: WildsWorldService;
  candidate: WildsWorldService;
  install(world: WildsWorldService): void;
}) {
  const before = input.before.checkpoint();
  const record = { checkpoint: input.candidate.checkpoint(), eventTail: input.candidate.events() };
  const publication = await input.repository.publish({ sourceUrl: input.sourceUrl, actor: input.actor, record, expectedHead: { revision: before.revision, lastEventId: before.lastEventId }, requireConditional: true });
  if (publication.sourceAdmission !== "conditional") {
    return { world: input.before, publication: { ...publication, published: false, mode: "receiz_recovery_pending" as const, record: undefined } };
  }
  if (publication.published && (!publication.record || canonicalPortableCardJson(publication.record) !== canonicalPortableCardJson(record))) {
    throw Error("wilds_resource_custody_successor_invalid");
  }
  if (publication.record) {
    const world = new WildsWorldService({ checkpoint: publication.record.checkpoint, events: publication.record.eventTail });
    input.install(world);
    return { world, publication };
  }
  return { world: input.before, publication };
}
