import assert from "node:assert/strict";
import { test } from "node:test";
import * as components from "../src/features/play/wilds-construction-component";
import { createWildsConstructionProject } from "../src/features/play/wilds-construction-project";
import { createWildsBlueprintPreview, previewWildsBlueprintPlacement } from "../src/features/play/wilds-world-construction";

function fixture() {
  const project = createWildsConstructionProject({ ownerReceizId: "owner", name: "Home", region: {x:0,z:0}, commandId:"home", kaiUPulse:1 });
  const evidence = { sourceBlueprint:createWildsBlueprintPreview(project.projectId,"wildz.excavation.region.v1:0:0"), pointer:{x:2,y:0,z:2}, rotationQuarterTurns:0, heightStep:0, physical:{terrainY:0,waterline:null,anchors:[],solids:[]} };
  const placement = previewWildsBlueprintPlacement({...evidence,blueprint:evidence.sourceBlueprint,kind:"foundation"});
  const component = components.createWildsConstructionComponent({project,placement,evidence,ownerReceizId:"owner",commandId:"place",kaiUPulse:2});
  return {component,evidence};
}
test("adjustments preserve identity and append an exact predecessor-bound revision", () => {
  const adjust = (components as Record<string, unknown>).adjustWildsConstructionComponent as ((input: Record<string,unknown>) => components.WildsConstructionComponentV1);
  assert.equal(typeof adjust,"function");
  const {component,evidence}=fixture();
  const nextEvidence={...evidence,pointer:{x:4,y:0,z:2},rotationQuarterTurns:1};
  const placement=previewWildsBlueprintPlacement({...nextEvidence,blueprint:nextEvidence.sourceBlueprint,kind:component.kind});
  const next=adjust({component,placement,evidence:nextEvidence,commandId:"adjust",kaiUPulse:3});
  assert.equal(next.componentId,component.componentId);
  assert.equal(next.parentHead,component.head);
  assert.equal(next.revision,1);
  assert.equal(next.transform.position.x,4);
  assert.equal(component.transform.position.x,2);
  assert.ok(components.verifyWildsConstructionComponent(next));
  assert.throws(()=>adjust({component,placement,evidence:nextEvidence,commandId:"bad-time",kaiUPulse:1}));
  assert.equal(components.verifyWildsConstructionComponent({...next,transform:component.transform}),false);
});
