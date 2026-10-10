import assert from "node:assert/strict";
import test from "node:test";
import {spawnSync} from "node:child_process";
import {resolve} from "node:path";
import {qualifyWildzNativeTradeArtifact} from "../src/lib/receiz/wildz-native-trade-custody";
import type {ReceizCommittedNativeTradeV128} from "@receiz/sdk";

test("serialized or caller-created committed metadata cannot qualify an atomic candidate",async()=>{
 await assert.rejects(qualifyWildzNativeTradeArtifact({committed:{status:"committed-native-trade",committed:true} as ReceizCommittedNativeTradeV128,bytes:new Uint8Array([1]),ownerReceizId:"bob.receiz.id"}),/COMMITTED_CUSTODY_REQUIRED/);
});
test("installed SDK genuine complete historical recovery qualifies only its accepted native candidate",()=>{
 const env={...process.env};delete env.NODE_TEST_CONTEXT;
 const child=spawnSync(process.execPath,["--experimental-test-module-mocks",resolve("tests/wilds-native-trade-custody-child.mjs"),new URL("../src/lib/receiz/wildz-native-trade-custody.js",import.meta.url).href,new URL("../src/features/play/wallet/wilds-wallet-native-trade-controller.js",import.meta.url).href],{encoding:"utf8",timeout:30000,env});
 assert.equal(child.status,0,[child.stdout,child.stderr].join("\n"));assert.match(child.stdout,/Genuine installed SDK historical receipt/);
});
