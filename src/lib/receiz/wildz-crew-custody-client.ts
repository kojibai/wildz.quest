import type { PortableCardAsset } from "../../features/play/portable-card";
import { sameWildzPlayerCoordinate } from "./wildz-player-coordinate";
import { restoreWildzCrewCustodyMemory, type WildzCrewCustody } from "./wildz-artifact-codec";
import { defaultContinuityDatabase } from "./wildz-active-identity";

type Owner = { keyId: string; actorId: string };
type CustodyWorker = Pick<Worker, "onmessage" | "onerror" | "onmessageerror" | "postMessage" | "terminate">;

/** The worker reopens/inspects sources and retains their authenticated local head.
 * No private Seal or creature archive crosses back to the rendering thread. */
export async function reopenWildzCrewCustodyOffThread(owner: Owner, cards: readonly PortableCardAsset[],
  fallback: () => Promise<WildzCrewCustody | null>, options: {
    createWorker?: () => CustodyWorker;
    readMemory?: () => Promise<WildzCrewCustody | null>;
  } = {}) {
  if (!cards.some(card => !sameWildzPlayerCoordinate(card.manifest.ownerReceizId, owner.actorId))) return null;
  const readMemory = options.readMemory ?? (() => restoreWildzCrewCustodyMemory(defaultContinuityDatabase, owner, cards));
  const retained = await readMemory();
  if (retained) return retained;
  let worker: CustodyWorker;
  try {
    if (options.createWorker) worker = options.createWorker();
    else if (typeof Worker !== "undefined") worker = new Worker(new URL("./wildz-crew-custody.worker.ts", import.meta.url), { type: "module" });
    else return fallback();
  } catch { return fallback(); }
  const completed = await new Promise<boolean>((resolve, reject) => {
    let finished = false;
    const timer = setTimeout(() => fail(Error("wildz_crew_custody_worker_timeout")), 120_000);
    const finish = () => {
      if (finished) return false;
      finished = true; clearTimeout(timer); worker.terminate();
      worker.onmessage = null; worker.onerror = null; worker.onmessageerror = null;
      return true;
    };
    const fail = (cause: Error) => { if (finish()) reject(cause); };
    const unavailable = () => { if (finish()) resolve(false); };
    worker.onmessage = event => {
      const reply = event.data;
      if (!reply || reply.keyId !== owner.keyId || reply.actorId !== owner.actorId || typeof reply.ok !== "boolean") {
        fail(Error("wildz_crew_custody_worker_reply_invalid")); return;
      }
      if (!reply.ok) {
        if (reply.fallbackSafe === true && reply.error === "wildz_crew_custody_worker_storage_unavailable") unavailable();
        else fail(Error(reply.error ?? "wildz_crew_custody_worker_failed"));
      } else if (finish()) resolve(true);
    };
    worker.onerror = event => { event.preventDefault?.(); unavailable(); };
    worker.onmessageerror = unavailable;
    try { worker.postMessage({ keyId: owner.keyId, actorId: owner.actorId }); } catch { unavailable(); }
  });
  // A worker's success flag is not a custody token: authenticate its durable
  // local memory and match the exact current proof bytes before reissuing it.
  return completed ? readMemory() : fallback();
}
