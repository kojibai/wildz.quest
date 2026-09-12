import test from "node:test";
import assert from "node:assert/strict";
import { projectWildsDiscoveryStory } from "../src/features/play/wilds-discovery-story";
import { wildsDiscoverySitesForRegion } from "../src/features/play/wilds-discovery-sites";
test("discovery route guidance never advertises unsupported abilities", () => {
  const site = wildsDiscoverySitesForRegion(2,2)[0]!;
  const gated = {...site,routes:[{id:"deep",safe:true,requirements:["swim" as const,"pressure" as const],rewardTier:2 as const,points:[]}]};
  assert.equal(projectWildsDiscoveryStory(gated,["swim"],false).routeId,undefined);
  assert.equal(projectWildsDiscoveryStory(gated,["swim","pressure"],false).routeId,"deep");
});
test("entrance discoveries do not claim route completion or grant rewards", () => {
  const story = projectWildsDiscoveryStory(wildsDiscoverySitesForRegion(2,2)[0]!,[],true);
  assert.equal(story.stage,"discovered");
  assert.match(story.progressLabel,/explore the habitat next/);
  assert.equal("reward" in story,false);
});
test("route guidance prefers a supported safe path over a risky one", () => {
  const site = wildsDiscoverySitesForRegion(2,2)[0]!;
  const story = projectWildsDiscoveryStory({...site,routes:[
    {id:"risky",safe:false,requirements:[],rewardTier:3,points:[]},
    {id:"safe",safe:true,requirements:[],rewardTier:0,points:[]}
  ]},[],false);
  assert.equal(story.routeId,"safe");
});
test("alternative routes show one achievable prerequisite set, not their union", () => {
  const site = wildsDiscoverySitesForRegion(2,2)[0]!;
  const story = projectWildsDiscoveryStory({...site,routes:[
    {id:"deep",safe:true,requirements:["swim","pressure"],rewardTier:2,points:[]},
    {id:"cliff",safe:false,requirements:["climb"],rewardTier:2,points:[]}
  ]},[],false);
  assert.deepEqual(story.missingRequirements,["climb"]);
  assert.match(story.routeHint,/still need: climb/);
  assert.doesNotMatch(story.routeHint,/pressure/);
});
test("equally demanding blocked routes prefer the safer prerequisite set", () => {
  const site = wildsDiscoverySitesForRegion(2,2)[0]!;
  const story = projectWildsDiscoveryStory({...site,routes:[
    {id:"cliff",safe:false,requirements:["climb"],rewardTier:2,points:[]},
    {id:"deep",safe:true,requirements:["swim","pressure"],rewardTier:2,points:[]}
  ]},["swim"],false);
  assert.deepEqual(story.missingRequirements,["pressure"]);
});
test("an ordinary route does not imply a water or sky entrance can be reached on foot", () => {
  const site = wildsDiscoverySitesForRegion(2,2)[0]!;
  const ordinary = [{id:"ordinary",safe:true,requirements:[],rewardTier:0 as const,points:[]}];
  for (const layer of ["water","air"] as const) {
    const target = {...site,entrance:{...site.entrance,layer},routes:ordinary};
    const story = projectWildsDiscoveryStory(target,[],false);
    assert.equal(story.ready,false);
    assert.equal(story.actionLabel,"Locate entrance for later");
    assert.match(story.routeHint,/at the entrance/);
    assert.equal(projectWildsDiscoveryStory(target,[layer === "water" ? "swim" : "flight"],false).ready,true);
  }
});
