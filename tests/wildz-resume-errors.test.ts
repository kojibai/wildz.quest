import assert from "node:assert/strict";
import { test } from "node:test";
import { shouldClearWildzResumeAfterError } from "../src/lib/receiz/wildz-resume-errors";

test("recoverable proof and storage outages retain the staged Vault resume", () => {
  assert.equal(shouldClearWildzResumeAfterError("wildz_restore_v4_unavailable"), false);
  assert.equal(shouldClearWildzResumeAfterError("wildz_restore_storage_failed"), false);
  assert.equal(shouldClearWildzResumeAfterError("wildz_indexed_db_open_failed"), false);
});

test("expired or invalid staged Vaults clear an unusable resume", () => {
  assert.equal(shouldClearWildzResumeAfterError("wildz_restore_resume_missing"), true);
  assert.equal(shouldClearWildzResumeAfterError("wildz_restore_v4_invalid"), true);
  assert.equal(shouldClearWildzResumeAfterError("wildz_restore_binding_invalid"), true);
});
