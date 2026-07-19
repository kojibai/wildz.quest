import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { NextRequest } from "next/server";
import {
  oauthFlowNonceMatches,
  packReceizOAuthState,
  packReceizSessionTicket,
  unpackReceizOAuthState,
  unpackReceizSessionTicket
} from "../src/lib/receiz/oauth-state";
import * as oauthStateModule from "../src/lib/receiz/oauth-state";
import { WILDZ_RECEIZ_OIDC_SCOPES } from "../src/lib/receiz/oauth-scopes";
import { playerReceizAccessToken, receizRequestSession } from "../src/lib/receiz/session";
import {
  canonicalWildzAppOrigin,
  isAllowedWildzAuthOrigin,
  normalizeWildzReturnTo,
  WILDZ_RECEIZ_SESSION_SCOPE
} from "../src/lib/receiz/wildz-auth-url";
import type { WildzRemoteSession } from "../src/lib/receiz/wildz-session-bridge";
import {
  createWildzRemoteSessionBridge,
  reconcileWildzRemoteIdentitySession,
  wildzRemoteSessionMatchesIdentity
} from "../src/lib/receiz/wildz-session-bridge";
import type { WildzIdentitySession } from "../src/lib/receiz/wildz-identity-repository";

const SECRET = "wildz-auth-test-secret-that-is-at-least-thirty-two-bytes";

function decodedTokenSegments(token: string) {
  return token.split(".").map((segment) => {
    try {
      return Buffer.from(segment, "base64url").toString("utf8");
    } catch {
      return "";
    }
  }).join("\n");
}

function requestWith(cookie = "") {
  const values = new Map(cookie.split(";").map((pair) => pair.trim()).filter(Boolean).map((pair) => {
    const separator = pair.indexOf("=");
    return [pair.slice(0, separator), decodeURIComponent(pair.slice(separator + 1))] as const;
  }));
  return {
    cookies: {
      get(name: string) {
        const value = values.get(name);
        return value === undefined ? undefined : { name, value };
      }
    }
  } as unknown as NextRequest;
}

test("Wildz OAuth return paths stay on the app origin", () => {
  assert.equal(normalizeWildzReturnTo("/u/fern?tab=vault#cards"), "/u/fern?tab=vault#cards");
  assert.equal(normalizeWildzReturnTo("//evil.example/path"), "/");
  assert.equal(normalizeWildzReturnTo("https://evil.example/path"), "/");
  assert.equal(normalizeWildzReturnTo("javascript:alert(1)"), "/");
  assert.equal(WILDZ_RECEIZ_SESSION_SCOPE, "wildz.quest:v1");
  assert.equal(canonicalWildzAppOrigin("https://spoofed.example", "https://wildz.quest/some-path"), "https://wildz.quest");
  assert.equal(isAllowedWildzAuthOrigin("https://wildz.quest", ["https://wildz.quest"]), true);
  assert.equal(isAllowedWildzAuthOrigin("https://spoofed.example", ["https://wildz.quest"]), false);
  assert.throws(() => canonicalWildzAppOrigin("https://spoofed.example", "javascript:alert(1)"), /wildz_auth_origin_invalid/);
});

