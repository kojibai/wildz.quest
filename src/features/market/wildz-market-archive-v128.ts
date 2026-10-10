import {canonicalPortableCardJson,sha256PortableBasis} from "../play/portable-card";
import {admitWildzMarketRecoveryV128,type WildzMarketPurchaseCheckpointV128,type WildzMarketListAttemptV128} from "./wildz-market-recovery-v128";
import {admitWildsWalletStagedTradeRecovery,type WildsWalletStagedTradeRecoveryEntry} from "../play/wallet/wilds-wallet-staged-trade-recovery";
import type {WildsWalletStagedTradeBinding} from "../play/wallet/wilds-wallet-staged-trade-types";
import type {WildzContinuityDatabase} from "../../lib/storage/wildz-indexed-db";

export type WildzMarketArchivedPurchaseV128=Readonly<{checkpoint:WildzMarketPurchaseCheckpointV128;binding:WildsWalletStagedTradeBinding;entry:WildsWalletStagedTradeRecoveryEntry}>;
export type WildzMarketArchiveStoreV128=Readonly<{
 retainPurchase(owner:Readonly<{ownerHandle:string;keyId:string}>,value:WildzMarketArchivedPurchaseV128):Promise<void>;
 readPurchase(owner:Readonly<{ownerHandle:string;keyId:string}>,purchaseId:string):Promise<WildzMarketArchivedPurchaseV128|null>;
 retainList(owner:Readonly<{ownerHandle:string;keyId:string}>,value:WildzMarketListAttemptV128):Promise<void>;
}>;
const same=(a:unknown,b:unknown)=>canonicalPortableCardJson(a)===canonicalPortableCardJson(b);
const schema="wildz.market.private-archive.v128";
/** Retains exact private bytes only. The controller must independently verify
 * every native approval/receipt before retention and again before reuse. */
export function createWildzMarketArchiveStoreV128(database?:WildzContinuityDatabase):WildzMarketArchiveStoreV128{
 const db=async()=>database??(await import("../../lib/receiz/wildz-active-identity")).defaultContinuityDatabase;
 const coordinate=(owner:Readonly<{ownerHandle:string;keyId:string}>,kind:string,id:string)=>JSON.stringify([schema,owner.ownerHandle,owner.keyId,kind,id]);
 const retain=async(owner:Readonly<{ownerHandle:string;keyId:string}>,kind:string,id:string,value:unknown)=>{
  const key=coordinate(owner,kind,id),bytes=canonicalPortableCardJson(value),envelope={schema,owner,kind,id,value,digest:sha256PortableBasis(bytes)};
  const database=await db();await database.transaction(["meta"],"readwrite",async tx=>{const prior=await tx.get("meta",key);if(prior&&!same(prior,envelope))throw Error("Immutable private market history changed.");await tx.put("meta",envelope,key);});
  if(!same(await database.read("meta",key),envelope))throw Error("The completed market history could not be archived and read back.");
 };
 const closed=(owner:Readonly<{ownerHandle:string;keyId:string}>,value:WildzMarketArchivedPurchaseV128)=>{
  const checkpoint=admitWildzMarketRecoveryV128({schema:"wildz.market-recovery.v128",...owner,lists:[],purchases:[value.checkpoint]},owner.ownerHandle,owner.keyId).purchases[0]!;
  if(value.binding.ownerHandle!==owner.ownerHandle||value.binding.keyId!==owner.keyId)throw Error("The archived market identity changed.");
  const entry=admitWildsWalletStagedTradeRecovery({schema:"wildz.wallet.staged-trade-recovery.v1",binding:value.binding,trades:[value.entry]},value.binding).trades[0]!;
  if(!same(entry.plan.agreement,checkpoint.agreement)||entry.approvals.length!==2||entry.legs.some(leg=>!["committed","accepted"].includes(leg.status)||leg.projectionPending)||checkpoint.assetRecoveryRequired)throw Error("Keep the incomplete market continuation in its active queue.");
  return {checkpoint,binding:value.binding,entry};
 };
 return {
  async retainPurchase(owner,value){const admitted=closed(owner,value);await retain(owner,"purchase",admitted.checkpoint.agreement.market!.purchaseId,admitted);},
  async readPurchase(owner,id){
   const raw=await(await db()).read<{schema:string;owner:typeof owner;kind:string;id:string;value:WildzMarketArchivedPurchaseV128;digest:string}>("meta",coordinate(owner,"purchase",id));
   if(!raw)return null;
   if(raw.schema!==schema||raw.kind!=="purchase"||raw.id!==id||!same(raw.owner,owner)||raw.digest!==sha256PortableBasis(canonicalPortableCardJson(raw.value)))throw Error("The archived market bytes changed.");
   const value=closed(owner,raw.value);if(value.checkpoint.agreement.market!.purchaseId!==id)throw Error("This archived purchase belongs to another attempt.");return value;
  },
  async retainList(owner,value){const admitted=admitWildzMarketRecoveryV128({schema:"wildz.market-recovery.v128",...owner,lists:[value],purchases:[]},owner.ownerHandle,owner.keyId).lists[0]!;if(!admitted.published)throw Error("Keep the uncertain listing continuation.");await retain(owner,"listing",value.attemptId,admitted);}
 };
}
