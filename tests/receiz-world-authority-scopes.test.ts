import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  RECEIZ_WORLD_AUTHORITY_OIDC_SCOPES,
  receizOidcScopesFromEnv
} from "../src/lib/receiz/oauth-scopes";

describe("Receiz world authority OAuth scopes", () => {
  it("requests the exact v121 command, event, subject, mandate, and inventory rails", () => {
    assert.deepEqual(new Set(RECEIZ_WORLD_AUTHORITY_OIDC_SCOPES), new Set([
      "receiz:world_commands.write",
      "receiz:world_events.read",
      "receiz:subjects.read",
      "receiz:subjects.write",
      "receiz:subject_mandates.read",
      "receiz:subject_mandates.write",
      "receiz:subject_inventory.write"
    ]));
  });

  it("removes every mutation/replay authority scope when world rails are disabled", () => {
    const scopes = receizOidcScopesFromEnv({ RECEIZ_ENABLE_WORLD_SCOPES: "0" });
    for (const scope of RECEIZ_WORLD_AUTHORITY_OIDC_SCOPES) assert.equal(scopes.includes(scope), false, scope);
  });
});
