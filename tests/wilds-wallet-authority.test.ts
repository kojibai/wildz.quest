import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NextRequest } from "next/server";
import { WILDZ_RECEIZ_SESSION_SCOPE } from "../src/lib/receiz/wildz-auth-url";
import {
  createWildzReceizIdProofSession,
  packWildzProofSession,
  WILDZ_PROOF_SESSION_COOKIE
} from "../src/lib/receiz/wildz-proof-session";
import {
  resolveWildsWalletReadAuthority,
  wildsWalletAuthorityStatusFor
} from "../src/lib/receiz/wilds-wallet-route-authority";

const SECRET = "wilds-wallet-authority-test-secret-32-bytes";
process.env.RECEIZ_OAUTH_STATE_SECRET = SECRET;

function request(input: { scopes?: string[]; body?: unknown; proof?: "missing" | "malformed" } = {}) {
  const proof = createWildzReceizIdProofSession({
    keyId: "key:wallet-authority",
    username: "kai_01",
    displayName: "Kai"
  }, SECRET);
  const cookies = [
    "receiz_access_token=token:owner",
    `receiz_session_scope=${WILDZ_RECEIZ_SESSION_SCOPE}`
  ];
  if (input.proof === "malformed") cookies.unshift(`${WILDZ_PROOF_SESSION_COOKIE}=tampered`);
  if (!input.proof) cookies.unshift(`${WILDZ_PROOF_SESSION_COOKIE}=${packWildzProofSession(proof, SECRET)}`);
  if (input.scopes) cookies.push(`receiz_granted_scopes=${input.scopes.join("%20")}`);
  return new NextRequest("https://wildz.quest/api/wilds/wallet/summary", {
    method: input.body ? "POST" : "GET",
    headers: { cookie: cookies.join("; "), ...(input.body ? { "content-type": "application/json" } : {}) },
    ...(input.body ? { body: JSON.stringify(input.body) } : {})
  });
}

function dependencies(overrides: Partial<{
  profile: { id: string; handle: string };
  introspection: Record<string, unknown>;
  profileFailure: Error;
  introspectionFailure: Error;
}> = {}) {
  return {
    loadProfile: async () => {
      if (overrides.profileFailure) throw overrides.profileFailure;
      return overrides.profile ?? { id: "receiz:owner", handle: "kai_01.receiz.id" };
    },
    introspect: async () => {
      if (overrides.introspectionFailure) throw overrides.introspectionFailure;
      return overrides.introspection ?? {
        active: true,
        sub: "receiz:owner",
        scope: "openid profile receiz:wallet.read"
      };
    }
  };
}

describe("authenticated Wilds wallet read authority", () => {
  it("returns only same-account server authority and ignores request-body authority injection", async () => {
    const authority = await resolveWildsWalletReadAuthority(request({
      scopes: ["openid", "profile", "receiz:wallet.read"],
      body: {
        actorId: "injected", balancePhiMicro: "999999999", head: "forged",
        token: "token:forged", scopes: ["receiz:wallet.read"]
      }
    }), dependencies());

    assert.deepEqual(authority, {
      accessToken: "token:owner",
      ownerReceizId: "receiz:owner",
      actorId: "kai_01",
      profileHandle: "kai_01.receiz.id"
    });
  });

  it("rejects proof/profile and profile/introspection account mismatches", async () => {
    const scoped = () => request({ scopes: ["openid", "profile", "receiz:wallet.read"] });
    await assert.rejects(resolveWildsWalletReadAuthority(scoped(), dependencies({
      profile: { id: "receiz:owner", handle: "other_2.receiz.id" }
    })), /receiz_wallet_profile_binding_invalid/);
    await assert.rejects(resolveWildsWalletReadAuthority(scoped(), dependencies({
      introspection: { active: true, sub: "receiz:other", scope: "receiz:wallet.read" }
    })), /receiz_wallet_token_binding_invalid/);
  });

  it("fails closed when cookie granted scope is missing or omitted", async () => {
    await assert.rejects(resolveWildsWalletReadAuthority(request({ scopes: ["openid", "profile"] }), dependencies()), /receiz_wallet_read_scope_required/);
    await assert.rejects(resolveWildsWalletReadAuthority(request(), dependencies()), /receiz_wallet_read_scope_required/);
  });

  it("maps missing and tampered proof cookies to authority-required instead of upstream failure", async () => {
    const scoped = (proof: "missing" | "malformed") => request({ scopes: ["receiz:wallet.read"], proof });
    await assert.rejects(resolveWildsWalletReadAuthority(scoped("missing"), dependencies()), /receiz_wallet_authority_required/);
    await assert.rejects(resolveWildsWalletReadAuthority(scoped("malformed"), dependencies()), /receiz_wallet_authority_required/);
  });

  it("rejects a revoked token even when the cookie retains the read scope", async () => {
    await assert.rejects(resolveWildsWalletReadAuthority(request({ scopes: ["receiz:wallet.read"] }), dependencies({
      introspection: { active: false, sub: "receiz:owner", scope: "receiz:wallet.read" }
    })), /receiz_wallet_authority_required/);
  });

  it("classifies profile and introspection upstream failures without an authority fallback", async () => {
    const scoped = () => request({ scopes: ["receiz:wallet.read"] });
    await assert.rejects(resolveWildsWalletReadAuthority(scoped(), dependencies({
      profileFailure: Object.assign(new Error("upstream unavailable"), { status: 503 })
    })), /receiz_wallet_profile_resolution_unavailable/);
    await assert.rejects(resolveWildsWalletReadAuthority(scoped(), dependencies({
      introspectionFailure: Object.assign(new Error("upstream unavailable"), { status: 503 })
    })), /receiz_wallet_introspection_unavailable/);
  });

  it("maps wallet authority failures to exact safe HTTP classes", () => {
    assert.equal(wildsWalletAuthorityStatusFor("receiz_wallet_read_scope_required"), 401);
    assert.equal(wildsWalletAuthorityStatusFor("receiz_wallet_authority_required"), 401);
    assert.equal(wildsWalletAuthorityStatusFor("receiz_wallet_profile_binding_invalid"), 403);
    assert.equal(wildsWalletAuthorityStatusFor("receiz_wallet_token_binding_invalid"), 403);
    assert.equal(wildsWalletAuthorityStatusFor("receiz_wallet_profile_resolution_unavailable"), 503);
    assert.equal(wildsWalletAuthorityStatusFor("receiz_wallet_introspection_unavailable"), 503);
  });
});
