import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyProfilePublicationFailure } from "../src/features/profile/publication-failure";

test("publication failures map known causes to actionable static messages", () => {
  for (const [code, kind] of [
    ["wildz_profile_identity_unlock_required", "identity"],
    ["wildz_card_identity_unlock_required", "identity"],
    ["wildz_card_identity_seal_required", "identity"],
    ["wildz_public_card_owner_mismatch", "owner"],
    ["wildz_public_card_publication_unconfirmed", "verification"],
    ["wildz_profile_identity_seal_required", "identity"],
    ["wildz_public_profile_owner_mismatch", "owner"],
    ["wildz_public_profile_card_unverified", "verification"],
    ["Failed to fetch", "network"]
  ] as const) {
    const failure = classifyProfilePublicationFailure(new Error(code));
    assert.equal(failure.kind, kind);
    assert.doesNotMatch(failure.message, /wildz_|Failed to fetch/);
  }
  assert.equal(classifyProfilePublicationFailure(null, {offline:true}).kind, "network");
  assert.equal(classifyProfilePublicationFailure(null, {timedOut:true}).kind, "timeout");
});
test("unknown server errors and arbitrary payloads never become UI text", () => {
  for (const value of [new Error("account=private-user key=secret"), {message:"private-user"}, "wildz_public_profile_owner_mismatch private-user"]) {
    const failure = classifyProfilePublicationFailure(value);
    assert.equal(failure.kind,"unknown");
    assert.doesNotMatch(failure.message,/private-user|secret/);
  }
});
