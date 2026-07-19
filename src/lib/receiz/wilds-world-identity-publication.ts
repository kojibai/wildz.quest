import type {
  JsonObject,
  ReceizKeyFile,
  ReceizPublicStoreAppendResult,
  ReceizPublicStoreSignedPublishInput
} from "@receiz/sdk";
import { canonicalPortableCardJson } from "../../features/play/portable-card";
import { findWildsWorldRecord, type WildsWorldRecord } from "../../features/play/wilds-world-record";
import type { WildzIdentityRepository, WildzIdentitySession } from "./wildz-identity-repository";
import type { WildsWorldHead } from "./wilds-world-repository";

export type WildsWorldIdentityPublicationDraft = {
  schema: "receiz.wildz_world_identity_publication.v1";
  tenantHost: string;
  merchantReceizId: string;
  title: "Receiz Wildz canonical world";
  sourceUrl: string;
  namespace: "wilds:global:v3";
  projectionState: "published";
  platform: "Wildz";
  storeStateRecord: WildsWorldRecord;
  expectedHead: WildsWorldHead;
  idempotencyKey: string;
};

type IdentityRepository = Pick<WildzIdentityRepository, "withKeyFile">;
type IdentityProofPublisher = {
  publishPublicStoreWithIdentityProof(
    input: ReceizPublicStoreSignedPublishInput<JsonObject>,
    options?: { idempotencyKey?: string }
  ): Promise<ReceizPublicStoreAppendResult>;
};

function publicationLastEventId(record: WildsWorldRecord) {
  return record.checkpoint.lastEventId ?? "genesis";
}

export function createWildsWorldIdentityPublicationDraft(input: {
  sourceUrl: string;
  merchantReceizId: string;
  record: WildsWorldRecord;
  expectedHead: WildsWorldHead;
}): WildsWorldIdentityPublicationDraft {
  const url = new URL(input.sourceUrl);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1"))) {
    throw new Error("wilds_world_publication_origin_invalid");
  }
  if (!/^[a-z0-9][a-z0-9._-]{0,63}\.receiz\.id$/.test(input.merchantReceizId)) {
    throw new Error("wilds_world_publication_receiz_id_invalid");
  }
  const record = findWildsWorldRecord(input.record);
  if (!record || record.checkpoint.revision < 1) throw new Error("wilds_world_publication_record_invalid");
  return {
    schema: "receiz.wildz_world_identity_publication.v1",
    tenantHost: url.host,
    merchantReceizId: input.merchantReceizId,
    title: "Receiz Wildz canonical world",
    sourceUrl: url.toString(),
    namespace: "wilds:global:v3",
    projectionState: "published",
    platform: "Wildz",
    storeStateRecord: record,
    expectedHead: { ...input.expectedHead },
    idempotencyKey: `wilds:global:v3:${record.checkpoint.revision}:${publicationLastEventId(record)}`
  };
}

export function parseWildsWorldIdentityPublicationDraft(value: unknown): WildsWorldIdentityPublicationDraft {
  if (!value || typeof value !== "object") throw new Error("wilds_world_publication_draft_invalid");
  const draft = value as Partial<WildsWorldIdentityPublicationDraft>;
  const record = findWildsWorldRecord(draft.storeStateRecord);
  const expectedHead = draft.expectedHead;
  if (draft.schema !== "receiz.wildz_world_identity_publication.v1"
    || typeof draft.sourceUrl !== "string"
    || typeof draft.merchantReceizId !== "string"
    || draft.title !== "Receiz Wildz canonical world"
    || draft.namespace !== "wilds:global:v3"
    || draft.projectionState !== "published"
    || draft.platform !== "Wildz"
    || !record
    || !expectedHead
    || !Number.isSafeInteger(expectedHead.revision)
    || (typeof expectedHead.lastEventId !== "string" && expectedHead.lastEventId !== null)
    || typeof draft.idempotencyKey !== "string") {
    throw new Error("wilds_world_publication_draft_invalid");
  }
  const canonical = createWildsWorldIdentityPublicationDraft({
    sourceUrl: draft.sourceUrl,
    merchantReceizId: draft.merchantReceizId,
    record,
    expectedHead
  });
  if (canonicalPortableCardJson(canonical) !== canonicalPortableCardJson(draft)) {
    throw new Error("wilds_world_publication_draft_invalid");
  }
  return canonical;
}

