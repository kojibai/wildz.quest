import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";
import { RECEIZ_SDK_VERSION, createReceizProofAuthorityChallenge, readReceizIdentityArtifact, receizKaiNow, receizOidcScopesForRails, type ReceizProofAuthorityChallengeV123 } from "@receiz/sdk";
import type { ReceizCommerceAdapter } from "./adapter";
import type { WildsWalletReadAuthority } from "./wilds-wallet-route-authority";
import type { WildsWalletTransferRouteRuntime } from "./wilds-wallet-route-handlers";
import { normalizeWildsWalletPublicUsername } from "./wilds-wallet-projections";
import { wildsWalletTransferConsentStatementDigest } from "./wilds-wallet-transfer-consent";
import { createWildzReceizChatClient, type WildzReceizChatSession } from "./wildz-receiz-chat-session";
import { receizOAuthSecret } from "./oauth-state";

type Rail = Pick<ReceizCommerceAdapter, "walletSummary" | "connectTransfer" | "exchangeProofAuthorityV123" | "introspectAccessToken">;
const PURPOSE = "wildz.wallet.connect-attempt.v1";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HASH = /^[a-f0-9]{64}$/;
const MICRO = /^[1-9][0-9]{0,29}$/;
type Attempt = Readonly<{ schema: "wildz.wallet.connect-attempt.v1"; applicationId: string; ownerReceizId: string; actorId: string; profileHandle: string; keyId: string; recipientUsername: string; recipientUserId: string; conversationId: string; amountPhiMicro: string; quotedUsdCents: string; clientNonce: string; operationNonce: string; note: string; issuedAtKai: number; reviewExpiresAtKai: number }>;
function record(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function key(secret: string) { return createHash("sha256").update(PURPOSE).update("\0").update(secret).digest(); }
function seal(attempt: unknown, secret: string, version = "v3") {
  const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", key(secret), iv); cipher.setAAD(Buffer.from(PURPOSE));
  const bytes = Buffer.concat([cipher.update(JSON.stringify(attempt), "utf8"), cipher.final()]);
  return `${version}.${iv.toString("base64url")}.${bytes.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}`;
}
function decrypt(value: string, secret: string, version: "v2" | "v3" | "nw1"): unknown {
  if (!new RegExp(`^${version}\\.[A-Za-z0-9_-]{16}\\.[A-Za-z0-9_-]{2,3600}\\.[A-Za-z0-9_-]{22}$`).test(value)) throw new Error("shape");
  const [, iv, bytes, tag] = value.split("."); const decipher = createDecipheriv("aes-256-gcm", key(secret), Buffer.from(iv, "base64url"));
  decipher.setAAD(Buffer.from(PURPOSE)); decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(bytes, "base64url")), decipher.final()]).toString("utf8"));
}
function open(value: string, secret: string): Attempt {
  try {
    const item = decrypt(value, secret, "v3") as Attempt;
    if (item.schema !== PURPOSE || typeof item.applicationId !== "string" || !item.applicationId.trim() || item.applicationId.length > 256 || !UUID.test(item.ownerReceizId) || !UUID.test(item.recipientUserId) || !UUID.test(item.conversationId) || !HASH.test(item.keyId)
      || item.ownerReceizId === item.recipientUserId || !MICRO.test(item.amountPhiMicro) || !/^\d{1,30}$/.test(item.quotedUsdCents)
      || !/^wildz-wallet-connect:[a-f0-9]{64}$/.test(item.clientNonce) || item.note !== `Wildz payment reference ${item.clientNonce.slice(21)}`
      || typeof item.operationNonce !== "string" || !/^[A-Za-z0-9_-]{8,128}$/.test(item.operationNonce)
      || normalizeWildsWalletPublicUsername(item.recipientUsername) !== item.recipientUsername || normalizeWildsWalletPublicUsername(item.actorId) !== item.actorId
      || normalizeWildsWalletPublicUsername(item.profileHandle) !== item.actorId || !Number.isSafeInteger(item.issuedAtKai) || !Number.isSafeInteger(item.reviewExpiresAtKai) || item.reviewExpiresAtKai <= item.issuedAtKai) throw new Error("payload");
    return Object.freeze(item);
  } catch { throw new Error("wilds_wallet_transfer_attempt_invalid"); }
}
function phiAmount(micro: string) { const amount = BigInt(micro); return `${amount / 1_000_000n}.${(amount % 1_000_000n).toString().padStart(6, "0")}`; }

