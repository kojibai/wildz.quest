import assert from "node:assert/strict";
import { test } from "node:test";
import { createWildsNaturalTextureData } from "../src/features/play/wilds-natural-material.js";

type Role = "bark" | "leaf" | "skin";

// Keep the original pixel arithmetic here so a role-specific fast path cannot
// silently change the appearance of a texture or its alpha channel.
function originalNaturalTextureData(role: Role) {
  const size = 128, data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const noise = ((Math.imul(x + 19, 374761393) ^ Math.imul(y + 7, 668265263)) >>> 0) % 256 / 255;
    const grain = Math.sin(x * .65 + Math.sin(y * .049) * 2.2);
    const fissure = Math.pow(Math.max(0, grain), 12);
    const fleck = Math.sin(x * .19 + y * .11) * Math.cos(y * .23 - x * .07);
    const vein = Math.abs(Math.sin((x + y * .4) * Math.PI / 16));
    const shade = role === "bark" ? .79 + .1 * grain + .07 * noise - .24 * fissure
      : role === "leaf" ? .85 + .045 * vein + .055 * noise + .05 * fleck : .94 + .06 * noise;
    const offset = (y * size + x) * 4;
    data[offset] = data[offset + 1] = data[offset + 2] = Math.round(Math.max(.25, shade) * 255);
    data[offset + 3] = 255;
  }
  return data;
}

test("role-specialized natural maps retain every original RGBA byte", () => {
  for (const role of ["bark", "leaf", "skin"] as const) {
    assert.deepEqual(createWildsNaturalTextureData(role), originalNaturalTextureData(role), role);
  }
});
