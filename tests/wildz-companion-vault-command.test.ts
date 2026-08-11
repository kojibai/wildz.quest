import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { cycleVaultCompanion } from "../src/features/play/companion-command-model";

const source = (path: string) => readFileSync(path, "utf8");

test("closed companion command renders one exact Vault identity and no decorative peeks", () => {
  const command = source("src/features/play/WildsCompanionCommand.tsx");

  assert.match(command, /activeEntry\.name/);
  assert.match(command, /activeEntry\.asset/);
  assert.doesNotMatch(command, /wilds-companion-peek|previous \?|next \?/);
});

test("horizontal cycling can return only ids present in the selectable Vault roster", () => {
  const ids = ["owned-a", "owned-b"];

  assert.equal(cycleVaultCompanion(ids, "owned-a", 1), "owned-b");
  assert.equal(cycleVaultCompanion(ids, "owned-b", 1), "owned-a");
  assert.equal(cycleVaultCompanion(["owned-a"], "owned-a", 1), "owned-a");
  assert.equal(cycleVaultCompanion([], "owned-a", 1), null);
});
