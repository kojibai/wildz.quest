import test from "node:test";
import assert from "node:assert/strict";
import { projectWildsHomeLife } from "../src/features/play/wilds-home-life";
const shelter = { structureId: "home", blueprint: "trail-shelter", position: {x:0,z:0} };
test("home activities require actual nearby owned structures", () => {
  assert.equal(projectWildsHomeLife({structures:[],companions:[],now:0}), null);
  const home = projectWildsHomeLife({ structures: [shelter, { structureId:"bench",blueprint:"steward-workbench",position:{x:100,z:0} },{structureId:"cache",blueprint:"trail-cache",position:{x:1,z:1}}],companions:[],now:0 });
  assert.deepEqual(home?.activities.map(a=>a.action), ["rest","storage"]);
  assert.equal(home?.companion, undefined);
});
test("daily companion suggestions rotate deterministically through owned companions", () => {
  const input = {structures:[shelter], companions:[{id:"b",name:"B"},{id:"a",name:"A"},{id:"active",name:"Active"}],activeCompanionId:"active",now:0};
  assert.equal(projectWildsHomeLife(input)?.companion?.id,"a");
  assert.equal(projectWildsHomeLife({...input,now:86_400_000})?.companion?.id,"b");
  assert.deepEqual(projectWildsHomeLife(input),projectWildsHomeLife({...input,companions:[...input.companions].reverse()}));
  assert.equal(projectWildsHomeLife({...input,companions:[]})?.activities.some(a=>a.action==="invite"),false);
});
test("home activities follow the selected shelter rather than a distant home", () => {
  const home = projectWildsHomeLife({ structures: [shelter, { ...shelter, structureId:"second",position:{x:100,z:0} },{structureId:"bench",blueprint:"steward-workbench",position:{x:101,z:0}}],companions:[],now:0,preferredHomeId:"second" });
  assert.deepEqual(home?.activities.map(a=>a.action),["rest","craft"]);
  assert.equal(home?.activities[0]?.structureId,"second");
});
