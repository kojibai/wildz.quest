import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { projectWildsFlightObstruction } from "../src/features/play/wilds-flight-obstruction";

describe("Wilds flight obstruction language", () => {
  it("names real physical causes without exposing internal authority ids", () => {
    assert.deepEqual(projectWildsFlightObstruction("wildz.rendered.v1:wayfinder-hollow:trail-gate-beam"), {
      label: "Trail Gate beam overhead",
      guidance: "Move into open sky to keep climbing."
    });
    assert.deepEqual(projectWildsFlightObstruction("ceiling:wildz.site.v1:0:0:1:0123456789abcdef:interior:0"), {
      label: "Cave roof overhead",
      guidance: "Descend or follow the chamber opening."
    });
    assert.deepEqual(projectWildsFlightObstruction("wildz.terrain.v1:2:3:tree:1"), {
      label: "Tree canopy overhead",
      guidance: "Move into open sky to keep climbing."
    });
    assert.equal(projectWildsFlightObstruction(null), null);
  });
});
