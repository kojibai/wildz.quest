import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NextRequest } from "next/server";
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
      ownershipHead: `ownership:${subjectId}`,
      currentOwnerReceizId: ownerReceizId,
      namespaces: {}
    },
    exactBytesB64u: "ZXhhY3Q",
    artifactDigest: `artifact:${subjectId}`,
    registryDigest: "registry:v121",
    reducerDigest: "reducer:v121",
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
  it("binds the encrypted identity session, exact scoped bearer, admitted owned card, and durable remote subjects", async () => {
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
    assert.equal(authority.ownerReceizId, "receiz:owner");
    assert.equal(authority.actorSubject.subject.subjectId, proof.actorId);
    assert.equal(authority.creatureSubject.subject.subjectId, card.id);
    assert.equal(authority.capability.identity.assetId, card.id);
  });

  it("rejects missing scopes, subject injection, and missing remote admission with zero fallback", async () => {
    const { card, proof } = fixture();
    const dependencies = {
      loadProfile: async () => ({ id: "receiz:owner", handle: "arena_player.receiz.id" } as never),
      createAdapter: () => ({ resolveWorldSubject: async () => { throw new Error("404"); } })
    };
    await assert.rejects(resolveWildsExcavationRouteAuthority(request(RECEIZ_WORLD_AUTHORITY_OIDC_SCOPES.slice(1)), {
      card, actorSubjectId: proof.actorId, creatureSubjectId: card.id
    }, dependencies), /scope_required/);
    await assert.rejects(resolveWildsExcavationRouteAuthority(request(), {
      card, actorSubjectId: "explorer:injected", creatureSubjectId: card.id
    }, dependencies), /actor_subject_invalid/);
    await assert.rejects(resolveWildsExcavationRouteAuthority(request(), {
      card, actorSubjectId: proof.actorId, creatureSubjectId: card.id
    }, dependencies), /remote_subject_admission_required/);
  });

  it("fails closed until capability and condition namespaces are resolved at the exact remote subject head", async () => {
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
    await assert.rejects(resolveWildsExcavationRouteAuthority(request(), input, base), /subject_namespace_authority_required/);
    await assert.rejects(resolveWildsExcavationRouteAuthority(request(), input, {
      ...base,
      resolveCapabilityAtHead: async () => ({ ...capabilityAtHead(card), conditionDigest: "tampered" })
    }), /capability_binding_invalid/);
  });

  it("distinguishes missing subjects from revoked authority and unavailable subject resolution", async () => {
    const { card, proof } = fixture();
    const input = { card, actorSubjectId: proof.actorId, creatureSubjectId: card.id };
    const dependencies = (cause: Error & { status?: number }) => ({
      loadProfile: async () => ({ id: "receiz:owner", handle: "arena_player.receiz.id" } as never),
      createAdapter: () => ({ resolveWorldSubject: async () => { throw cause; } })
    });
    await assert.rejects(resolveWildsExcavationRouteAuthority(request(), input, dependencies(Object.assign(new Error("subject not found"), { status: 404 }))), /remote_subject_admission_required/);
    await assert.rejects(resolveWildsExcavationRouteAuthority(request(), input, dependencies(Object.assign(new Error("token revoked"), { status: 401 }))), /authority_required/);
    await assert.rejects(resolveWildsExcavationRouteAuthority(request(), input, dependencies(Object.assign(new Error("upstream unavailable"), { status: 503 }))), /subject_resolution_unavailable/);
  });

  it("classifies revoked and unavailable profile resolution before subject admission", async () => {
    const { card, proof } = fixture();
    const input = { card, actorSubjectId: proof.actorId, creatureSubjectId: card.id };
    const dependencies = (cause: Error & { status?: number }) => ({
      loadProfile: async () => { throw cause; },
      createAdapter: () => ({ resolveWorldSubject: async () => { throw new Error("must not resolve subjects"); } })
    });
    await assert.rejects(resolveWildsExcavationRouteAuthority(request(), input, dependencies(Object.assign(new Error("token revoked"), { status: 401 }))), /authority_required/);
    await assert.rejects(resolveWildsExcavationRouteAuthority(request(), input, dependencies(Object.assign(new Error("profile upstream unavailable"), { status: 503 }))), /profile_resolution_unavailable/);
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
