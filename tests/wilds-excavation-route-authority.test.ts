import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NextRequest } from "next/server";
import { RECEIZ_V123_REGISTRY_DIGEST, projectReceizSubjectNamespacesV123, sha256ReceizBytes } from "@receiz/sdk";
import { projectCreatureCapabilityIdentity } from "../src/features/play/creature-capability-identity";
import { admitLegacyCard, currentCreatureHistoryProjection } from "../src/features/play/living-card-proof";
import { canonicalPortableCardJson, sealCollectedCard, sha256PortableBasis } from "../src/features/play/portable-card";
import { digestWildsExcavationCapabilityIdentity } from "../src/features/play/wilds-excavation";
import { RECEIZ_WORLD_AUTHORITY_OIDC_SCOPES } from "../src/lib/receiz/oauth-scopes";
import { WILDZ_RECEIZ_SESSION_SCOPE } from "../src/lib/receiz/wildz-auth-url";
import {
  createWildzReceizIdProofSession,
  packWildzProofSession,
  WILDZ_PROOF_SESSION_COOKIE
} from "../src/lib/receiz/wildz-proof-session";
import {
  resolveWildsCapabilityNamespacesV123,
  resolveWildsExcavationRouteAuthority,
  wildsExcavationStatusFor
} from "../src/lib/receiz/wilds-excavation-route-authority";

const SECRET = "wilds-excavation-route-authority-test-secret-32-bytes";
process.env.RECEIZ_OAUTH_STATE_SECRET = SECRET;

function fixture() {
  const legacy = sealCollectedCard({ formId: "mintcub-1", ownerReceizId: "arena_player", encounterId: "excavation-route", capturedAt: "2026-08-21T11:59:00.000Z" });
  const card = admitLegacyCard(legacy, "2026-08-21T12:00:00.000Z");
  const proof = createWildzReceizIdProofSession({ keyId: "key:excavation-route", username: "arena_player", displayName: "Arena" }, SECRET);
  return { card, proof };
}

function request(scopes = RECEIZ_WORLD_AUTHORITY_OIDC_SCOPES) {
  const { proof } = fixture();
  const cookie = [
    `${WILDZ_PROOF_SESSION_COOKIE}=${packWildzProofSession(proof, SECRET)}`,
    "receiz_access_token=token:player",
    `receiz_session_scope=${WILDZ_RECEIZ_SESSION_SCOPE}`,
    `receiz_granted_scopes=${scopes.join("%20")}`
  ].join("; ");
  return new NextRequest("https://wildz.quest/api/wilds/excavation", { method: "POST", headers: { cookie } });
}

function sourceProofRequest() {
  const { proof } = fixture();
  return new NextRequest("https://wildz.quest/api/wilds/excavation", {
    method: "POST",
    headers: { cookie: `${WILDZ_PROOF_SESSION_COOKIE}=${packWildzProofSession(proof, SECRET)}` }
  });
}

function subjectArtifact(subjectId: string, ownerReceizId: string, identityDigest: string) {
  return {
    schema: "receiz.subject.v1" as const,
    subject: {
      schema: "receiz.subject.v1" as const,
      subjectId,
      proofObjectId: `proof:${subjectId}`,
      subjectType: "wildz.creature",
      ownerReceizId,
      identityDigest,
      genesisDigest: `genesis:${subjectId}`,
      createdAtKai: "123",
      head: `head:${subjectId}`,
      ownershipHead: "2".repeat(64),
      currentOwnerReceizId: ownerReceizId,
      namespaces: {}
    },
    exactBytesB64u: "ZXhhY3Q",
    artifactDigest: `artifact:${subjectId}`,
    registryDigest: RECEIZ_V123_REGISTRY_DIGEST,
    reducerDigest: "4".repeat(64),
    authority: { artifactIsProofAuthority: true as const, modelOutputIsAuthority: false as const, indexIsAuthority: false as const }
  };
}

function capabilityAtHead(card: ReturnType<typeof fixture>["card"]) {
  return {
    capabilityIdentityDigest: digestWildsExcavationCapabilityIdentity(projectCreatureCapabilityIdentity(card)),
    conditionDigest: sha256PortableBasis(canonicalPortableCardJson(currentCreatureHistoryProjection(card).condition))
  };
}

