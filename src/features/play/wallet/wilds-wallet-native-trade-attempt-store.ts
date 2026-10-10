"use client";
import type {WildsWalletNativeTradeAttempt,WildsWalletNativeTradeAttemptStore} from "./wilds-wallet-native-trade-controller";
import {canonicalPortableCardJson} from "../portable-card";
import type {ReceizNativeTradeRecoveryV128,ReceizNativeTradeRecoveryProofV128} from "@receiz/sdk";
const MAX_BYTES=24_000_000;
const failure=()=>Error("Save this exact exchange on this device before approving. Recovery storage is unavailable.");
let connection:Promise<IDBDatabase>|null=null;
function database():Promise<IDBDatabase>{
 if(connection)return connection;
 connection=new Promise((resolve,reject)=>{if(typeof indexedDB==="undefined"){reject(failure());return;}const request=indexedDB.open("wildz-native-trade-attempts-v1",3);request.onupgradeneeded=()=>{for(const name of ["attempts","accepted-sources","accepted-proofs"])if(!request.result.objectStoreNames.contains(name))request.result.createObjectStore(name);};request.onerror=()=>reject(failure());request.onblocked=()=>reject(failure());request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();connection=null;};resolve(db);};});
 const current=connection;void current.catch(()=>{if(connection===current)connection=null;});return current;
}
const key=(owner:string,digest:string)=>[owner,digest];
/** No memory fallback, credential serialization, expiry deletion, or eviction of uncertain exchanges. */
export const wildsWalletBrowserNativeTradeAttemptStore:WildsWalletNativeTradeAttemptStore={
 async load(owner,digest){try{const db=await database();return await new Promise((resolve,reject)=>{const transaction=db.transaction("attempts","readonly");const request=transaction.objectStore("attempts").get(key(owner,digest));let result:unknown=null;request.onsuccess=()=>{result=request.result??null;};transaction.oncomplete=()=>resolve(result);transaction.onerror=()=>reject(failure());transaction.onabort=()=>reject(failure());});}catch{throw failure();}},
 async write(attempt:WildsWalletNativeTradeAttempt){try{const raw=JSON.stringify(attempt);if(raw.length>MAX_BYTES||/"(?:accessToken|refreshToken|privateKeyPkcs8B64u|keyFile|passphrase)"\s*:/.test(raw))throw failure();const db=await database();await new Promise<void>((resolve,reject)=>{const transaction=db.transaction("attempts","readwrite");transaction.objectStore("attempts").put(structuredClone(attempt),key(attempt.owner,attempt.agreementDigest));transaction.oncomplete=()=>resolve();transaction.onerror=()=>reject(failure());transaction.onabort=()=>reject(failure());});}catch{throw failure();}}
};
/** Retained history is location/custody data only. The SDK must recover its complete receipt before reuse. */
export async function readWildsWalletNativeAcceptedSource(owner:string,artifactSha256:string):Promise<ReceizNativeTradeRecoveryV128|null>{
 const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction("accepted-sources","readonly"),request=tx.objectStore("accepted-sources").get(key(owner,artifactSha256));let value:ReceizNativeTradeRecoveryV128|null=null;request.onsuccess=()=>{value=request.result??null;};tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(failure());tx.onabort=()=>reject(failure());});
}
export async function retainWildsWalletNativeAcceptedSources(owner:string,recovery:ReceizNativeTradeRecoveryV128):Promise<void>{
 const raw=JSON.stringify(recovery);if(raw.length>MAX_BYTES||/"(?:accessToken|refreshToken|privateKeyPkcs8B64u|keyFile|passphrase)"\s*:/.test(raw))throw failure();
 const db=await database();await new Promise<void>((resolve,reject)=>{const tx=db.transaction("accepted-sources","readwrite");for(const sha of recovery.receipt.candidateArtifactSha256s)tx.objectStore("accepted-sources").put(structuredClone(recovery),key(owner,sha));tx.oncomplete=()=>resolve();tx.onerror=()=>reject(failure());tx.onabort=()=>reject(failure());});
 for(const sha of recovery.receipt.candidateArtifactSha256s)if(canonicalPortableCardJson(await readWildsWalletNativeAcceptedSource(owner,sha))!==canonicalPortableCardJson(recovery))throw failure();
}

/** Read-only retained evidence. The SDK must independently verify every root acceptance and ancestor. */
export async function readWildsWalletNativeAcceptedProof(owner:string,artifactSha256:string):Promise<ReceizNativeTradeRecoveryProofV128|null>{
 const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction("accepted-proofs","readonly"),request=tx.objectStore("accepted-proofs").get(key(owner,artifactSha256));let value:ReceizNativeTradeRecoveryProofV128|null=null;request.onsuccess=()=>{value=request.result??null;};tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(failure());tx.onabort=()=>reject(failure());});
}
/** Persist complete SDK-issued historical evidence before projecting received custody. */
export async function retainWildsWalletNativeAcceptedProof(owner:string,proof:ReceizNativeTradeRecoveryProofV128):Promise<void>{
 const raw=JSON.stringify(proof);if(raw.length>MAX_BYTES||proof.schema!=="receiz.native-trade-recovery-proof.v128"||/"(?:accessToken|refreshToken|privateKeyPkcs8B64u|keyFile|passphrase)"\s*:/.test(raw))throw failure();
 const db=await database();await new Promise<void>((resolve,reject)=>{const tx=db.transaction("accepted-proofs","readwrite");for(const sha of proof.recovery.receipt.candidateArtifactSha256s)tx.objectStore("accepted-proofs").put(structuredClone(proof),key(owner,sha));tx.oncomplete=()=>resolve();tx.onerror=()=>reject(failure());tx.onabort=()=>reject(failure());});
 for(const sha of proof.recovery.receipt.candidateArtifactSha256s)if(canonicalPortableCardJson(await readWildsWalletNativeAcceptedProof(owner,sha))!==canonicalPortableCardJson(proof))throw failure();
}