test("signed PKCE state, nonce binding, and completion tickets fail closed on tamper and age", () => {
  const state = packReceizOAuthState({
    flowNonce: "nonce-1",
    verifier: "verifier-1",
    returnTo: "/?wildzResume=opaque",
    sessionScope: WILDZ_RECEIZ_SESSION_SCOPE,
    startOrigin: "https://wildz.quest",
    issuedAt: Date.now()
  }, SECRET);
  assert.equal(unpackReceizOAuthState(state, SECRET).verifier, "verifier-1");
  assert.doesNotMatch(decodedTokenSegments(state), /verifier-1|nonce-1|wildzResume/);
  assert.throws(() => unpackReceizOAuthState(`${state.slice(0, -1)}x`, SECRET), /Invalid Receiz OAuth state/);
  const oldState = packReceizOAuthState({
    flowNonce: "nonce-old",
    verifier: "verifier-old",
    returnTo: "/",
    sessionScope: WILDZ_RECEIZ_SESSION_SCOPE,
    startOrigin: "https://wildz.quest",
    issuedAt: Date.now() - 10 * 60 * 1000 - 1
  }, SECRET);
  assert.throws(() => unpackReceizOAuthState(oldState, SECRET), /Invalid Receiz OAuth state/);
  assert.equal(oauthFlowNonceMatches("nonce-1", "nonce-1"), true);
  assert.equal(oauthFlowNonceMatches("nonce-1", "nonce-2"), false);

  const ticket = packReceizSessionTicket({
    accessToken: "private-access-token",
    expiresIn: 3_600,
    returnTo: "/",
    sessionScope: WILDZ_RECEIZ_SESSION_SCOPE,
    flowNonce: "nonce-1",
    startOrigin: "https://wildz.quest",
    issuedAt: Date.now() - 2 * 60 * 1000 - 1
  }, SECRET);
  assert.doesNotMatch(decodedTokenSegments(ticket), /private-access-token|nonce-1/);
  assert.throws(() => unpackReceizSessionTicket(ticket, SECRET), /Invalid Receiz session ticket/);

  const legacyInput = packReceizSessionTicket({
    accessToken: "short-lived-access",
    expiresIn: 300,
    returnTo: "/",
    sessionScope: WILDZ_RECEIZ_SESSION_SCOPE,
    flowNonce: "nonce-legacy",
    startOrigin: "https://wildz.quest",
    refreshToken: "must-never-cross-the-ticket"
  } as Parameters<typeof packReceizSessionTicket>[0] & { refreshToken: string }, SECRET);
  assert.equal("refreshToken" in unpackReceizSessionTicket(legacyInput, SECRET), false);
});

test("player subject keys are stable, app-specific, and never expose the Receiz subject", () => {
  const subjectKey = (oauthStateModule as unknown as {
    receizPlayerSubjectKey?: (subject: string, secret: string) => string;
  }).receizPlayerSubjectKey;
  assert.equal(typeof subjectKey, "function");
  if (!subjectKey) return;
  const subject = "receiz-user-123";
  const first = subjectKey(subject, SECRET);
  assert.equal(first, subjectKey(subject, SECRET));
  assert.notEqual(first, subjectKey(subject, `${SECRET}-different`));
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.equal(first.includes(subject), false);
});

test("the minimal Wildz identity flow neither requests nor transports refresh authority", () => {
  assert.equal(WILDZ_RECEIZ_OIDC_SCOPES.includes("offline_access"), false);
  const callback = readFileSync("app/api/auth/receiz/callback/route.ts", "utf8");
  const complete = readFileSync("app/api/auth/receiz/complete/route.ts", "utf8");
  const oauthState = readFileSync("src/lib/receiz/oauth-state.ts", "utf8");
  for (const source of [callback, complete, oauthState]) {
    assert.doesNotMatch(source, /refreshToken|refresh_token|receiz_refresh_token/);
  }
});

test("the Wildz session requests only the scoped rails used by live V3 gameplay", () => {
  for (const scope of [
    "openid",
    "profile",
    "email",
    "receiz:app_state.read",
    "receiz:app_state.write",
    "receiz:public_store.read",
    "receiz:public_store.write",
    "receiz:wallet.read",
    "receiz:wallet.transfer",
    "receiz:payments.read",
    "receiz:payments.create",
    "receiz:record",
    "receiz:seal",
    "receiz:verify"
  ]) {
    assert.equal(WILDZ_RECEIZ_OIDC_SCOPES.includes(scope), true, scope);
  }
  assert.equal(WILDZ_RECEIZ_OIDC_SCOPES.includes("offline_access"), false);
  assert.equal(WILDZ_RECEIZ_OIDC_SCOPES.some((scope) => scope.startsWith("receiz:twin.")), false);
  assert.equal(WILDZ_RECEIZ_OIDC_SCOPES.some((scope) => scope.startsWith("receiz:world.")), false);

  const interoperability = readFileSync("docs/release/artifact-interoperability.md", "utf8");
  assert.match(interoperability, /receiz:record[\s\S]*receiz:seal[\s\S]*receiz:verify/);
  assert.match(interoperability, /offline_access[^.]*not requested/i);
});

