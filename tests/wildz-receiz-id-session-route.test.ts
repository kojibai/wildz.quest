import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import {
  buildReceizIdContinueRequest,
  createReceizIdIdentity,
  signReceizIdentityLoginProof
} from "@receiz/sdk";
import { GET, POST } from "../app/api/auth/wildz/session/route";
import {
  WILDZ_PROOF_NONCE_COOKIE,
  WILDZ_PROOF_SESSION_COOKIE,
  createWildzVaultProofSession,
  packWildzProofSession,
  unpackWildzProofSession
} from "../src/lib/receiz/wildz-proof-session";
import { canonicalPortableCardJson, sealCollectedCard } from "../src/features/play/portable-card";
import { deriveWildzVaultCardAdmission } from "../src/lib/receiz/wildz-vault-card-admission";

const SECRET = "wildz-receiz-id-route-secret-at-least-thirty-two-bytes";
const NONCE = "d2lsZHotc2FtZS1vcmlnaW4tbm9uY2UtMTIzNA";

test("a passive proof-session probe treats a missing session as an anonymous state", async () => {
  const response = await GET(new NextRequest("https://wildz.quest/api/auth/wildz/session"));

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { status: "unknown" });
});

test("an unconfigured local proof sealer reports unavailable before browser nonce admission", async () => {
  const priorStateSecret = process.env.RECEIZ_OAUTH_STATE_SECRET;
  const priorClientSecret = process.env.RECEIZ_CLIENT_SECRET;
  const priorFetch = globalThis.fetch;
  delete process.env.RECEIZ_OAUTH_STATE_SECRET;
  delete process.env.RECEIZ_CLIENT_SECRET;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return Response.json({ ok: true });
  };
  try {
    const response = await POST(new NextRequest("http://localhost/api/auth/wildz/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ challengeB64Url: "browser-cannot-store-a-secure-cookie-over-http" })
    }));

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "unavailable" });
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = priorFetch;
    if (priorStateSecret === undefined) delete process.env.RECEIZ_OAUTH_STATE_SECRET;
    else process.env.RECEIZ_OAUTH_STATE_SECRET = priorStateSecret;
    if (priorClientSecret === undefined) delete process.env.RECEIZ_CLIENT_SECRET;
    else process.env.RECEIZ_CLIENT_SECRET = priorClientSecret;
  }
});

test("Identity Seal login admits its signed Vault cards into the server session", async () => {
  const priorSecret = process.env.RECEIZ_OAUTH_STATE_SECRET;
  const priorBase = process.env.RECEIZ_BASE_URL;
  const priorFetch = globalThis.fetch;
  process.env.RECEIZ_OAUTH_STATE_SECRET = SECRET;
  process.env.RECEIZ_BASE_URL = "https://receiz.example";
  try {
    const identity = await createReceizIdIdentity({ username: "seal_vault_owner", displayName: "Seal Vault Owner" });
    const continuation = await buildReceizIdContinueRequest(identity, { nonceB64Url: NONCE });
    const card = sealCollectedCard({
      formId: "mintcub-1",
      ownerReceizId: "historical_keeper",
      encounterId: "identity-seal-server-admission",
      capturedAt: "2026-07-18T18:00:00.000Z"
    });
    const admission = deriveWildzVaultCardAdmission({
      cards: [card],
      playerHandle: "seal_vault_owner.receiz.id"
    });
    const claim = {
      schema: "receiz.wildz.identity_vault_admission.v1",
      keyId: continuation.keyId,
      actorId: "seal_vault_owner",
      profileHandle: "seal_vault_owner.receiz.id",
      root: admission.root,
      leafCount: admission.leafCount,
      issuedAt: new Date().toISOString()
    } as const;
    const proof = await signReceizIdentityLoginProof({
      keyFile: identity.keyFile,
      challengeText: canonicalPortableCardJson(claim)
    });
    globalThis.fetch = async () => Response.json({
      ok: true,
      bound: true,
      session: {
        uid: "seal-vault-owner-uid",
        username: "seal_vault_owner",
        displayName: "Seal Vault Owner"
      }
    });

    const response = await POST(new NextRequest("https://wildz.quest/api/auth/wildz/session", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: `${WILDZ_PROOF_NONCE_COOKIE}=${NONCE}`
      },
      body: JSON.stringify({
        ...continuation,
        vaultCardAdmission: {
          claim,
          challengeB64Url: proof.challengeB64Url,
          signatureB64Url: proof.signatureB64Url
        }
      })
    }));

    assert.equal(response.status, 200);
    const cookie = response.cookies.get(WILDZ_PROOF_SESSION_COOKIE);
    assert.ok(cookie?.value);
    assert.equal(unpackWildzProofSession(cookie.value, SECRET).vaultCardRootSha256, admission.root);
  } finally {
    globalThis.fetch = priorFetch;
    if (priorSecret === undefined) delete process.env.RECEIZ_OAUTH_STATE_SECRET;
    else process.env.RECEIZ_OAUTH_STATE_SECRET = priorSecret;
    if (priorBase === undefined) delete process.env.RECEIZ_BASE_URL;
    else process.env.RECEIZ_BASE_URL = priorBase;
  }
});

