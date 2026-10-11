import { createReceizIdentityKeyFile, receizKaiNow, type ReceizClient } from "@receiz/sdk";
import {createMemoryWildzContinuityDatabase} from "./memory-wildz-continuity-database";
import {createWildsResourceSourceClientV128,createWildsResourceSourceRecoveryStoreV128} from "../../src/lib/receiz/wilds-resource-source-client-v128";
export async function publisherFixture(storage = createMemoryWildzContinuityDatabase()) {
  const { keyFile } = await createReceizIdentityKeyFile({ owner: { uid: "resource_client_fixture", username: "alice", displayName: "Synthetic" } });
  const now = receizKaiNow();
  const grant = { schema: "receiz.identity.proof-authority.v123" as const, applicationId: "wildz", keyId: keyFile.keyId, artifactDigest: "a".repeat(64),
    grantedScopes: ["openid", "profile", "receiz:domains.read", "receiz:domains.write", "receiz:record", "receiz:seal", "receiz:subjects.read", "receiz:subjects.write"],
    issuedAtKai: now.pulse - 1, expiresAtKai: now.pulse + 60, nonce: "synthetic", revocationHead: "b".repeat(64), tokenType: "Bearer" as const, expiresIn: 300,
    refreshable: false as const, authority: { grantIsIdentityAuthority: false as const, strongerTruth: "receiz-identity-artifact" as const }, authorityDigest: "c".repeat(64), accessToken: "never-used" };
  const authority = { grant, keyFile, ownerReceizId: "alice.receiz.id", actorSubjectId: `receiz:subject:${"d".repeat(64)}`, actorSubjectHead: "e".repeat(64) };
  const session = { authoritySessionHandle: "synthetic-only", applicationId: "wildz", audience: "wildz", actorSubjectId: authority.actorSubjectId,
    identityKeyId: keyFile.keyId, identityArtifactSha256: grant.artifactDigest, expiresAtKaiUPulse: now.uPulse + 60_000_000 };
  const sealedInputs: { bytes: Uint8Array; idempotencyKey: string }[] = [];
  const sdk = { assets: { createProofObject: async (input: { payload: { bytes: Uint8Array } }, options: { idempotencyKey: string }) => {
    sealedInputs.push({ bytes: new Uint8Array(input.payload.bytes), idempotencyKey: options.idempotencyKey });
    throw Error("synthetic lost seal response");
  } } } as unknown as ReceizClient;
  const store = createWildsResourceSourceRecoveryStoreV128(storage);
  const create = () => createWildsResourceSourceClientV128({ sdk, authority, session: session as never, recoveryStore: store });
  const page = { domainId: "world:wildz:resources:test", registryDigest: "1".repeat(64), reducerDigest: "2".repeat(64), genesisHead: "0".repeat(64), appendId: "collect:one",
    event: { commandId: "collect:one", birth: "hay:one" }, namespace: { members: { "hay:one": true } }, namespaceName: "inventory", namespaceHead: "3".repeat(64), predecessor: null };
  return { create, page, sealedInputs, authority, sdk, session, store, storage };
}