function identityKeyNeedsPassphrase(keyFile: ReceizKeyFile) {
  return !keyFile.crypto.privateKeyPkcs8B64u
    && keyFile.crypto.privateKeyPkcs8CiphertextB64u.length > 0;
}

export async function publishWildsWorldWithIdentityProof(
  session: WildzIdentitySession,
  value: unknown,
  options: {
    repository?: IdentityRepository;
    adapterFactory?: () => Promise<IdentityProofPublisher>;
    passphrase?: string;
    requestPassphrase?: () => string | null;
  } = {}
) {
  if (session.localAuthority !== "verified") throw new Error("wilds_world_identity_seal_required");
  const draft = parseWildsWorldIdentityPublicationDraft(value);
  if (draft.merchantReceizId !== `${session.actorId}.receiz.id`) {
    throw new Error("wilds_world_publication_identity_mismatch");
  }
  const repository = options.repository ?? (await import("./wildz-identity-adapter")).defaultIdentityRepository;
  const adapterFactory = options.adapterFactory ?? (async () => (
    await import("./adapter")
  ).createReceizCommerceAdapter());
  return repository.withKeyFile(session.keyId, async (keyFile) => {
    if (keyFile.keyId !== session.keyId) throw new Error("wilds_world_publication_identity_mismatch");
    let passphrase = options.passphrase;
    if (identityKeyNeedsPassphrase(keyFile) && passphrase === undefined) {
      passphrase = options.requestPassphrase?.()
        ?? (typeof window !== "undefined"
          ? window.prompt("Enter this Identity Seal's passphrase to publish the Kai world transition.") ?? undefined
          : undefined);
    }
    if (identityKeyNeedsPassphrase(keyFile) && passphrase === undefined) {
      throw new Error("wilds_identity_passphrase_required");
    }
    const publisher = await adapterFactory();
    const result = await publisher.publishPublicStoreWithIdentityProof({
      tenantHost: draft.tenantHost,
      merchantReceizId: draft.merchantReceizId,
      title: draft.title,
      sourceUrl: draft.sourceUrl,
      namespace: draft.namespace,
      projectionState: draft.projectionState,
      platform: draft.platform,
      storeStateRecord: draft.storeStateRecord as unknown as JsonObject,
      keyFile,
      ...(passphrase !== undefined ? { passphrase } : {})
    }, { idempotencyKey: draft.idempotencyKey });
    if (result.ok !== true
      || !result.kaiPulse
      || !result.appendAnchorId
      || !result.knownHead?.afterKaiUpulse
      || result.knownHead.appendAnchorId !== result.appendAnchorId) {
      throw new Error("wilds_world_identity_publication_unacknowledged");
    }
    return {
      result,
      causality: {
        kaiPulse: result.kaiPulse,
        afterKaiUpulse: result.knownHead.afterKaiUpulse,
        appendAnchorId: result.appendAnchorId
      }
    };
  });
}

export async function publishActiveWildsWorldWithIdentityProof(
  value: unknown,
  options: Parameters<typeof publishWildsWorldWithIdentityProof>[2] = {}
) {
  const repository = options.repository ?? (await import("./wildz-identity-adapter")).defaultIdentityRepository;
  if (!("active" in repository) || typeof repository.active !== "function") {
    throw new Error("wilds_world_identity_session_required");
  }
  const session = await repository.active();
  if (!session) throw new Error("wilds_world_identity_session_required");
  return publishWildsWorldWithIdentityProof(session, value, { ...options, repository });
}