test("same-origin Receiz ID continuation trusts only the canonical upstream account", async () => {
  const priorSecret = process.env.RECEIZ_OAUTH_STATE_SECRET;
  const priorBase = process.env.RECEIZ_BASE_URL;
  const priorFetch = globalThis.fetch;
  process.env.RECEIZ_OAUTH_STATE_SECRET = SECRET;
  process.env.RECEIZ_BASE_URL = "https://receiz.example";
  try {
    const identity = await createReceizIdIdentity({
      username: "self_asserted_label",
      displayName: "Self Asserted"
    });
    const continuation = await buildReceizIdContinueRequest(identity, { nonceB64Url: NONCE });
    const priorVault = createWildzVaultProofSession({
      actorId: "canonical_owner",
      profileHandle: "canonical_owner.receiz.id",
      proofBasisSha256: "4".repeat(64),
      byteDigestSha256: "5".repeat(64),
      vaultCardRootSha256: `sha256:${"6".repeat(64)}`
    }, SECRET);
    let upstreamUrl = "";
    let upstreamBody = "";
    globalThis.fetch = async (input, init) => {
      upstreamUrl = String(input);
      upstreamBody = String(init?.body ?? "");
      return Response.json({
        ok: true,
        bound: true,
        next: "/u/canonical_owner",
        session: {
          uid: "global-user-123",
          email: "private@example.com",
          username: "canonical_owner",
          displayName: "Canonical Owner"
        },
        accountBindings: []
      });
    };
    const response = await POST(new NextRequest("https://wildz.quest/api/auth/wildz/session", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: `${WILDZ_PROOF_NONCE_COOKIE}=${NONCE}; ${WILDZ_PROOF_SESSION_COOKIE}=${packWildzProofSession(priorVault, SECRET)}`
      },
      body: JSON.stringify(continuation)
    }));

    assert.equal(response.status, 200);
    assert.equal(upstreamUrl, "https://receiz.example/api/auth/receiz-id/continue");
    assert.deepEqual(JSON.parse(upstreamBody), continuation);
    const body = await response.json();
    assert.deepEqual(body, {
      status: "connected",
      subjectKey: body.subjectKey,
      sessionKeyId: continuation.keyId,
      actorId: "canonical_owner",
      profileHandle: "canonical_owner.receiz.id",
      displayName: "Canonical Owner",
      authority: "identity-key",
      vaultCardRootSha256: priorVault.vaultCardRootSha256
    });
    assert.match(body.subjectKey, /^[a-f0-9]{64}$/);
    assert.doesNotMatch(JSON.stringify(body), /private@example\.com|global-user-123|next|accountBindings/);
    const cookie = response.cookies.get(WILDZ_PROOF_SESSION_COOKIE);
    assert.ok(cookie?.value);
    const admitted = unpackWildzProofSession(cookie.value, SECRET);
    assert.equal(admitted.actorId, "canonical_owner");
    assert.equal(admitted.vaultCardRootSha256, priorVault.vaultCardRootSha256);
  } finally {
    globalThis.fetch = priorFetch;
    if (priorSecret === undefined) delete process.env.RECEIZ_OAUTH_STATE_SECRET;
    else process.env.RECEIZ_OAUTH_STATE_SECRET = priorSecret;
    if (priorBase === undefined) delete process.env.RECEIZ_BASE_URL;
    else process.env.RECEIZ_BASE_URL = priorBase;
  }
});

