import { canonicalPortableCardJson, sha256PortableBasis } from "../portable-card";
import type { WildsWalletStagedTradeBinding } from "./wilds-wallet-staged-trade-types";
import { admitWildsWalletStagedTradeRecovery, type WildsWalletStagedTradeRecoveryEntry } from "./wilds-wallet-staged-trade-recovery";
import { defaultContinuityDatabase } from "../../../lib/receiz/wildz-active-identity";

export type WildsWalletStagedTradeArchiveStore = Readonly<{
 read(binding:WildsWalletStagedTradeBinding,tradeId:string):Promise<WildsWalletStagedTradeRecoveryEntry|null>;
 retain(binding:WildsWalletStagedTradeBinding,entry:WildsWalletStagedTradeRecoveryEntry):Promise<void>;
}>;
const same=(a:unknown,b:unknown)=>canonicalPortableCardJson(a)===canonicalPortableCardJson(b);
const key=(binding:WildsWalletStagedTradeBinding,tradeId:string)=>JSON.stringify(["wildz:staged-trade:archive:v1",binding.ownerHandle,binding.keyId,binding.identityArtifactDigest,tradeId]);
function closed(binding:WildsWalletStagedTradeBinding,entry:WildsWalletStagedTradeRecoveryEntry){
 const admitted=admitWildsWalletStagedTradeRecovery({schema:"wildz.wallet.staged-trade-recovery.v1",binding,trades:[entry]},binding).trades[0]!;
 if(admitted.approvals.length!==2||admitted.legs.some(leg=>!["accepted","committed"].includes(leg.status)||leg.projectionPending))throw Error("Only a fully verified terminal trade can be archived.");
 return admitted;
}
/** Private byte retention, never proof authority. The controller independently
 * re-verifies every native approval and receipt before archive or restoration. */
export const wildsWalletBrowserStagedTradeArchiveStore:WildsWalletStagedTradeArchiveStore={
 async retain(binding,entry){
  const admitted=closed(binding,entry),coordinate=key(binding,entry.plan.tradeId),digest=sha256PortableBasis(canonicalPortableCardJson(admitted));
  const value={schema:"wildz.staged-trade-archive.v1",binding,entry:admitted,digest};
  await defaultContinuityDatabase.transaction(["meta"],"readwrite",async tx=>{
   const previous=await tx.get("meta",coordinate);if(previous&&!same(previous,value))throw Error("The immutable archived native trade changed.");
   await tx.put("meta",value,coordinate);
  });
  const recovered=await defaultContinuityDatabase.read("meta",coordinate);if(!same(recovered,value))throw Error("The completed native trade could not be archived and read back.");
 },
 async read(binding,tradeId){
  const value=await defaultContinuityDatabase.read<{schema:string;binding:WildsWalletStagedTradeBinding;entry:WildsWalletStagedTradeRecoveryEntry;digest:string}>("meta",key(binding,tradeId));
  if(!value)return null;
  if(value.schema!=="wildz.staged-trade-archive.v1"||!same(value.binding,binding)||value.entry.plan.tradeId!==tradeId||value.digest!==sha256PortableBasis(canonicalPortableCardJson(value.entry)))throw Error("The archived native trade bytes changed.");
  return closed(binding,value.entry);
 }
};
