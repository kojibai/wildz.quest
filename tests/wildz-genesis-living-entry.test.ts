import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("immediate living entry has no obsolete full-screen onboarding layer", () => {
  const css = readFileSync("app/globals.css", "utf8");
  assert.doesNotMatch(css, /wildz-in-world-onboarding|wildz-onboarding-card|wilds-avatar-select/);
});
