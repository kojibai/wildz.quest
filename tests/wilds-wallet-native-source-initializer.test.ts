import assert from "node:assert/strict";
import test from "node:test";
import {createWildsWalletNativeSourceInitializer} from "../src/features/play/wallet/wilds-wallet-native-source-initializer";

test("wallet opening and explicit gift approval share one source initialization, with no new reads after readiness",async()=>{
 let calls=0,complete!:()=>void;
 const initialize=createWildsWalletNativeSourceInitializer(async()=>{calls++;await new Promise<void>(resolve=>{complete=resolve;});});
 const opening=initialize("held-key"),gift=initialize("held-key");
 assert.equal(opening,gift);await Promise.resolve();assert.equal(calls,1);
 complete();await opening;await initialize("held-key");assert.equal(calls,1);
});
test("failed initialization remains retryable and readiness never carries into another signing key",async()=>{
 const calls:string[]=[];let fail=true;
 const initialize=createWildsWalletNativeSourceInitializer(async keyId=>{calls.push(keyId);if(fail){fail=false;throw Error("source network unavailable");}});
 await assert.rejects(initialize("alice-key"),/network/);await initialize("alice-key");await initialize("alice-key");
 await initialize("bob-key");await initialize("bob-key");await initialize("alice-key");
 assert.deepEqual(calls,["alice-key","alice-key","bob-key","alice-key"]);
});