describe("authenticated Wilds excavation route authority", () => {
  it("admits excavation from the Receiz ID and exact card proof without a transport projection", async () => {
    const { card, proof } = fixture();
    const authority = await resolveWildsExcavationRouteAuthority(sourceProofRequest(), {
      card,
      actorSubjectId: proof.actorId,
      creatureSubjectId: card.id
    }, {
      loadProfile: async () => { throw new Error("transport_must_not_authorize_source"); },
      createAdapter: () => ({ resolveWorldSubject: async () => { throw new Error("projection_must_not_authorize_source"); } })
    });

    assert.equal(authority.actorSubject.subject.subjectId, proof.actorId);
    assert.equal(authority.creatureSubject.subject.subjectId, card.id);
    assert.equal(authority.card.proof.digest, card.proof.digest);
    assert.equal(authority.capability.identity.assetId, card.id);
  });

  it("treats a matching transport projection as subordinate to the same source proof", async () => {
    const { card, proof } = fixture();
    const authority = await resolveWildsExcavationRouteAuthority(request(), {
      card,
      actorSubjectId: proof.actorId,
      creatureSubjectId: card.id
    }, {
      loadProfile: async () => ({ id: "receiz:owner", handle: "arena_player.receiz.id" } as never),
      createAdapter: () => ({
        resolveWorldSubject: async (subjectId: string) => subjectArtifact(
          subjectId,
          "receiz:owner",
          subjectId === card.id ? card.proof.digest : "sha256:actor"
        ) as never
      }),
      resolveCapabilityAtHead: async () => capabilityAtHead(card)
    });
    assert.equal(authority.ownerReceizId, proof.actorId);
    assert.equal(authority.actorSubject.subject.subjectId, proof.actorId);
    assert.equal(authority.creatureSubject.subject.subjectId, card.id);
    assert.equal(authority.capability.identity.assetId, card.id);
  });

  it("rejects actor injection while missing scopes and remote admission cannot demote the source", async () => {
    const { card, proof } = fixture();
    const dependencies = {
      loadProfile: async () => ({ id: "receiz:owner", handle: "arena_player.receiz.id" } as never),
      createAdapter: () => ({ resolveWorldSubject: async () => { throw new Error("404"); } })
    };
    const withoutScopes = await resolveWildsExcavationRouteAuthority(request(RECEIZ_WORLD_AUTHORITY_OIDC_SCOPES.slice(1)), {
      card, actorSubjectId: proof.actorId, creatureSubjectId: card.id
    }, dependencies);
    assert.equal(withoutScopes.card.proof.digest, card.proof.digest);
    await assert.rejects(resolveWildsExcavationRouteAuthority(request(), {
      card, actorSubjectId: "explorer:injected", creatureSubjectId: card.id
    }, dependencies), /actor_subject_invalid/);
    const withoutRemoteSubject = await resolveWildsExcavationRouteAuthority(request(), {
      card, actorSubjectId: proof.actorId, creatureSubjectId: card.id
    }, dependencies);
    assert.equal(withoutRemoteSubject.creatureSubject.subject.subjectId, card.id);
  });

  it("derives capability and condition from the exact card when namespaces are absent or stale", async () => {
    const { card, proof } = fixture();
    const base = {
      loadProfile: async () => ({ id: "receiz:owner", handle: "arena_player.receiz.id" } as never),
      createAdapter: () => ({
        resolveWorldSubject: async (subjectId: string) => subjectArtifact(
          subjectId,
          "receiz:owner",
          subjectId === card.id ? card.proof.digest : "sha256:actor"
        ) as never
      })
    };
    const input = { card, actorSubjectId: proof.actorId, creatureSubjectId: card.id };
    const absent = await resolveWildsExcavationRouteAuthority(request(), input, base);
    const stale = await resolveWildsExcavationRouteAuthority(request(), input, {
      ...base,
      resolveCapabilityAtHead: async () => ({ ...capabilityAtHead(card), conditionDigest: "tampered" })
    });
    assert.equal(absent.capability.conditionDigest, capabilityAtHead(card).conditionDigest);
    assert.equal(stale.capability.conditionDigest, capabilityAtHead(card).conditionDigest);
  });

  it("uses the installed V123 exact-head namespace rail without a test-only resolver", async () => {
    const { card, proof } = fixture();
    const identity = projectCreatureCapabilityIdentity(card);
    const condition = currentCreatureHistoryProjection(card).condition;
    const namespaceEntry = async (namespace: string, value: unknown) => {
      const bytes = new TextEncoder().encode(canonicalPortableCardJson(value));
      return { namespace, exactBytesB64u: Buffer.from(bytes).toString("base64url"), digest: await sha256ReceizBytes(bytes) };
    };
    const resolution = await projectReceizSubjectNamespacesV123({
      subjectId: card.id,
      head: `head:${card.id}`,
      admittedProofDigest: card.proof.digest.replace(/^sha256:/, ""),
      ownershipHead: "2".repeat(64),
      registryDigest: RECEIZ_V123_REGISTRY_DIGEST,
      reducerDigest: "4".repeat(64),
      opaqueNamespaces: [await namespaceEntry("abilities", identity), await namespaceEntry("condition", condition)]
    }, ["abilities", "condition"]);
    const atHead = await resolveWildsCapabilityNamespacesV123({ resolveSubjectNamespacesV123: async () => resolution }, {
      subjectId: card.id,
      subjectHead: `head:${card.id}`,
      admittedProofDigest: card.proof.digest.replace(/^sha256:/, ""),
      ownershipHead: "2".repeat(64),
      registryDigest: RECEIZ_V123_REGISTRY_DIGEST,
      reducerDigest: "4".repeat(64)
    });
    assert.equal(atHead.conditionDigest, capabilityAtHead(card).conditionDigest);
    await assert.rejects(resolveWildsCapabilityNamespacesV123({
      resolveSubjectNamespacesV123: async () => resolution
    }, {
      subjectId: card.id,
      subjectHead: `head:${card.id}`,
      admittedProofDigest: card.proof.digest.replace(/^sha256:/, ""),
      ownershipHead: "9".repeat(64),
      registryDigest: RECEIZ_V123_REGISTRY_DIGEST,
      reducerDigest: "4".repeat(64)
    }), /receiz_subject_namespace_authority_required/);
  });

  it("maps authenticated but invalid namespace JSON to the explicit fail-closed authority code", async () => {
    const bytes = new TextEncoder().encode("not-json");
    const resolution = await projectReceizSubjectNamespacesV123({
      subjectId: "subject:creature",
      head: "1".repeat(64),
      admittedProofDigest: "2".repeat(64),
      ownershipHead: "3".repeat(64),
      registryDigest: RECEIZ_V123_REGISTRY_DIGEST,
      reducerDigest: "5".repeat(64),
      opaqueNamespaces: [
        { namespace: "abilities", exactBytesB64u: Buffer.from(bytes).toString("base64url"), digest: await sha256ReceizBytes(bytes) },
        { namespace: "condition", exactBytesB64u: Buffer.from(bytes).toString("base64url"), digest: await sha256ReceizBytes(bytes) }
      ]
    }, ["abilities", "condition"]);
    await assert.rejects(resolveWildsCapabilityNamespacesV123({
      resolveSubjectNamespacesV123: async () => resolution
    }, { subjectId: "subject:creature", subjectHead: "1".repeat(64) }), /receiz_subject_namespace_authority_required/);
  });

  it("keeps remote subject failures as sync concerns instead of source authorization", async () => {
    const { card, proof } = fixture();
    const input = { card, actorSubjectId: proof.actorId, creatureSubjectId: card.id };
    const dependencies = (cause: Error & { status?: number }) => ({
      loadProfile: async () => ({ id: "receiz:owner", handle: "arena_player.receiz.id" } as never),
      createAdapter: () => ({ resolveWorldSubject: async () => { throw cause; } })
    });
    for (const cause of [
      Object.assign(new Error("subject not found"), { status: 404 }),
      Object.assign(new Error("token revoked"), { status: 401 }),
      Object.assign(new Error("upstream unavailable"), { status: 503 })
    ]) {
      const authority = await resolveWildsExcavationRouteAuthority(request(), input, dependencies(cause));
      assert.equal(authority.card.proof.digest, card.proof.digest);
    }
  });

  it("keeps remote profile failures as sync concerns instead of source authorization", async () => {
    const { card, proof } = fixture();
    const input = { card, actorSubjectId: proof.actorId, creatureSubjectId: card.id };
    const dependencies = (cause: Error & { status?: number }) => ({
      loadProfile: async () => { throw cause; },
      createAdapter: () => ({ resolveWorldSubject: async () => { throw new Error("must not resolve subjects"); } })
    });
    const revoked = await resolveWildsExcavationRouteAuthority(request(), input, dependencies(Object.assign(new Error("token revoked"), { status: 401 })));
    const unavailable = await resolveWildsExcavationRouteAuthority(request(), input, dependencies(Object.assign(new Error("profile upstream unavailable"), { status: 503 })));
    assert.equal(revoked.ownerReceizId, proof.actorId);
    assert.equal(unavailable.ownerReceizId, proof.actorId);
  });

  it("maps authority failures without disguising foreign ownership or upstream failures as missing admission", () => {
    assert.equal(wildsExcavationStatusFor("wilds_card_owner_invalid"), 403);
    assert.equal(wildsExcavationStatusFor("receiz_remote_subject_admission_required"), 409);
    assert.equal(wildsExcavationStatusFor("receiz_subject_namespace_authority_required"), 503);
    assert.equal(wildsExcavationStatusFor("receiz_subject_resolution_unavailable"), 503);
    assert.equal(wildsExcavationStatusFor("receiz_profile_resolution_unavailable"), 503);
    assert.equal(wildsExcavationStatusFor("receiz_authority_required"), 401);
    assert.equal(wildsExcavationStatusFor("malformed_remote_subject"), 502);
  });
});
