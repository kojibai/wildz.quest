import assert from "node:assert/strict";
import { test } from "node:test";
import type { ReceizKeyFile } from "@receiz/sdk";
import { WildsWorldService } from "../src/features/play/wilds-world-service";
import {
  createWildsWorldIdentityPublicationDraft,
  publishWildsWorldWithIdentityProof
} from "../src/lib/receiz/wilds-world-identity-publication";

function record() {
  const world = new WildsWorldService();
  const pulse = "2026-07-15T00:00:00.000Z";
  world.tick({ pulse, occurredAt: pulse, systemActorId: "receiz:pulse" });
  world.tickEcology({ pulse, occurredAt: pulse, systemActorId: "receiz:pulse" });
  return { checkpoint: world.checkpoint(), eventTail: world.events() };
}

const session = {
  schema: "receiz.wildz.identity_session.v1" as const,
  keyId: "receiz_key_player_12345678",
  actorId: "bjklock",
  username: "bjklock",
  displayName: "BJK",
  portableStateStatus: "verified" as const,
  localAuthority: "verified" as const,
  remoteStatus: "connected" as const
};

test("world publication draft is public deterministic state and carries no delegated or private authority", () => {
  const draft = createWildsWorldIdentityPublicationDraft({
    sourceUrl: "https://wildz.quest/api/wilds/world/snapshot",
    merchantReceizId: "bjklock.receiz.id",
    record: record(),
    expectedHead: { revision: 0, lastEventId: null }
  });

  assert.equal(draft.schema, "receiz.wildz_world_identity_publication.v1");
  assert.equal(draft.tenantHost, "wildz.quest");
  assert.equal(draft.namespace, "wilds:global:v3");
  assert.match(draft.idempotencyKey, /^wilds:global:v3:/);
  const serialized = JSON.stringify(draft);
  assert.doesNotMatch(serialized, /accessToken|bearer|connectUrl|keyFile|passphrase|privateKey/i);
});

test("Identity Seal publication uses the SDK proof rail and returns its Kai causal coordinate", async () => {
  const keyFile = {
    keyId: session.keyId,
    crypto: { privateKeyPkcs8B64u: "private", privateKeyPkcs8CiphertextB64u: "" }
  } as ReceizKeyFile;
  const draft = createWildsWorldIdentityPublicationDraft({
    sourceUrl: "https://wildz.quest/api/wilds/world/snapshot",
    merchantReceizId: "bjklock.receiz.id",
    record: record(),
    expectedHead: { revision: 0, lastEventId: null }
  });
  let signedInput: Record<string, unknown> | undefined;
  let idempotencyKey = "";
  const result = await publishWildsWorldWithIdentityProof(session, draft, {
    repository: {
      withKeyFile: async (_keyId, operation) => operation(keyFile)
    },
    adapterFactory: async () => ({
      publishPublicStoreWithIdentityProof: async (input, options) => {
        signedInput = input as unknown as Record<string, unknown>;
        idempotencyKey = options?.idempotencyKey ?? "";
        return {
          ok: true,
          storeStateRecordId: "world:1",
          tenantHost: "wildz.quest",
          kaiPulse: "424242",
          appendAnchorId: "anchor:424242",
          appendProof: {},
          knownHead: { afterKaiUpulse: "424242", appendAnchorId: "anchor:424242" }
        };
      }
    })
  });

  assert.equal(signedInput?.keyFile, keyFile);
  assert.deepEqual(signedInput?.storeStateRecord, draft.storeStateRecord);
  assert.equal(signedInput?.merchantReceizId, "bjklock.receiz.id");
  assert.equal(idempotencyKey, draft.idempotencyKey);
  assert.deepEqual(result.causality, {
    kaiPulse: "424242",
    afterKaiUpulse: "424242",
    appendAnchorId: "anchor:424242"
  });
});

test("proof-sealed vaults cannot fabricate an Identity Seal signer", async () => {
  await assert.rejects(() => publishWildsWorldWithIdentityProof({
    ...session,
    keyId: `receiz_vault_${"a".repeat(32)}`,
    localAuthority: "proof-sealed-vault",
    portableStateStatus: "missing"
  }, createWildsWorldIdentityPublicationDraft({
    sourceUrl: "https://wildz.quest/api/wilds/world/snapshot",
    merchantReceizId: "bjklock.receiz.id",
    record: record(),
    expectedHead: { revision: 0, lastEventId: null }
  })), /wilds_world_identity_seal_required/);
});