test("provider denial and missing code preserve only the return path sealed in valid state", () => {
  const callback = readFileSync("app/api/auth/receiz/callback/route.ts", "utf8");
  const unpackIndex = callback.indexOf("unpackReceizOAuthState(state)");
  const denialIndex = callback.indexOf("if (error)");
  const missingCodeIndex = callback.indexOf("if (!code)");
  assert.ok(unpackIndex >= 0 && unpackIndex < denialIndex && denialIndex < missingCodeIndex);
  assert.match(callback, /if \(error\) return redirectWithError\(origin, "authorization_denied", oauthState\.returnTo\)/);
  assert.match(callback, /if \(!code\) return redirectWithError\(origin, "missing_code", oauthState\.returnTo\)/);
  assert.match(callback, /catch \{\s*return redirectWithError\(origin, "invalid_state"\)/);
});

test("remote session projection requires an opaque subject key", async () => {
  const subjectKey = "a".repeat(64);
  const connected = createWildzRemoteSessionBridge({
    fetcher: async () => Response.json({
      status: "connected",
      subjectKey,
      sessionKeyId: "receiz_vault_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      authority: "proof-sealed-vault",
      vaultCardRootSha256: `sha256:${"d".repeat(64)}`,
      actorId: "vault_keeper",
      profileHandle: "vault_keeper.receiz.id",
      displayName: "Vault Keeper"
    })
  });
  assert.deepEqual(await connected.current(), {
    status: "connected",
    subjectKey,
    sessionKeyId: "receiz_vault_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    authority: "proof-sealed-vault",
    vaultCardRootSha256: `sha256:${"d".repeat(64)}`,
    actorId: "vault_keeper",
    profileHandle: "vault_keeper.receiz.id",
    displayName: "Vault Keeper"
  });

  const missingSubject = createWildzRemoteSessionBridge({
    fetcher: async () => Response.json({
      status: "connected",
      actorId: "vault_keeper",
      profileHandle: "vault_keeper.receiz.id",
      displayName: "Vault Keeper"
    })
  });
  assert.equal((await missingSubject.current()).status, "unknown");
});

test("a committed local Vault exchanges its pending admission on the same origin", async () => {
  let requestedUrl = "";
  let requestedInit: RequestInit | undefined;
  const bridge = createWildzRemoteSessionBridge({
    fetcher: async (input, init) => {
      requestedUrl = String(input);
      requestedInit = init;
      return Response.json({
        status: "connected",
        subjectKey: "b".repeat(64),
        sessionKeyId: `receiz_vault_${"c".repeat(32)}`,
        authority: "proof-sealed-vault",
        actorId: "bjklock",
        profileHandle: "bjklock.receiz.id",
        displayName: null
      });
    }
  });

  const session = await bridge.commitVaultAdmission({
    actorId: "bjklock",
    profileHandle: "bjklock.receiz.id",
    vaultKeyId: `receiz_vault_${"c".repeat(32)}`
  });

  assert.equal(requestedUrl, "/api/auth/wildz/vault-session");
  assert.equal(requestedInit?.method, "POST");
  assert.equal(requestedInit?.credentials, "same-origin");
  assert.equal(requestedInit?.cache, "no-store");
  assert.equal(new Headers(requestedInit?.headers).get("content-type"), "application/json");
  assert.deepEqual(JSON.parse(String(requestedInit?.body)), {
    actorId: "bjklock",
    profileHandle: "bjklock.receiz.id",
    vaultKeyId: `receiz_vault_${"c".repeat(32)}`
  });
  assert.equal(session.status, "connected");
});

test("network admission matches the exact Vault artifact and the exact identity key", () => {
  const vault: WildzIdentitySession = {
    schema: "receiz.wildz.identity_session.v1",
    keyId: `receiz_vault_${"a".repeat(32)}`,
    actorId: "bjklock",
    username: "bjklock",
    displayName: null,
    portableStateStatus: "missing",
    localAuthority: "proof-sealed-vault",
    remoteStatus: "unknown"
  };
  const exactVault: WildzRemoteSession = {
    status: "connected",
    subjectKey: "b".repeat(64),
    sessionKeyId: vault.keyId,
    authority: "proof-sealed-vault",
    actorId: "bjklock",
    profileHandle: "bjklock.receiz.id",
    displayName: null
  };
  assert.equal(wildzRemoteSessionMatchesIdentity(vault, exactVault), true);
  assert.equal(wildzRemoteSessionMatchesIdentity(vault, {
    ...exactVault,
    sessionKeyId: `receiz_vault_${"c".repeat(32)}`
  }), false);

  const identity: WildzIdentitySession = {
    ...vault,
    keyId: "receiz_identity_key_abcdefgh",
    actorId: "self_asserted_label",
    username: "self_asserted_label",
    portableStateStatus: "verified",
    localAuthority: "verified"
  };
  assert.equal(wildzRemoteSessionMatchesIdentity(identity, {
    status: "connected",
    subjectKey: "d".repeat(64),
    sessionKeyId: identity.keyId,
    authority: "identity-key",
    actorId: "canonical_owner",
    profileHandle: "canonical_owner.receiz.id",
    displayName: "Canonical Owner"
  }), true);
});

test("persisted remote-only identities revalidate both account subject and player coordinate", () => {
  const subjectKey = "a".repeat(64);
  const session: WildzIdentitySession = {
    schema: "receiz.wildz.identity_session.v1",
    keyId: `receiz_remote_${subjectKey.slice(0, 32)}`,
    actorId: "vault_keeper",
    username: "vault_keeper",
    displayName: "Old display",
    portableStateStatus: "missing",
    localAuthority: "remote-only",
    remoteStatus: "connected"
  };
  const matching = reconcileWildzRemoteIdentitySession(session, {
    status: "connected",
    subjectKey,
    actorId: "vault_keeper",
    profileHandle: "vault_keeper.receiz.id",
    displayName: "Vault Keeper"
  });
  assert.equal(matching.disconnect, false);
  assert.equal(matching.session.remoteStatus, "connected");
  assert.equal(matching.session.displayName, "Vault Keeper");

  const offline = reconcileWildzRemoteIdentitySession(session, {
    status: "offline", actorId: null, profileHandle: null, displayName: null
  });
  assert.equal(offline.disconnect, false);
  assert.equal(offline.session.remoteStatus, "offline");

  const foreign = reconcileWildzRemoteIdentitySession(session, {
    status: "connected",
    subjectKey: "b".repeat(64),
    actorId: "other_player",
    profileHandle: "other_player.receiz.id",
    displayName: "Other"
  });
  assert.equal(foreign.disconnect, true);
  assert.equal(foreign.session.remoteStatus, "unavailable");
  assert.equal(foreign.session.actorId, "vault_keeper");
});

test("verified local identities connect when the remote actor coordinate matches without replacing proof authority", () => {
  const session: WildzIdentitySession = {
    schema: "receiz.wildz.identity_session.v1",
    keyId: "receiz_local_proof_key",
    actorId: "wildz_explorer",
    username: "wildz_explorer",
    displayName: "Local Explorer",
    portableStateStatus: "verified",
    localAuthority: "verified",
    remoteStatus: "unknown"
  };

  const matching = reconcileWildzRemoteIdentitySession(session, {
    status: "connected",
    subjectKey: "f".repeat(64),
    actorId: "wildz_explorer",
    profileHandle: "wildz_explorer.receiz.id",
    displayName: "Receiz Explorer"
  });

  assert.equal(matching.disconnect, false);
  assert.equal(matching.session.remoteStatus, "connected");
  assert.equal(matching.session.keyId, session.keyId);
  assert.equal(matching.session.actorId, session.actorId);
  assert.equal(matching.session.localAuthority, session.localAuthority);
  assert.equal(matching.session.portableStateStatus, session.portableStateStatus);
});

test("verified local identities reject a foreign remote actor without replacing proof authority", () => {
  const session: WildzIdentitySession = {
    schema: "receiz.wildz.identity_session.v1",
    keyId: "receiz_local_proof_key",
    actorId: "wildz_explorer",
    username: "wildz_explorer",
    displayName: "Local Explorer",
    portableStateStatus: "verified",
    localAuthority: "verified",
    remoteStatus: "connected"
  };

  const foreign = reconcileWildzRemoteIdentitySession(session, {
    status: "connected",
    subjectKey: "0".repeat(64),
    actorId: "other_player",
    profileHandle: "other_player.receiz.id",
    displayName: "Other Player"
  });

  assert.equal(foreign.disconnect, true);
  assert.equal(foreign.session.remoteStatus, "unavailable");
  assert.equal(foreign.session.keyId, session.keyId);
  assert.equal(foreign.session.actorId, session.actorId);
  assert.equal(foreign.session.localAuthority, session.localAuthority);
  assert.equal(foreign.session.portableStateStatus, session.portableStateStatus);
});

test("later Connect reconciliation preserves a proof-backed Vault owner scope and never lets another account replace it", () => {
  const vaultScope = `receiz_vault_${"c".repeat(32)}`;
  const session: WildzIdentitySession = {
    schema: "receiz.wildz.identity_session.v1",
    keyId: vaultScope,
    actorId: "vault_keeper",
    username: "vault_keeper",
    displayName: null,
    portableStateStatus: "missing",
    localAuthority: "proof-sealed-vault",
    remoteStatus: "unknown"
  };
  const matching = reconcileWildzRemoteIdentitySession(session, {
    status: "connected",
    subjectKey: "d".repeat(64),
    actorId: "vault_keeper",
    profileHandle: "vault_keeper.receiz.id",
    displayName: "Vault Keeper"
  });
  assert.equal(matching.disconnect, false);
  assert.equal(matching.session.keyId, vaultScope);
  assert.equal(matching.session.actorId, "vault_keeper");
  assert.equal(matching.session.username, "vault_keeper");
  assert.equal(matching.session.remoteStatus, "connected");

  const foreign = reconcileWildzRemoteIdentitySession(session, {
    status: "connected",
    subjectKey: "e".repeat(64),
    actorId: "other_player",
    profileHandle: "other_player.receiz.id",
    displayName: "Other Player"
  });
  assert.equal(foreign.disconnect, true);
  assert.equal(foreign.session.keyId, vaultScope);
  assert.equal(foreign.session.actorId, "vault_keeper");
  assert.equal(foreign.session.username, "vault_keeper");
  assert.equal(foreign.session.remoteStatus, "unavailable");
});

test("delegated operator tokens never become a signed-in Wildz player", () => {
  const prior = process.env.RECEIZ_ACCESS_TOKEN;
  process.env.RECEIZ_ACCESS_TOKEN = "operator-only";
  try {
    const delegated = receizRequestSession(requestWith());
    assert.equal(delegated.accessToken, undefined);
    assert.equal(delegated.source, null);
    assert.equal(delegated.cookieAccessToken, undefined);
    assert.equal(playerReceizAccessToken(delegated), undefined);

    const wrongScope = receizRequestSession(requestWith(
      "receiz_access_token=player-cookie; receiz_session_scope=another.app:v1"
    ));
    assert.equal(playerReceizAccessToken(wrongScope), undefined);

    const player = receizRequestSession(requestWith(
      `receiz_access_token=player-cookie; receiz_session_scope=${encodeURIComponent(WILDZ_RECEIZ_SESSION_SCOPE)}`
    ));
    assert.equal(playerReceizAccessToken(player), "player-cookie");
  } finally {
    if (prior === undefined) delete process.env.RECEIZ_ACCESS_TOKEN;
    else process.env.RECEIZ_ACCESS_TOKEN = prior;
  }
});

test("proof-native auth exposes only a safe same-origin session while legacy PKCE remains isolated", () => {
  const start = readFileSync("app/api/auth/receiz/start/route.ts", "utf8");
  const callback = readFileSync("app/api/auth/receiz/callback/route.ts", "utf8");
  const complete = readFileSync("app/api/auth/receiz/complete/route.ts", "utf8");
  const me = readFileSync("app/api/auth/receiz/me/route.ts", "utf8");
  const proofSession = readFileSync("app/api/auth/wildz/session/route.ts", "utf8");
  const vaultSession = readFileSync("app/api/auth/wildz/vault-session/route.ts", "utf8");
  const documentVerify = readFileSync("app/api/document-verify/route.ts", "utf8");
  const identityAdapter = readFileSync("src/lib/receiz/wildz-identity-adapter.ts", "utf8");
  const bridge = readFileSync("src/lib/receiz/wildz-session-bridge.ts", "utf8");
  const multiplayer = readFileSync("src/lib/receiz/wilds-multiplayer-server.ts", "utf8");

  assert.match(start, /process\.env\.RECEIZ_CLIENT_ID/);
  assert.match(start, /canonicalWildzAppOrigin/);
  assert.match(start, /request\.nextUrl\.origin !== origin/);
  assert.match(start, /codeChallenge/);
  assert.match(start, /usernameHint:\s*coordinate\.actorId/);
  assert.doesNotMatch(start, /connect\/login\/bootstrap/);
  for (const source of [callback, complete]) {
    assert.match(source, /httpOnly:\s*true/);
    assert.match(source, /sameSite:\s*"lax"/);
    assert.match(source, /receiz_access_token/);
    assert.match(source, /receiz_session_scope/);
  }
  assert.match(callback, /path:\s*"\/"/);
  assert.match(callback, /isAllowedWildzAuthOrigin/);
  assert.match(complete, /path:\s*"\/"/);
  assert.match(complete, /session\.startOrigin !== origin/);
  assert.doesNotMatch(me, /delegatedAccessToken|receizAccessTokenFromRequest/);
  assert.match(me, /playerReceizAccessToken/);
  assert.match(me, /receizPlayerSubjectKey\(profile\.id\)/);
  assert.match(me, /export async function DELETE/);
  assert.doesNotMatch(me, /email|imageUrl|\bsub\b|\buid\b|accessToken\s*:/);
  assert.match(proofSession, /WILDZ_PROOF_SESSION_COOKIE/);
  assert.match(proofSession, /httpOnly|wildzProofSessionCookieOptions/);
  assert.match(proofSession, /\/api\/auth\/receiz-id\/continue/);
  assert.match(proofSession, /createWildzReceizIdProofSession/);
  assert.match(identityAdapter, /buildReceizIdContinueRequest/);
  assert.doesNotMatch(identityAdapter, /publicWildzIdentityCredential|signReceizIdentityLoginProof/);
  assert.match(vaultSession, /readWildzVaultPendingAdmissionCookie/);
  assert.match(vaultSession, /packWildzProofSession/);
  assert.match(documentVerify, /WILDZ_VAULT_PENDING_COOKIE/);
  assert.match(documentVerify, /packWildzVaultPendingAdmission/);
  assert.doesNotMatch(documentVerify, /packWildzProofSession/);
  assert.match(bridge, /cache:\s*"no-store"/);
  assert.match(bridge, /\/api\/auth\/wildz\/session/);
  assert.match(bridge, /\/api\/auth\/wildz\/vault-session/);
  assert.doesNotMatch(bridge, /wilds_world_connect_required/);
  assert.doesNotMatch(bridge, /\/api\/auth\/receiz\/start|connectUrl|window\.location/);
  assert.doesNotMatch(bridge, /continueLocalIdentity|navigate/);
  assert.match(multiplayer, /readWildzProofSessionCookie/);
  assert.doesNotMatch(multiplayer, /if \(session\.cookieAccessToken\)/);
  assert.doesNotMatch(multiplayer, /!actor\.accessToken \|\| actor\.practice/);

  const projection: WildzRemoteSession = {
    status: "connected",
    subjectKey: "a".repeat(64),
    actorId: "vault_keeper",
    profileHandle: "vault_keeper.receiz.id",
    displayName: "Vault Keeper"
  };
  const serialized = JSON.stringify(projection);
  for (const secretField of ["accessToken", "refreshToken", "email", "sub", "uid", "imageUrl"]) {
    assert.equal(serialized.includes(`"${secretField}":`), false);
  }
});