/** Compose the released connected-wallet transaction, preserving its actual wallet and chat sources. */
export function createWildsWalletConnectTransferRuntime(input: { session: WildzReceizChatSession | null; createAdapter(accessToken: string): Rail; fetchImpl?: typeof fetch; secret?: string; applicationId?: string; currentKai?: () => number }): WildsWalletTransferRouteRuntime {
  const secret = input.secret ?? receizOAuthSecret(); const currentKai = input.currentKai ?? (() => receizKaiNow().pulse);
  const applicationId = input.applicationId ?? process.env.RECEIZ_CLIENT_ID?.trim() ?? "";
  const sessionFor = (authority: WildsWalletReadAuthority) => {
    const session = input.session;
    if (!session) throw new Error("receiz_wallet_connect_session_required");
    if (session.userId !== authority.ownerReceizId || normalizeWildsWalletPublicUsername(session.profileHandle) !== normalizeWildsWalletPublicUsername(authority.profileHandle)) throw new Error("wilds_wallet_transfer_attempt_identity_mismatch");
    return session;
  };
  const bound = (authority: WildsWalletReadAuthority, value: string) => {
    const attempt = open(value, secret); const session = sessionFor(authority);
    if (attempt.ownerReceizId !== authority.ownerReceizId || attempt.actorId !== authority.actorId || attempt.profileHandle !== authority.profileHandle || attempt.keyId !== session.keyId) throw new Error("wilds_wallet_transfer_attempt_identity_mismatch");
    return { attempt, session };
  };
  const projection = (status: "committed" | "unknown", attempt: Attempt) => Object.freeze({ status, rail: "settlement" as const, amountPhiMicro: attempt.amountPhiMicro, recipientUsername: attempt.recipientUsername });
  const observationBinding=(authority:WildsWalletReadAuthority,command:{attempt:string;senderHandle:string;recipientHandle:string;amountPhiMicro:string;operationNonce:string})=>{
    const attempt=open(command.attempt,secret),session=sessionFor(authority);
    if(attempt.actorId!==normalizeWildsWalletPublicUsername(command.senderHandle)||attempt.recipientUsername!==normalizeWildsWalletPublicUsername(command.recipientHandle)||attempt.amountPhiMicro!==command.amountPhiMicro||attempt.operationNonce!==command.operationNonce)throw Error("wilds_wallet_transfer_consent_binding_invalid");
    if(authority.ownerReceizId===attempt.ownerReceizId)bound(authority,command.attempt);
    else if(authority.ownerReceizId!==attempt.recipientUserId||normalizeWildsWalletPublicUsername(authority.profileHandle)!==attempt.recipientUsername)throw Error("wilds_wallet_transfer_attempt_identity_mismatch");
    return {attempt,session};
  };
  const noWriteBasis=(attempt:Attempt,value:string)=>({schema:"wildz.wallet.connect-zero-write.v1",attemptDigest:createHash("sha256").update(value).digest("hex"),clientNonce:attempt.clientNonce,ownerReceizId:attempt.ownerReceizId,recipientUserId:attempt.recipientUserId,keyId:attempt.keyId,amountPhiMicro:attempt.amountPhiMicro,operationNonce:attempt.operationNonce,reviewExpiresAtKai:attempt.reviewExpiresAtKai,code:"INSUFFICIENT_VALUE"});
  const resolveRecipient = async (authority: WildsWalletReadAuthority, username: string) => {
    const session = sessionFor(authority);
    if (username === normalizeWildsWalletPublicUsername(authority.profileHandle)) throw new Error("receiz_wallet_recipient_unavailable");
    const envelope = record(await createWildzReceizChatClient(session, input.fetchImpl).request<unknown>("/api/chat/conversations", { method: "POST", bearerToken: null, body: { kind: "dm", participantUsernames: [username] } }));
    const conversation = record(envelope.conversation);
    const members = Array.isArray(conversation.members) ? conversation.members.map(record).filter(member => member.kind === "user") : [];
    const owner = members.find(member => member.userId === authority.ownerReceizId);
    const peer = members.find(member => member.userId !== authority.ownerReceizId);
    if (envelope.ok !== true || conversation.kind !== "dm" || typeof conversation.id !== "string" || !UUID.test(conversation.id) || members.length !== 2 || !owner || normalizeWildsWalletPublicUsername(owner.username) !== authority.actorId || typeof peer?.userId !== "string" || !UUID.test(peer.userId) || normalizeWildsWalletPublicUsername(peer.username) !== username) throw new Error("receiz_wallet_recipient_unavailable");
    return { conversationId: conversation.id, recipientUserId: peer.userId };
  };
  const matchesMessage = (value: unknown, attempt: Attempt, expectedMessageId?: string, expectedTransferId?: string) => {
    const message = record(value); const transfer = record(message.walletTransfer); const original = record(message.sealedOriginal); const originalTransfer = record(original.walletTransfer);
    return typeof message.id === "string" && UUID.test(message.id) && (!expectedMessageId || message.id === expectedMessageId)
      && message.conversationId === attempt.conversationId && message.senderUserId === attempt.ownerReceizId
      && transfer.kind === "chat_transfer" && typeof transfer.transferId === "string" && UUID.test(transfer.transferId) && (!expectedTransferId || transfer.transferId === expectedTransferId)
      && transfer.senderUserId === attempt.ownerReceizId && transfer.recipientUserId === attempt.recipientUserId && transfer.amountPhiMicro === attempt.amountPhiMicro && transfer.note === attempt.note
      && original.version === 1 && original.primitive === "receiz.chat.message.original.v1" && original.messageId === message.id && original.conversationId === attempt.conversationId && original.senderUserId === attempt.ownerReceizId
      && originalTransfer.kind === "chat_transfer" && originalTransfer.senderUserId === attempt.ownerReceizId && originalTransfer.recipientUserId === attempt.recipientUserId && originalTransfer.amountPhiMicro === attempt.amountPhiMicro && originalTransfer.note === attempt.note
      && typeof original.receiptDigest === "string" && HASH.test(original.receiptDigest) && typeof original.payloadDigest === "string" && HASH.test(original.payloadDigest) && typeof original.originDigest === "string" && HASH.test(original.originDigest);
  };
  const observe = async (attempt: Attempt, session: WildzReceizChatSession, expectedMessageId?: string, expectedTransferId?: string) => {
    const client = createWildzReceizChatClient(session, input.fetchImpl);
    let before: string | null = null;
    // A missing page is uncertainty, never evidence of zero financial writes.
    for (let page = 0; page < 8; page += 1) {
      const query = new URLSearchParams({ limit: "300", ...(before ? { before } : {}) });
      const response = record(await client.request(`/api/chat/conversations/${attempt.conversationId}/messages?${query}`, { bearerToken: null }));
      if (response.ok !== true || record(response.conversation).id !== attempt.conversationId || !Array.isArray(response.messages)) throw new Error("receiz_wallet_connect_receipt_unavailable");
      const matches = response.messages.filter(message => matchesMessage(message, attempt, expectedMessageId, expectedTransferId));
      if (matches.length === 1) return true;
      if (matches.length > 1) throw new Error("receiz_wallet_connect_receipt_ambiguous");
      if(typeof response.hasMore!=="boolean")throw Error("receiz_wallet_connect_receipt_unavailable");
      if (response.hasMore === false) return false;
      if (typeof response.nextCursor !== "string" || !Number.isFinite(Date.parse(response.nextCursor)) || response.nextCursor === before) throw Error("receiz_wallet_connect_receipt_unavailable");
      before = response.nextCursor;
    }
    return null;
  };
  const runtime: WildsWalletTransferRouteRuntime = {
    durable: true as const,
    recipientLookupAdmission: "connect-chat" as const,
    async capabilityAdmission(authority) {
      let available = false; try { sessionFor(authority); available = Boolean(applicationId); } catch { /* Read and loading remain available. */ }
      return { sdkVersion: RECEIZ_SDK_VERSION, connectWallet: available, rails: { proofAuthorityExchange: true, settlementExecution: false, reserveExecution: false, valueExecutionRecovery: false, worldPlanning: false, worldExecution: false, subjectNamespaces: false }, grantedScopes: [] };
    },
    async recipient(authority, username) {
      await resolveRecipient(authority, normalizeWildsWalletPublicUsername(username));
      return { username, profileMark: null, allowedTransferKinds: ["phi"] };
    },
    async preview(authority, command) {
      const session = sessionFor(authority);
      if (!applicationId) throw new Error("receiz_wallet_transfer_dependencies_unavailable");
      if (command.rail !== "settlement") throw new Error("receiz_wallet_phi_scope_required");
      let recipientUsername = command.recipientUsername;
      if (!recipientUsername && command.recipientLocator) {
        try {
          const locator = record(decrypt(command.recipientLocator.replace(/^wildz:receive:/, ""), secret, "v2"));
          if (locator.schema !== "wildz.wallet.connect-receive.v1" || typeof locator.username !== "string" || !Number.isSafeInteger(locator.expiresAtKai) || Number(locator.expiresAtKai) <= currentKai()) throw new Error("expired");
          recipientUsername = locator.username;
        } catch { throw new Error("wilds_wallet_receive_locator_invalid"); }
      }
      if (!recipientUsername || !MICRO.test(command.amountPhiMicro) || !/^[A-Za-z0-9_-]{8,128}$/.test(command.operationNonce)) throw new Error("wilds_wallet_transfer_request_invalid");
      const username = normalizeWildsWalletPublicUsername(recipientUsername);
      const [recipient, walletResponse] = await Promise.all([resolveRecipient(authority, username), input.createAdapter(authority.accessToken).walletSummary()]);
      const walletEnvelope = record(walletResponse); const wallet = record(walletEnvelope.wallet); const quote = record(wallet.quote);
      if (walletEnvelope.ok !== true || wallet.userId !== authority.ownerReceizId || typeof wallet.balancePhiMicro !== "string" || !/^\d{1,30}$/.test(wallet.balancePhiMicro) || typeof quote.usdPerPhiMicrocents !== "string" || !MICRO.test(quote.usdPerPhiMicrocents)) throw new Error("wilds_wallet_v124_source_invalid");
      if (BigInt(wallet.balancePhiMicro) < BigInt(command.amountPhiMicro)) throw new Error("wilds_wallet_transfer_insufficient_value");
      const digest = createHmac("sha256", key(secret)).update(JSON.stringify([authority.ownerReceizId, session.keyId, recipient.conversationId, recipient.recipientUserId, command.amountPhiMicro, command.operationNonce])).digest("hex");
      const now = currentKai();
      const attempt: Attempt = { schema: PURPOSE, applicationId, ownerReceizId: authority.ownerReceizId, actorId: authority.actorId, profileHandle: authority.profileHandle, keyId: session.keyId, recipientUsername: username, ...recipient, amountPhiMicro: command.amountPhiMicro, quotedUsdCents: ((BigInt(command.amountPhiMicro) * BigInt(quote.usdPerPhiMicrocents) + 500_000_000_000n) / 1_000_000_000_000n).toString(), clientNonce: `wildz-wallet-connect:${digest}`, operationNonce: command.operationNonce, note: `Wildz payment reference ${digest}`, issuedAtKai: now, reviewExpiresAtKai: now + 120 };
      return { status: "staged", rail: "settlement", amountPhiMicro: attempt.amountPhiMicro, quotedUsdCents: attempt.quotedUsdCents, attempt: seal(attempt, secret), expiresAtKai: attempt.reviewExpiresAtKai };
    },
    async consentChallenge(authority, input) {
      const { attempt } = bound(authority, input.attempt);
      if (!HASH.test(input.artifactDigest)) throw new Error("wilds_wallet_transfer_consent_binding_invalid");
      if (currentKai() >= attempt.reviewExpiresAtKai) throw new Error("wilds_wallet_transfer_review_expired");
      const scopes = receizOidcScopesForRails("wallet").sort();
      const created = createReceizProofAuthorityChallenge({ applicationId: attempt.applicationId, artifactDigest: input.artifactDigest, scopes, consentStatementDigest: await wildsWalletTransferConsentStatementDigest({ attempt: input.attempt, amountPhiMicro: attempt.amountPhiMicro, rail: "settlement" }), ttlPulses: 60 });
      return { applicationId: attempt.applicationId, scopes, unsigned: created.challenge };
    },
    async execute(authority, request) {
      const { attempt, session } = bound(authority, request.attempt);
      if (currentKai() >= attempt.reviewExpiresAtKai) throw new Error("wilds_wallet_transfer_review_expired");
      const consent = request.consent as { artifact: string; challenge: ReceizProofAuthorityChallengeV123 };
      if (typeof consent.artifact !== "string" || consent.challenge?.consent?.statementDigest !== await wildsWalletTransferConsentStatementDigest({ attempt: request.attempt, amountPhiMicro: attempt.amountPhiMicro, rail: "settlement" }) || consent.challenge?.proof?.keyId !== session.keyId) throw new Error("wilds_wallet_transfer_consent_binding_invalid");
      const identity = await readReceizIdentityArtifact(consent.artifact);
      if (identity.crypto.privateKeyPkcs8B64u) throw new Error("wilds_wallet_transfer_consent_binding_invalid");
      const granted = await input.createAdapter(authority.accessToken).exchangeProofAuthorityV123({ artifact: consent.artifact, challenge: consent.challenge, applicationId: attempt.applicationId, scopes: receizOidcScopesForRails("wallet") });
      const writer = input.createAdapter(granted.accessToken); const introspection = record(await writer.introspectAccessToken());
      const scopes = typeof introspection.scope === "string" ? introspection.scope.split(/\s+/) : [];
      if (granted.keyId !== session.keyId || introspection.active !== true || introspection.sub !== authority.ownerReceizId || introspection.actor_label !== session.keyId || !scopes.includes("receiz:wallet.transfer")) throw new Error("wilds_wallet_transfer_consent_binding_invalid");
      if(currentKai()>=attempt.reviewExpiresAtKai)throw Error("wilds_wallet_transfer_review_expired");
      try {
        const response = record(await writer.connectTransfer({ conversationId: attempt.conversationId, recipientUserId: attempt.recipientUserId, unit: "phi", amountPhi: phiAmount(attempt.amountPhiMicro), note: attempt.note, clientNonce: attempt.clientNonce }, attempt.clientNonce));
        const transfer = record(response.transfer);
        if (response.ok !== true || typeof transfer.id !== "string" || !UUID.test(transfer.id) || typeof transfer.messageId !== "string" || !UUID.test(transfer.messageId) || transfer.conversationId !== attempt.conversationId || transfer.senderUserId !== attempt.ownerReceizId || transfer.recipientUserId !== attempt.recipientUserId || transfer.amountPhiMicro !== attempt.amountPhiMicro || typeof transfer.alreadyProcessed !== "boolean") return projection("unknown", attempt);
        return projection(await observe(attempt, session, transfer.messageId, transfer.id) ? "committed" : "unknown", attempt);
      } catch (error) {
        // The host can fail after its atomic wallet transaction. Retain the
        // same attempt for an authenticated read; never infer zero writes.
        const payload = record(record(error).payload);
        if (record(error).status===409&&payload.error === "wallet_insufficient_funds") return { status: "zero-write", rail: "settlement", code: "INSUFFICIENT_VALUE",noWriteWitness:seal(noWriteBasis(attempt,request.attempt),secret,"nw1") };
        return projection("unknown", attempt);
      }
    },
    async status(authority, value) {
      const { attempt, session } = bound(authority, value);
      try { return projection(await observe(attempt, session) ? "committed" : "unknown", attempt); } catch { return projection("unknown", attempt); }
    },
    async observe(authority, command) {
      const {attempt,session}=observationBinding(authority,command);
      try { return projection(await observe(attempt, session) ? "committed" : "unknown", attempt); } catch { return projection("unknown", attempt); }
    },
    async noWrite(authority,command){
      const {attempt,session}=observationBinding(authority,command);
      let witness:unknown;try{witness=decrypt(command.noWriteWitness,secret,"nw1");}catch{throw Error("wilds_wallet_transfer_no_write_witness_invalid");}
      if(JSON.stringify(witness)!==JSON.stringify(noWriteBasis(attempt,command.attempt)))throw Error("wilds_wallet_transfer_consent_binding_invalid");
      // Check the real rail again. A past insufficient response cannot close a
      // different previously in-flight execution that has since committed.
      const actual=await observe(attempt,session);
      if(actual===null)throw Error("receiz_wallet_connect_receipt_unavailable");
      if(actual)throw Error("wilds_wallet_transfer_committed_since_rejection");
      // This witnesses only an actual rejected SDK call. It is not a native
      // financial receipt. The old nonce could retry until its sealed review
      // window closes, so source release is forbidden before that coordinate.
      return {status:"zero-write",rail:"settlement",code:"INSUFFICIENT_VALUE",terminal:currentKai()>=attempt.reviewExpiresAtKai,retryAfterKai:attempt.reviewExpiresAtKai};
    },
    async receive(authority, amountPhiMicro) {
      const username = normalizeWildsWalletPublicUsername(authority.profileHandle);
      return { locator: `wildz:receive:${seal({ schema: "wildz.wallet.connect-receive.v1", username, expiresAtKai: currentKai() + 86_400 }, secret, "v2")}`, request: amountPhiMicro === null ? null : { kind: "phi", amountPhiMicro, authority: "non-authoritative" } };
    }
  };
  return Object.freeze(runtime);
}
