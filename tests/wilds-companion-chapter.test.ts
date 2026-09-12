import assert from "node:assert/strict";
import { test } from "node:test";
import { projectWildsCompanionChapter } from "../src/features/play/wilds-companion-chapter.js";
import { rememberWildsJourney, type WildsJourneyInput } from "../src/features/play/wilds-journey.js";
const event = (kind: WildsJourneyInput["kind"], companionId = "fern") => ({ kind, companionId, subjectId: kind, label: "Untrusted imported text", position: { x: 10, z: 20 } });
const base = { companion: { id: "fern", name: "Fern" }, memories: rememberWildsJourney([], event("met"), 1), position: { x: 10, z: 20 }, inOuterWorld: true, capabilities: ["flight"] };
test("revisiting a first meeting shows actual recorded place without interpreting labels", () => {
  const chapter = projectWildsCompanionChapter(base)!;
  assert.match(chapter.revisit!.text, /first met/);
  assert.match(chapter.firstMeeting!.text, /X 10 · Z 20/);
  assert.doesNotMatch(JSON.stringify(chapter), /Untrusted/);
});
test("does not invent first meetings for imported companions or use another companion's past", () => {
  const chapter = projectWildsCompanionChapter({ ...base, companion: { id: "other", name: "Other" } })!;
  assert.equal(chapter.firstMeeting, undefined);
  assert.equal(chapter.revisit, undefined);
  assert.equal(chapter.sharedPlaces, 0);
  assert.equal(projectWildsCompanionChapter({ ...base, companion: undefined }), null);
});
test("only recalls nearby places in the outer world", () => {
  assert.equal(projectWildsCompanionChapter({ ...base, position: { x: 19, z: 20 } })!.revisit, undefined);
  assert.equal(projectWildsCompanionChapter({ ...base, inOuterWorld: false })!.revisit, undefined);
  assert.ok(projectWildsCompanionChapter({ ...base, position: { x: 18, z: 20 } })!.revisit);
});
test("returning home requires a real rest memory and counts places without inflating repeated actions", () => {
  const chapter = projectWildsCompanionChapter({ ...base, memories: rememberWildsJourney(rememberWildsJourney([], event("built"), 1), event("home"), 2) })!;
  assert.match(chapter.revisit!.text, /rested together/);
  assert.equal(chapter.sharedPlaces, 1);
});
test("only suggests ability routes whose full requirements the active companion meets", () => {
  const discovery = { key: "sky", entrance: { x: 100, z: 200 }, routes: [{ safe: true, requirements: ["flight", "cold"] }] };
  assert.equal(projectWildsCompanionChapter({ ...base, discovery })!.opportunity, undefined);
  const chapter = projectWildsCompanionChapter({ ...base, discovery, capabilities: ["flight", "cold"] })!;
  assert.match(chapter.opportunity!.text, /flight \+ cold/);
  assert.deepEqual(chapter.opportunity!.position, discovery.entrance);
});
test("does not claim an ordinary walking route needs a companion or suggest outer-world routes indoors", () => {
  const discovery = { key: "cave", entrance: { x: 100, z: 200 }, routes: [{ safe: true, requirements: [] }] };
  assert.equal(projectWildsCompanionChapter({ ...base, discovery })!.opportunity, undefined);
  assert.equal(projectWildsCompanionChapter({ ...base, inOuterWorld: false, discovery: { ...discovery, routes: [{ safe: true, requirements: ["flight"] }] } })!.opportunity, undefined);
});
