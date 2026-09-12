import test from "node:test";
import assert from "node:assert/strict";
import { createWildsCrewMandateAuthority } from "../src/lib/receiz/wilds-crew-mandate-authority";
import { openWildsCrewSourceAuthority } from "../src/lib/receiz/wilds-crew-source-authority";

function rail() {
  const calls: unknown[] = [];
  return { calls, client: { subjectMandates: {
    issue: async (input: Readonly<Record<string, unknown>>) => { calls.push(input); return { ok: true }; },
    state: async (input: Readonly<{mandateId:string}>) => { calls.push(input); return { state: "active" }; },
    revoke: async (input: Readonly<Record<string, unknown>> & {mandateId:string}) => { calls.push(input); return { ok: true }; }
  } } };
}

test("mandate state is SDK distribution data, never authorization", async () => {
  const r = rail();
  const result = await createWildsCrewMandateAuthority(r.client).state("receiz:mandate:example");
  assert.equal(result.authority, "unverified-index");
  assert.deepEqual(r.calls, [{ mandateId: "receiz:mandate:example" }]);
});

test("forged subject rows cannot substitute for an exact source family", async () => {
  await assert.rejects(openWildsCrewSourceAuthority({
    family: { schema: "receiz.subject-source-family.v125", artifacts: [], bindings: [], familySetDigest: "0".repeat(64) },
    owner: { currentArtifactSha256: "0".repeat(64), subjectArtifactSha256: "1".repeat(64) },
    worker: { currentArtifactSha256: "2".repeat(64), subjectArtifactSha256: "3".repeat(64) }
  }));
});

test("invalid issuance performs no SDK mutation", async () => {
  const r = rail();
  const result = await createWildsCrewMandateAuthority(r.client).issue({} as never);
  assert.equal(result.ok, false);
  assert.equal("writes" in result && result.writes, 0);
  assert.equal(r.calls.length, 0);
});

test("invalid revocation performs no SDK mutation", async () => {
  const r = rail();
  const result = await createWildsCrewMandateAuthority(r.client).revoke({ mandateId: "other" } as never);
  assert.equal(result.ok, false);
  assert.equal("writes" in result && result.writes, 0);
  assert.equal(r.calls.length, 0);
});

test("SDK family transport digest cannot promote unsealed bytes into proof authority", async () => {
  const { createReceizSubjectSourceFamilyV125, digestReceizCanonicalV122 } = await import("@receiz/sdk");
  const { createHash } = await import("node:crypto");
  const bytes = new TextEncoder().encode('{"ownerReceizId":"owner","head":"claimed"}');
  const sha = createHash("sha256").update(bytes).digest("hex");
  const family = await createReceizSubjectSourceFamilyV125({
    artifacts: [{ schema: "receiz.sealed-artifact-bytes.v124", exactBytesB64u: Buffer.from(bytes).toString("base64url"),
      filename: "subject.json", mimeType: "application/json", artifactSha256: sha, payloadSha256: sha }],
    bindings: [{ currentArtifactSha256: sha, identityArtifactSha256: sha, subjectArtifactSha256: sha }]
  });
  const { familySetDigest, ...basis } = family;
  assert.equal(await digestReceizCanonicalV122(basis), familySetDigest);
  await assert.rejects(openWildsCrewSourceAuthority({ family,
    owner: { currentArtifactSha256: sha, subjectArtifactSha256: sha },
    worker: { currentArtifactSha256: sha, subjectArtifactSha256: sha }
  }));
});