test("Receiz ID continuation never reaches upstream without the matching browser nonce", async () => {
  const priorSecret = process.env.RECEIZ_OAUTH_STATE_SECRET;
  const priorFetch = globalThis.fetch;
  process.env.RECEIZ_OAUTH_STATE_SECRET = SECRET;
  try {
    const identity = await createReceizIdIdentity({ username: "nonce_test" });
    const continuation = await buildReceizIdContinueRequest(identity, { nonceB64Url: NONCE });
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      return Response.json({ ok: true });
    };
    const response = await POST(new NextRequest("https://wildz.quest/api/auth/wildz/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(continuation)
    }));

    assert.equal(response.status, 401);
    assert.equal(calls, 0);
    assert.equal(response.cookies.get(WILDZ_PROOF_SESSION_COOKIE), undefined);
  } finally {
    globalThis.fetch = priorFetch;
    if (priorSecret === undefined) delete process.env.RECEIZ_OAUTH_STATE_SECRET;
    else process.env.RECEIZ_OAUTH_STATE_SECRET = priorSecret;
  }
});

test("a wrong browser nonce fails closed before upstream with no session cookie", async () => {
  const priorSecret = process.env.RECEIZ_OAUTH_STATE_SECRET;
  const priorFetch = globalThis.fetch;
  process.env.RECEIZ_OAUTH_STATE_SECRET = SECRET;
  try {
    const identity = await createReceizIdIdentity({ username: "wrong_nonce" });
    const continuation = await buildReceizIdContinueRequest(identity, { nonceB64Url: NONCE });
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      return Response.json({ ok: true });
    };
    const response = await POST(new NextRequest("https://wildz.quest/api/auth/wildz/session", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: `${WILDZ_PROOF_NONCE_COOKIE}=definitely-the-wrong-nonce`
      },
      body: JSON.stringify(continuation)
    }));

    assert.equal(response.status, 401);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(calls, 0);
    assert.equal(response.cookies.get(WILDZ_PROOF_SESSION_COOKIE), undefined);
  } finally {
    globalThis.fetch = priorFetch;
    if (priorSecret === undefined) delete process.env.RECEIZ_OAUTH_STATE_SECRET;
    else process.env.RECEIZ_OAUTH_STATE_SECRET = priorSecret;
  }
});

test("malformed and hostile proof JSON fail closed before upstream without setting authority", async () => {
  const priorSecret = process.env.RECEIZ_OAUTH_STATE_SECRET;
  const priorFetch = globalThis.fetch;
  process.env.RECEIZ_OAUTH_STATE_SECRET = SECRET;
  try {
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      return Response.json({ ok: true });
    };
    const bodies = [
      "{not-json",
      JSON.stringify({
        __proto__: { admin: true },
        constructor: { prototype: { admitted: true } },
        keyId: ["receiz_identity_key_hostile"],
        alg: "none",
        challengeB64Url: { toString: "spoof" },
        signatureB64Url: null
      })
    ];

    for (const body of bodies) {
      const response = await POST(new NextRequest("https://wildz.quest/api/auth/wildz/session", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `${WILDZ_PROOF_NONCE_COOKIE}=${NONCE}`
        },
        body
      }));
      assert.equal(response.status, 401);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.equal(response.cookies.get(WILDZ_PROOF_SESSION_COOKIE), undefined);
    }
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = priorFetch;
    if (priorSecret === undefined) delete process.env.RECEIZ_OAUTH_STATE_SECRET;
    else process.env.RECEIZ_OAUTH_STATE_SECRET = priorSecret;
  }
});

test("a valid local proof attempt reports remote unavailability without a browser transport error", async () => {
  const priorSecret = process.env.RECEIZ_OAUTH_STATE_SECRET;
  const priorBase = process.env.RECEIZ_BASE_URL;
  const priorFetch = globalThis.fetch;
  process.env.RECEIZ_OAUTH_STATE_SECRET = SECRET;
  process.env.RECEIZ_BASE_URL = "https://receiz.example";
  try {
    const identity = await createReceizIdIdentity({ username: "offline_probe" });
    const continuation = await buildReceizIdContinueRequest(identity, { nonceB64Url: NONCE });
    globalThis.fetch = async () => Response.json({ status: "unavailable" }, { status: 503 });

    const response = await POST(new NextRequest("https://wildz.quest/api/auth/wildz/session", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: `${WILDZ_PROOF_NONCE_COOKIE}=${NONCE}`
      },
      body: JSON.stringify(continuation)
    }));

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "unavailable" });
    assert.equal(response.cookies.get(WILDZ_PROOF_SESSION_COOKIE), undefined);
  } finally {
    globalThis.fetch = priorFetch;
    if (priorSecret === undefined) delete process.env.RECEIZ_OAUTH_STATE_SECRET;
    else process.env.RECEIZ_OAUTH_STATE_SECRET = priorSecret;
    if (priorBase === undefined) delete process.env.RECEIZ_BASE_URL;
    else process.env.RECEIZ_BASE_URL = priorBase;
  }
});

