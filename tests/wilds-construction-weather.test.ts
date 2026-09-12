import { prepareWildsWorldOutboxEntry, verifyWildsWorldAdmittedSource, preserveWildsConstructionHistory } from "../src/features/play/wilds-world-outbox";
import test from "node:test";
import assert from "node:assert/strict";
import { fixture, lot } from "./fixtures/wilds-maintenance";
import { projectWildsConstructionWeather, WILDS_WEATHER_WINDOW as WINDOW } from "../src/features/play/wilds-construction-weather";
import { WildsWorldService } from "../src/features/play/wilds-world-service";
import { checkpointWildsWorld, replayWildsWorld } from "../src/features/play/wilds-world-state";
import { resolveWildsConstructionFunction } from "../src/features/play/wilds-construction-function";
import { kaiUPulseToISOString } from "../src/features/play/kai-klok-moment";
const authority = (kai: number, actorId = "owner") => ({ actorId, canonical: true, uPulse: kai, pulse: kaiUPulseToISOString(kai), occurredAt: kaiUPulseToISOString(kai) });
function damaged() {
  const {world, component} = fixture("bed",100);
  world.materialLots[lot(501,"timber").lotId] = lot(501,"timber");
  const checkpoint = checkpointWildsWorld(world);
  const service = new WildsWorldService({checkpoint});
  let kai = 0;
  for (let step = 1; step <= 100; step++) {
    kai = step * 24 * WINDOW;
    const prior = service.snapshot().constructionConditions?.[component.componentId];
    service.execute({type:"construction.component.maintain",componentId:component.componentId,componentHead:component.head,conditionHead:prior?.head ?? null,actorPosition:component.transform.position,commandId:`inspect:${step}`},authority(kai));
    if ((service.snapshot().constructionConditions?.[component.componentId]?.integrity ?? 100) < 50) break;
  }
  return {service,component,kai,checkpoint};
}
test("weather is deterministic, bounded after an absence and does not mutate plans",()=>{
  const {world,component}=fixture("bed",100);
  const kai = 10_000 * WINDOW;
  const a=projectWildsConstructionWeather(world,component.componentId,kai)!;
  assert.deepEqual(a,projectWildsConstructionWeather(structuredClone(world),component.componentId,kai));
  assert.ok(a.integrity>=25 && a.integrity<=100);
  const updated={...world,constructionConditions:{[component.componentId]:a}};
  assert.equal(projectWildsConstructionWeather(updated,component.componentId,kai),null);
  assert.throws(()=>projectWildsConstructionWeather(updated,component.componentId,kai-1));
  const planned={...world,constructionWorkContributions:{}};
  assert.equal(projectWildsConstructionWeather(planned,component.componentId,kai)?.integrity,100);
});
test("storm wear, repair, exact material consumption, retries and checkpoint restoration work end to end",()=>{
  const {service,component,kai,checkpoint}=damaged();
  const worn=service.snapshot().constructionConditions![component.componentId];
  assert.ok(worn.integrity<50);
  assert.equal(resolveWildsConstructionFunction(service.snapshot(),component.componentId,"bed"),null);
  const command={type:"construction.component.maintain" as const,componentId:component.componentId,componentHead:component.head,conditionHead:worn.head,actorPosition:component.transform.position,lotId:lot(501,"timber").lotId,commandId:"repair:one"};
  const repaired=service.execute(command,authority(kai+1));
  assert.equal(repaired.events.length,1);
  assert.equal(repaired.projection.constructionConditions![component.componentId].integrity,worn.integrity+25);
  assert.equal(repaired.projection.constructionConditions![component.componentId].parentHead,worn.head);
  assert.ok(repaired.projection.consumedMaterialLots[command.lotId].startsWith("repair:"));
  assert.equal(service.execute(command,authority(kai+2)).events.length,0);
  assert.deepEqual(new WildsWorldService({checkpoint:service.checkpoint()}).snapshot(),service.snapshot());
  assert.deepEqual(replayWildsWorld(service.events(),checkpoint),service.snapshot());
  const before=service.checkpoint();
  assert.throws(()=>service.execute({...command,commandId:"repair:stale"},authority(kai+3)));
  assert.deepEqual(service.checkpoint(),before);
  assert.throws(()=>service.execute({...command,commandId:"repair:foreign",conditionHead:service.snapshot().constructionConditions![component.componentId].head},authority(kai+3,"intruder")));
  assert.deepEqual(service.checkpoint(),before);
});
test("maintenance refuses distant players and unavailable repair lots without writes",()=>{
  const {service,component,kai}=damaged();
  const command={type:"construction.component.maintain" as const,componentId:component.componentId,componentHead:component.head,conditionHead:service.snapshot().constructionConditions![component.componentId].head,actorPosition:{x:100,z:100},commandId:"repair:far",lotId:"missing"};
  const before=service.checkpoint();
  assert.throws(()=>service.execute(command,authority(kai+1)),/unreachable/);
  assert.throws(()=>service.execute({...command,actorPosition:component.transform.position},authority(kai+1)),/lot_unavailable/);
  assert.deepEqual(service.checkpoint(),before);
});

