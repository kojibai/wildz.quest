import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  RECEIZ_TWIN_OIDC_SCOPES,
  RECEIZ_WORLD_AUTHORITY_OIDC_SCOPES,
  receizOidcScopesFromEnv
} from "../src/lib/receiz/oauth-scopes";
import { playerReceizWorldAuthorityAccessToken, type ReceizRequestSession } from "../src/lib/receiz/session";
import { WILDZ_RECEIZ_SESSION_SCOPE } from "../src/lib/receiz/wildz-auth-url";

describe("Receiz world authority OAuth scopes", () => {
  it("requests the exact v124 command, event, subject, mandate, and inventory rails", () => {
    assert.deepEqual(new Set(RECEIZ_WORLD_AUTHORITY_OIDC_SCOPES), new Set([
      "receiz:world_commands.write",
      "receiz:world_events.read",
      "receiz:subjects.read",
      "receiz:subjects.write",
      "receiz:subject_mandates.read",
      "receiz:subject_mandates.write",
      "receiz:subject-mandates.read",
      "receiz:subject-mandates.write",
      "receiz:subject_inventory.write"
    ]));
  });

  it("removes every mutation/replay authority scope when world rails are disabled", () => {
    const scopes = receizOidcScopesFromEnv({ RECEIZ_ENABLE_WORLD_SCOPES: "0" });
    for (const scope of RECEIZ_WORLD_AUTHORITY_OIDC_SCOPES) assert.equal(scopes.includes(scope), false, scope);
    assert.equal(scopes.includes("receiz:world.private"), false);
  });

  it("requests and gates the SDK-defined v124 Twin execution scopes", () => {
    assert.deepEqual(RECEIZ_TWIN_OIDC_SCOPES, [
      "receiz:twin.read",
      "receiz:twin.write",
      "receiz:creator.execute",
      "receiz:twin.execute"
    ]);
    const scopes = receizOidcScopesFromEnv({ RECEIZ_ENABLE_TWIN_SCOPES: "0" });
    for (const scope of RECEIZ_TWIN_OIDC_SCOPES) assert.equal(scopes.includes(scope), false, scope);
  });

  it("fails world mutation closed unless the cookie token carries every exact granted scope", () => {
    const session: ReceizRequestSession = {
      accessToken: "token",
      cookieAccessToken: "token",
      delegatedAccessToken: undefined,
      sessionScope: WILDZ_RECEIZ_SESSION_SCOPE,
      grantedScopes: RECEIZ_WORLD_AUTHORITY_OIDC_SCOPES,
      source: "cookie"
    };
    assert.equal(playerReceizWorldAuthorityAccessToken(session), "token");
    assert.equal(playerReceizWorldAuthorityAccessToken({ ...session, grantedScopes: RECEIZ_WORLD_AUTHORITY_OIDC_SCOPES.slice(1) }), undefined);
    assert.equal(playerReceizWorldAuthorityAccessToken({ ...session, source: "delegated", cookieAccessToken: undefined }), undefined);
  });
});
