import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveWildzNativeApplicationId } from "../src/lib/receiz/wildz-native-application";
import { createReceizClient, createReceizProofAuthorityChallenge } from "@receiz/sdk";

const CLIENT = "rc_PtuBxB_Gbm9OkFeflZiwCz-d";

test("native v129 keeps the complete registered client through SDK and challenge audience", () => {
  for (const id of [CLIENT, "rc_JtTHw4BrHKXqtISBZcGUvlQd", "registered-legacy-client"]) {
    const applicationId = resolveWildzNativeApplicationId({RECEIZ_CLIENT_ID: id});
    assert.equal(applicationId, id);
    assert.ok(createReceizClient({applicationId, fetchImpl: async () => assert.fail("configuration is not a write")}));
    const challenge = createReceizProofAuthorityChallenge({applicationId, artifactDigest: "a".repeat(64), scopes: ["receiz:domains.read"], consentStatementDigest: "b".repeat(64), ttlPulses: 30});
    assert.equal(challenge.challenge.audience, id);
  }
});

test("native Market shares the current Wallet client even when the legacy application setting is stale", () => {
  assert.equal(resolveWildzNativeApplicationId({RECEIZ_APPLICATION_ID: CLIENT, RECEIZ_CLIENT_ID: CLIENT}), CLIENT);
  assert.equal(resolveWildzNativeApplicationId({RECEIZ_APPLICATION_ID: "wildz", RECEIZ_CLIENT_ID: CLIENT}), CLIENT);
  assert.equal(resolveWildzNativeApplicationId({RECEIZ_APPLICATION_ID: "rc_JtTHw4BrHKXqtISBZcGUvlQd", RECEIZ_CLIENT_ID: CLIENT}), CLIENT);
  assert.equal(resolveWildzNativeApplicationId({RECEIZ_APPLICATION_ID: CLIENT}), CLIENT);
});

test("missing or malformed native configuration cannot fall back to a username or secret", () => {
  assert.throws(() => resolveWildzNativeApplicationId({}), /application_required/);
  for (const id of ["", ` ${CLIENT}`, CLIENT.toLowerCase(), "rc_short", "wildz.receiz.id/", "https://receiz.com/wildz", "client-secret:do-not-use"]) {
    // Lowercase remains syntactically valid but is a different registered ID.
    if (id === CLIENT.toLowerCase()) {
      assert.equal(resolveWildzNativeApplicationId({RECEIZ_CLIENT_ID: id}), id);
      assert.notEqual(resolveWildzNativeApplicationId({RECEIZ_CLIENT_ID: id}), CLIENT);
    } else assert.throws(() => resolveWildzNativeApplicationId({RECEIZ_CLIENT_ID: id}), /application_(required|invalid)/);
  }
});