test("a functional roof reduces wear below it, while a plan does not", () => {
  const bed = fixture("bed",100), roof = fixture("roof",100,1000);
  const covered = { ...bed.world,
    constructionComponents: {...bed.world.constructionComponents,...roof.world.constructionComponents},
    constructionMaterialContributions: {...bed.world.constructionMaterialContributions,...roof.world.constructionMaterialContributions},
    constructionWorkContributions: {...bed.world.constructionWorkContributions,...roof.world.constructionWorkContributions} };
  let observed = false;
  for(let step=1;step<40;step++) {
    const kai=step*24*WINDOW;
    const exposed=projectWildsConstructionWeather(bed.world,bed.component.componentId,kai)!;
    if(exposed.integrity===100)continue;
    const sheltered=projectWildsConstructionWeather(covered,bed.component.componentId,kai)!;
    assert.ok(sheltered.integrity>exposed.integrity);
    const planned={...covered,constructionWorkContributions:bed.world.constructionWorkContributions};
    assert.equal(projectWildsConstructionWeather(planned,bed.component.componentId,kai)!.integrity,exposed.integrity);
    observed=true;break;
  }
  assert.ok(observed);
});
test("the existing world tick admits weather and stale remote snapshots cannot erase condition", () => {
  const {service,component,kai}=damaged();
  const before=service.snapshot();
  const nextKai=kai+24*WINDOW;
  const result=service.tick({pulse:kaiUPulseToISOString(nextKai),occurredAt:kaiUPulseToISOString(nextKai),uPulse:nextKai,systemActorId:"receiz:pulse"});
  assert.ok(result.events.some(event=>event.kind==="construction.weathered"));
  assert.ok(result.projection.constructionConditions![component.componentId].priorHeads.includes(before.constructionConditions![component.componentId].head));
  assert.equal(preserveWildsConstructionHistory(before,result.projection),result.projection);
  assert.equal(preserveWildsConstructionHistory(result.projection,{...result.projection,constructionConditions:{}}),result.projection);
  const checkpoint=service.checkpoint();
  assert.throws(()=>service.tick({pulse:kaiUPulseToISOString(nextKai),occurredAt:kaiUPulseToISOString(nextKai),uPulse:nextKai,systemActorId:"intruder" as "receiz:pulse"}));
  assert.deepEqual(service.checkpoint(),checkpoint);
});

test("maintenance uses the existing immediate outbox admission and repeat inspections append nothing", () => {
  const { service, component, kai } = damaged();
  const base = service.snapshot();
  const command = { type: "construction.component.maintain" as const, componentId: component.componentId, componentHead: component.head,
    conditionHead: base.constructionConditions![component.componentId].head, actorPosition: component.transform.position,
    lotId: lot(501,"timber").lotId, commandId: "repair:outbox" };
  const entry = { schema: "receiz.wilds_world_outbox_entry.v1" as const, actorId: "owner", guestId: "fixture", command, queuedAt: kaiUPulseToISOString(kai+1_000_000) };
  const prepared = prepareWildsWorldOutboxEntry(base, entry);
  assert.equal(prepared.events.length, 1);
  assert.equal(prepared.events[0].kind, "construction.component_maintained");
  assert.deepEqual(verifyWildsWorldAdmittedSource(prepared.entry, base), prepared.projection);
  const restored = new WildsWorldService({checkpoint:checkpointWildsWorld(prepared.projection)});
  const repeat = restored.execute({ ...command, lotId: undefined, conditionHead: prepared.projection.constructionConditions![component.componentId].head, commandId: "inspect:unchanged" }, authority(kai+2_000_000));
  assert.equal(repeat.events.length, 0);
  assert.deepEqual(restored.snapshot(), prepared.projection);
});