test("a valid local proof attempt treats a failed upstream connection as logical unavailability", async () => {
  const priorSecret = process.env.RECEIZ_OAUTH_STATE_SECRET;
  const priorBase = process.env.RECEIZ_BASE_URL;
  const priorFetch = globalThis.fetch;
  process.env.RECEIZ_OAUTH_STATE_SECRET = SECRET;
  process.env.RECEIZ_BASE_URL = "https://receiz.example";
  try {
    const identity = await createReceizIdIdentity({ username: "disconnected_probe" });
    const continuation = await buildReceizIdContinueRequest(identity, { nonceB64Url: NONCE });
    globalThis.fetch = async () => { throw new TypeError("fetch failed"); };

    const response = await POST(new NextRequest("https://wildz.quest/api/auth/wildz/session", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: `${WILDZ_PROOF_NONCE_COOKIE}=${NONCE}`
      },
      body: JSON.stringify(continuation)
    }));

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "unavailable" });
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.cookies.get(WILDZ_PROOF_SESSION_COOKIE), undefined);
  } finally {
    globalThis.fetch = priorFetch;
    if (priorSecret === undefined) delete process.env.RECEIZ_OAUTH_STATE_SECRET;
    else process.env.RECEIZ_OAUTH_STATE_SECRET = priorSecret;
    if (priorBase === undefined) delete process.env.RECEIZ_BASE_URL;
    else process.env.RECEIZ_BASE_URL = priorBase;
  }
});

test("a non-canonical successful upstream response grants no session and remains a logical unavailable state", async () => {
  const priorSecret = process.env.RECEIZ_OAUTH_STATE_SECRET;
  const priorBase = process.env.RECEIZ_BASE_URL;
  const priorFetch = globalThis.fetch;
  process.env.RECEIZ_OAUTH_STATE_SECRET = SECRET;
  process.env.RECEIZ_BASE_URL = "https://receiz.example";
  try {
    const identity = await createReceizIdIdentity({ username: "uncanonical_probe" });
    const continuation = await buildReceizIdContinueRequest(identity, { nonceB64Url: NONCE });
    globalThis.fetch = async () => Response.json({ status: "unavailable" });

    const response = await POST(new NextRequest("https://wildz.quest/api/auth/wildz/session", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: `${WILDZ_PROOF_NONCE_COOKIE}=${NONCE}`
      },
      body: JSON.stringify(continuation)
    }));

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "unavailable" });
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.cookies.get(WILDZ_PROOF_SESSION_COOKIE), undefined);
  } finally {
    globalThis.fetch = priorFetch;
    if (priorSecret === undefined) delete process.env.RECEIZ_OAUTH_STATE_SECRET;
    else process.env.RECEIZ_OAUTH_STATE_SECRET = priorSecret;
    if (priorBase === undefined) delete process.env.RECEIZ_BASE_URL;
    else process.env.RECEIZ_BASE_URL = priorBase;
  }
});

test("a valid local proof does not contact upstream when proof-session sealing is not configured", async () => {
  const priorStateSecret = process.env.RECEIZ_OAUTH_STATE_SECRET;
  const priorClientSecret = process.env.RECEIZ_CLIENT_SECRET;
  const priorFetch = globalThis.fetch;
  delete process.env.RECEIZ_OAUTH_STATE_SECRET;
  delete process.env.RECEIZ_CLIENT_SECRET;
  try {
    const identity = await createReceizIdIdentity({ username: "unconfigured_probe" });
    const continuation = await buildReceizIdContinueRequest(identity, { nonceB64Url: NONCE });
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      return Response.json({ ok: true });
    };

    const response = await POST(new NextRequest("https://wildz.quest/api/auth/wildz/session", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: `${WILDZ_PROOF_NONCE_COOKIE}=${NONCE}`
      },
      body: JSON.stringify(continuation)
    }));

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "unavailable" });
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.cookies.get(WILDZ_PROOF_SESSION_COOKIE), undefined);
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = priorFetch;
    if (priorStateSecret === undefined) delete process.env.RECEIZ_OAUTH_STATE_SECRET;
    else process.env.RECEIZ_OAUTH_STATE_SECRET = priorStateSecret;
    if (priorClientSecret === undefined) delete process.env.RECEIZ_CLIENT_SECRET;
    else process.env.RECEIZ_CLIENT_SECRET = priorClientSecret;
  }
});
