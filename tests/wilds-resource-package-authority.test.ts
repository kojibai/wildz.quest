import assert from "node:assert/strict";
import {test} from "node:test";
import {NextRequest} from "next/server";
import {executeWildsWorldCommand} from "../src/lib/receiz/wilds-world-server";

test("client JSON cannot invoke private package marketplace transitions",async()=>{
  for(const type of ["resource.package.market.reserve","resource.package.market.pay","resource.package.market.list","resource.package.market.release"]){
    const request=new NextRequest("https://wildz.quest/api/wilds/world/command");
    await assert.rejects(()=>executeWildsWorldCommand(request,{command:{type,packageId:"package:one",commandId:"attempt:one"},resourcePackageMarketCoordinator:true,dependencies:{resourcePackageMarketCoordinator:true}}),/market_coordinator_required/);
  }
});
